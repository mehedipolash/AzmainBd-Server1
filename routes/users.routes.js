const express = require("express");
const { getCollections } = require("../config/db");
const { requireAuth } = require("../middleware/verifyToken");
const { requireAdmin } = require("../middleware/requireAdmin");
const { adminEmails, isOwnerEmail } = require("../config/env");
const { asString } = require("../utils/validate");

const router = express.Router();

/* ---------------------------------------------------------------------------
   User records.

   The client never sends a uid, email or role — all three come from the
   verified token, or from the database. A route that accepted `role` from the
   body would let anyone promote themselves with one request.
--------------------------------------------------------------------------- */

// POST /api/users/sync
// Called after sign-in. Creates the record on first visit, updates the profile
// on later ones, and always returns the role as stored on the server.
router.post("/sync", requireAuth, async (req, res, next) => {
  try {
    const { users } = getCollections();
    const { uid, email, name, picture, emailVerified } = req.user;

    const existing = await users.findOne({ uid });

    if (existing) {
      await users.updateOne(
        { uid },
        {
          $set: {
            email,
            emailVerified,
            displayName: name ?? existing.displayName ?? null,
            photoURL: picture ?? existing.photoURL ?? null,
            lastSeenAt: new Date(),
          },
        },
      );

      return res.json({
        uid,
        email,
        role: existing.role ?? "customer",
        disabled: existing.disabled === true,
      });
    }

    // Bootstrap: emails listed in ADMIN_EMAILS become admins on first sign-in.
    // This is the only path that grants the role without an existing admin,
    // and it is controlled by a server-side environment variable.
    const role = email && adminEmails.includes(email.toLowerCase()) ? "admin" : "customer";

    const doc = {
      uid,
      email,
      emailVerified,
      displayName: name ?? null,
      photoURL: picture ?? null,
      role,
      disabled: false,
      createdAt: new Date(),
      lastSeenAt: new Date(),
    };

    await users.insertOne(doc);
    res.status(201).json({ uid, email, role, disabled: false });
  } catch (error) {
    // Unique index on uid — a duplicate means a concurrent sync already ran.
    if (error.code === 11000) {
      const { users } = getCollections();
      const existing = await users.findOne({ uid: req.user.uid });
      return res.json({
        uid: req.user.uid,
        email: req.user.email,
        role: existing?.role ?? "customer",
        disabled: existing?.disabled === true,
      });
    }
    next(error);
  }
});

// GET /api/users/me — the caller's own record, including their real role.
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { users } = getCollections();
    const account = await users.findOne(
      { uid: req.user.uid },
      { projection: { _id: 0, uid: 1, email: 1, role: 1, displayName: 1, photoURL: 1, disabled: 1 } },
    );

    if (!account) return res.status(404).json({ error: "Account not found" });
    res.json(account);
  } catch (error) {
    next(error);
  }
});

// GET /api/users — admin only.
router.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { users } = getCollections();
    const list = await users
      .find({}, { projection: { uid: 1, email: 1, role: 1, displayName: 1, disabled: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    // Tag each row with whether it is a protected owner, so the panel can
    // disable the change/delete controls on those rows. The owner LIST itself
    // (the ADMIN_EMAILS value) is never sent to the browser — only this derived
    // per-row boolean — so the real guard stays on the server and the client
    // only learns which of the users it already sees are untouchable.
    const tagged = list.map((account) => ({
      ...account,
      isOwner: isOwnerEmail(account.email),
    }));

    res.json(tagged);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:uid/role — admin only.
router.patch("/:uid/role", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { users } = getCollections();
    const role = asString(req.body.role, "role", { max: 20 });

    if (!["admin", "customer"].includes(role)) {
      return res.status(400).json({ error: "Role must be admin or customer" });
    }

    const targetUid = asString(req.params.uid, "uid", { max: 128 });

    // An admin demoting themselves could lock the last administrator out of
    // the panel entirely.
    if (targetUid === req.user.uid && role !== "admin") {
      return res.status(400).json({ error: "You cannot remove your own admin access" });
    }

    // Look the target up FIRST, so a protected owner can never be demoted by
    // anyone through the panel. The owners (ADMIN_EMAILS) are the proprietor and
    // the maintainer; their access is controlled only by the server-side
    // variable, never by another admin the owner happened to add. Without this,
    // an admin the owner grants could turn round and strip the owner's access.
    const target = await users.findOne(
      { uid: targetUid },
      { projection: { _id: 0, email: 1 } },
    );

    if (!target) return res.status(404).json({ error: "User not found" });

    if (isOwnerEmail(target.email) && role !== "admin") {
      return res.status(403).json({
        error: "This is a protected owner account and cannot be changed here.",
      });
    }

    const result = await users.findOneAndUpdate(
      { uid: targetUid },
      { $set: { role, roleUpdatedAt: new Date(), roleUpdatedBy: req.user.uid } },
      { returnDocument: "after", projection: { _id: 0, uid: 1, email: 1, role: 1 } },
    );

    if (!result) return res.status(404).json({ error: "User not found" });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/:uid — admin only.
//
// Removes the user's record from MongoDB. Their Firebase Auth account is a
// separate system and is not touched here — deleting it would require the
// Firebase Admin SDK and a service-account key, which this project
// deliberately does without. Removing the Mongo record is what matters: on
// their next sign-in a fresh record is created and the ADMIN_EMAILS bootstrap
// runs again, so an account can be cleanly reset by deleting it here.
router.delete("/:uid", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { users } = getCollections();
    const targetUid = asString(req.params.uid, "uid", { max: 128 });

    // An admin deleting their own record would strip their access and could
    // remove the last administrator — refuse it, matching the role guard above.
    if (targetUid === req.user.uid) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    // A protected owner (ADMIN_EMAILS) can never be deleted through the panel.
    // Even if they could be, deleting the record would not revoke access — the
    // owner would sign in again and the ADMIN_EMAILS bootstrap would recreate
    // them as admin — so allowing it would only mislead. Refusing it outright
    // keeps the owner's account the one thing no other admin can touch.
    const target = await users.findOne(
      { uid: targetUid },
      { projection: { _id: 0, email: 1 } },
    );

    if (!target) return res.status(404).json({ error: "User not found" });

    if (isOwnerEmail(target.email)) {
      return res.status(403).json({
        error: "This is a protected owner account and cannot be deleted here.",
      });
    }

    const result = await users.deleteOne({ uid: targetUid });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ uid: targetUid, deleted: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
