const express = require("express");
const { getCollections } = require("../config/db");
const { requireAuth } = require("../middleware/verifyToken");
const { requireAdmin, requireSuperAdmin } = require("../middleware/requireAdmin");
const { bootstrapRoleFor, isSuperAdminEmail } = require("../config/env");
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

    // Bootstrap: the role an email gets on its FIRST sign-in. SUPER_ADMIN_EMAILS
    // → superadmin, ADMIN_EMAILS → admin, everyone else → customer. This is the
    // only path that grants a privileged role without an existing super admin,
    // and it is controlled entirely by server-side environment variables.
    const role = bootstrapRoleFor(email);

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

// GET /api/users — any admin may READ the list (a general admin sees it too),
// but only a super admin may act on it (the PATCH/DELETE routes enforce that).
router.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { users } = getCollections();
    const list = await users
      .find({}, { projection: { uid: 1, email: 1, role: 1, displayName: 1, disabled: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    // Tag each row with whether it is a protected super admin (owner), so the
    // panel can lock its controls. The owner LIST itself is never sent to the
    // browser — only this derived per-row boolean. callerRole tells the panel
    // whether the viewer may act at all, so a general admin gets a read-only view
    // without the client having to know the rule.
    const tagged = list.map((account) => ({
      ...account,
      isOwner: isSuperAdminEmail(account.email),
    }));

    res.json({ users: tagged, callerRole: req.user.role });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:uid/role — SUPER ADMIN ONLY. A general admin cannot change
// anyone's role, so an admin can never create another admin.
router.patch("/:uid/role", requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { users } = getCollections();
    const role = asString(req.body.role, "role", { max: 20 });

    // A super admin can grant "admin" or reduce to "customer". They cannot mint
    // another super admin from the panel — that rank is set only by the
    // server-side variable, so the top of the hierarchy stays off-limits to the UI.
    if (!["admin", "customer"].includes(role)) {
      return res.status(400).json({ error: "Role must be admin or customer" });
    }

    const targetUid = asString(req.params.uid, "uid", { max: 128 });

    if (targetUid === req.user.uid) {
      return res.status(400).json({ error: "You cannot change your own role" });
    }

    const target = await users.findOne(
      { uid: targetUid },
      { projection: { _id: 0, email: 1, role: 1 } },
    );

    if (!target) return res.status(404).json({ error: "User not found" });

    // A super admin (owner) can never be demoted through the panel — not even by
    // another super admin. Their rank is controlled only by SUPER_ADMIN_EMAILS,
    // so no UI action can strip the owner's power.
    if (isSuperAdminEmail(target.email) || target.role === "superadmin") {
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

// DELETE /api/users/:uid — SUPER ADMIN ONLY.
//
// Removes the user's record from MongoDB. Their Firebase Auth account is a
// separate system and is not touched here — deleting it would require the
// Firebase Admin SDK and a service-account key, which this project
// deliberately does without. Removing the Mongo record is what matters: on
// their next sign-in a fresh record is created and the bootstrap runs again,
// so an account can be cleanly reset by deleting it here.
router.delete("/:uid", requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { users } = getCollections();
    const targetUid = asString(req.params.uid, "uid", { max: 128 });

    if (targetUid === req.user.uid) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    // A super admin (owner) can never be deleted through the panel. Even if they
    // could be, deleting the record would not revoke access — they would sign in
    // again and the bootstrap would recreate them as super admin — so allowing it
    // would only mislead. Refusing outright keeps the owner untouchable.
    const target = await users.findOne(
      { uid: targetUid },
      { projection: { _id: 0, email: 1, role: 1 } },
    );

    if (!target) return res.status(404).json({ error: "User not found" });

    if (isSuperAdminEmail(target.email) || target.role === "superadmin") {
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
