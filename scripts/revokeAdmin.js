/* ---------------------------------------------------------------------------
   Demotes an admin back to customer.

   The counterpart to make-admin. Removing an admin is a security action, so it
   is deliberately noisy: it names the account, refuses to strip the last
   remaining admin, and reminds you to clear the address from ADMIN_EMAILS —
   because leaving it there means the account is promoted straight back the next
   time it signs in, which looks exactly like the demotion silently failing.

   Usage:  npm run revoke-admin -- someone@example.com
--------------------------------------------------------------------------- */

const { connectDb, getCollections, closeDb } = require("../config/db");
const { adminEmails } = require("../config/env");

const run = async () => {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    console.error("\nUsage: npm run revoke-admin -- someone@example.com\n");
    process.exit(1);
  }

  await connectDb();
  const { users } = getCollections();

  const account = await users.findOne({ email });

  if (!account) {
    console.error(`\nNo user found with email "${email}".\n`);
    await closeDb();
    process.exit(1);
  }

  if (account.role !== "admin") {
    console.log(`\n${email} is not an admin — nothing to do.\n`);
    await closeDb();
    return;
  }

  const remaining = await users.countDocuments({
    role: "admin",
    disabled: { $ne: true },
    uid: { $ne: account.uid },
  });

  if (remaining === 0) {
    console.error(
      `\nRefusing: ${email} is the last active admin.\n` +
        "Promote a replacement first, or nobody can reach the admin panel.\n",
    );
    await closeDb();
    process.exit(1);
  }

  await users.updateOne(
    { uid: account.uid },
    { $set: { role: "customer", roleUpdatedAt: new Date(), roleUpdatedBy: "script:revoke" } },
  );

  console.log(`\n${email} is no longer an admin. ${remaining} admin(s) remain.`);

  if (adminEmails.includes(email)) {
    console.log(
      `\nIMPORTANT: "${email}" is still listed in ADMIN_EMAILS.\n` +
        "That list re-grants admin on a first sign-in, so remove the address\n" +
        "from .env as well or this demotion can be undone by signing in again.",
    );
  }

  console.log("");
  await closeDb();
};

run().catch(async (error) => {
  console.error("Failed:", error.message);
  await closeDb().catch(() => {});
  process.exit(1);
});
