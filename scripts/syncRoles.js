/* ---------------------------------------------------------------------------
   Brings existing user records in line with SUPER_ADMIN_EMAILS / ADMIN_EMAILS.

   The bootstrap in the sync route only assigns a role on a user's FIRST
   sign-in. Anyone who signed in before the super-admin tier existed keeps their
   old role — so the proprietor's record can still say "admin" when it should be
   "superadmin". This script reconciles that in one run:

     - an email in SUPER_ADMIN_EMAILS  -> role "superadmin"
     - an email in ADMIN_EMAILS (only) -> role "admin"

   It never DEMOTES anyone who was promoted through the panel — it only raises a
   listed owner/admin to the role their email entitles them to, so running it is
   always safe. Run it once after deploying the super-admin change, and again at
   the client's setup if their record was created before this was in place.

   Usage:  npm run sync-roles
--------------------------------------------------------------------------- */

const { connectDb, getCollections, closeDb } = require("../config/db");
const { superAdminEmails, adminEmails } = require("../config/env");

const run = async () => {
  await connectDb();
  const { users } = getCollections();

  const superSet = new Set(superAdminEmails);
  // Admins that are NOT also super admins.
  const adminOnly = adminEmails.filter((email) => !superSet.has(email));

  let changed = 0;

  for (const email of superAdminEmails) {
    const result = await users.updateOne(
      { email, role: { $ne: "superadmin" } },
      { $set: { role: "superadmin", roleUpdatedAt: new Date(), roleUpdatedBy: "sync-roles" } },
    );
    if (result.matchedCount > 0 && result.modifiedCount > 0) {
      console.log(`  ${email} -> superadmin`);
      changed += 1;
    } else if (result.matchedCount === 0) {
      const exists = await users.findOne({ email }, { projection: { _id: 1 } });
      console.log(
        exists
          ? `  ${email} already superadmin`
          : `  ${email} — no record yet (they must sign in once)`,
      );
    }
  }

  for (const email of adminOnly) {
    // Raise a customer to admin, but never touch a superadmin who also happens
    // to be listed here — the query excludes both admin and superadmin.
    const result = await users.updateOne(
      { email, role: { $nin: ["admin", "superadmin"] } },
      { $set: { role: "admin", roleUpdatedAt: new Date(), roleUpdatedBy: "sync-roles" } },
    );
    if (result.modifiedCount > 0) {
      console.log(`  ${email} -> admin`);
      changed += 1;
    }
  }

  console.log(
    changed > 0
      ? `\nDone — ${changed} record(s) updated. Ask them to sign out and back in.\n`
      : "\nNothing to change — every listed owner/admin already has the right role.\n",
  );

  await closeDb();
};

run().catch((error) => {
  console.error("Failed:", error.message);
  process.exit(1);
});
