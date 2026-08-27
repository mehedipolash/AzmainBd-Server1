const { getCollections } = require("../config/db");

/* ---------------------------------------------------------------------------
   Admin authorisation.

   The role is read from MongoDB on every request, keyed by the uid that came
   out of the *verified* token. It is never read from the token itself, from a
   header, or from the request body.

   Why that matters: a Firebase ID token carries whatever custom claims the
   project set, but this project does not use the Admin SDK to set claims, so
   any "role" arriving from the client is simply the client's own assertion.
   Trusting it would let anyone grant themselves admin with a single curl.

   Must run after requireAuth, which is what populates req.user.
--------------------------------------------------------------------------- */

const requireAdmin = async (req, res, next) => {
  if (!req.user?.uid) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { users } = getCollections();
    const account = await users.findOne(
      { uid: req.user.uid },
      { projection: { role: 1, disabled: 1 } },
    );

    if (!account) {
      return res.status(403).json({ error: "Account not found" });
    }

    if (account.disabled) {
      return res.status(403).json({ error: "This account has been disabled" });
    }

    // A super admin is an admin too — they outrank one, so any admin-gated
    // route must admit them.
    if (account.role !== "admin" && account.role !== "superadmin") {
      return res.status(403).json({ error: "Administrator access required" });
    }

    req.user.role = account.role;
    return next();
  } catch (error) {
    console.error("Admin check failed:", error.message);
    return res.status(500).json({ error: "Could not verify permissions" });
  }
};

/* ---------------------------------------------------------------------------
   Super-admin authorisation — the top of the hierarchy.

   Only a super admin (the proprietor) can manage users: add or remove admins,
   change roles, delete accounts. A general admin is refused here, so the
   worst a compromised or careless admin can do is run the shop — never grant
   themselves or anyone else more power. Must run after requireAuth.
--------------------------------------------------------------------------- */
const requireSuperAdmin = async (req, res, next) => {
  if (!req.user?.uid) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { users } = getCollections();
    const account = await users.findOne(
      { uid: req.user.uid },
      { projection: { role: 1, disabled: 1 } },
    );

    if (!account) {
      return res.status(403).json({ error: "Account not found" });
    }

    if (account.disabled) {
      return res.status(403).json({ error: "This account has been disabled" });
    }

    if (account.role !== "superadmin") {
      return res.status(403).json({ error: "Only the owner can manage admins" });
    }

    req.user.role = account.role;
    return next();
  } catch (error) {
    console.error("Super-admin check failed:", error.message);
    return res.status(500).json({ error: "Could not verify permissions" });
  }
};

module.exports = { requireAdmin, requireSuperAdmin };
