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

    if (account.role !== "admin") {
      return res.status(403).json({ error: "Administrator access required" });
    }

    req.user.role = account.role;
    return next();
  } catch (error) {
    console.error("Admin check failed:", error.message);
    return res.status(500).json({ error: "Could not verify permissions" });
  }
};

module.exports = { requireAdmin };
