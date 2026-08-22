/* ---------------------------------------------------------------------------
   Hands the admin role over to the client, and removes the build accounts.

   Run this AFTER the client has signed in once on the deployed site. Their
   account cannot be created from here: Firebase Auth owns accounts, and this
   project deliberately does not use the Admin SDK, so a user record only exists
   once they have signed in through the site at least once.

   The order matters and is enforced rather than trusted:

     1. Confirm the client's account exists and holds the admin role.
     2. Only then demote the build accounts.

   Doing it the other way round — clearing the old admins first and discovering
   afterwards that the client never signed in — leaves the panel with no way in
   and no way to grant the role back, because granting it needs either an
   existing admin or a shell on the server. So the script refuses to demote
   anyone until a replacement admin is verified to be in place.

   Usage:  npm run handover-admins            (report only, changes nothing)
           npm run handover-admins -- --apply
--------------------------------------------------------------------------- */

const { connectDb, getCollections, closeDb } = require("../config/db");
const { adminEmails } = require("../config/env");

// The accounts that should hold admin after handover. Kept in step with
// ADMIN_EMAILS in .env — the check below reports if the two disagree.
const KEEP = ["azminbdweb@gmail.com", "demo.admin@azmainbd.com"];

const run = async () => {
  const apply = process.argv.includes("--apply");

  await connectDb();
  const { users } = getCollections();

  const admins = await users
    .find({ role: "admin" }, { projection: { email: 1, uid: 1, disabled: 1 } })
    .toArray();

  const emailOf = (account) => (account.email ?? "").toLowerCase();

  const keeping = admins.filter((account) => KEEP.includes(emailOf(account)));
  const removing = admins.filter((account) => !KEEP.includes(emailOf(account)));
  const missing = KEEP.filter((email) => !admins.some((account) => emailOf(account) === email));

  console.log("\nIntended admins after handover:");
  KEEP.forEach((email) => {
    const account = keeping.find((a) => emailOf(a) === email);
    console.log(
      `  ${email}  ${account ? (account.disabled ? "EXISTS but DISABLED" : "ready") : "NOT SIGNED IN YET"}`,
    );
  });

  console.log("\nAdmin access to be removed:");
  if (removing.length === 0) console.log("  (none)");
  removing.forEach((account) => console.log(`  ${account.email}  uid ${account.uid}`));

  // ADMIN_EMAILS re-grants admin on a first sign-in, so an address left there
  // undoes this handover the moment that person signs in again.
  const stale = adminEmails.filter((email) => !KEEP.includes(email));
  if (stale.length > 0) {
    console.log(
      `\nADMIN_EMAILS still lists: ${stale.join(", ")}\n` +
        "  Remove these from .env, or they become admin again on their next sign-in.",
    );
  }

  const usable = keeping.filter((account) => !account.disabled);

  if (usable.length === 0) {
    console.error(
      "\nRefusing to change anything: none of the intended admins has an active" +
        "\naccount yet. Ask them to sign in on the deployed site first, then" +
        "\nre-run this script.\n",
    );
    await closeDb();
    process.exit(1);
  }

  if (missing.length > 0) {
    console.log(
      `\nNote: ${missing.join(", ")} has not signed in yet.` +
        "\n  They are in ADMIN_EMAILS, so they become admin automatically on their" +
        "\n  first sign-in. No action needed here.",
    );
  }

  if (!apply) {
    console.log("\nReport only. Re-run with --apply to make these changes.\n");
    await closeDb();
    return;
  }

  if (removing.length === 0) {
    console.log("\nNothing to remove. Handover already complete.\n");
    await closeDb();
    return;
  }

  const result = await users.updateMany(
    { uid: { $in: removing.map((account) => account.uid) } },
    { $set: { role: "customer", roleUpdatedAt: new Date(), roleUpdatedBy: "script:handover" } },
  );

  console.log(
    `\nDemoted ${result.modifiedCount} account(s) to customer.` +
      `\n${usable.length} admin(s) remain: ${usable.map((a) => a.email).join(", ")}\n`,
  );

  await closeDb();
};

run().catch(async (error) => {
  console.error("Failed:", error.message);
  await closeDb().catch(() => {});
  process.exit(1);
});
