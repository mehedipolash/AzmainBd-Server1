const express = require("express");
const { getCollections } = require("../config/db");
const { requireAuth } = require("../middleware/verifyToken");
const { requireAdmin } = require("../middleware/requireAdmin");
const { adminEmails } = require("../config/env");
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

    res.json(list);
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

module.exports = router;
