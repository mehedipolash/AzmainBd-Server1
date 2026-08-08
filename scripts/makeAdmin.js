/* ---------------------------------------------------------------------------
   Promotes an existing user to admin.

   ADMIN_EMAILS only applies on a user's *first* sign-in, when their record is
   created. Someone who signed in before their address was listed keeps the
   customer role, and this script is how you fix that without hand-editing the
   database.

   Usage:  npm run make-admin -- someone@example.com
--------------------------------------------------------------------------- */

const { connectDb, getCollections, closeDb } = require("../config/db");

const run = async () => {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    console.error("\nUsage: npm run make-admin -- someone@example.com\n");
    process.exit(1);
  }

  await connectDb();
  const { users } = getCollections();

  const account = await users.findOne({ email });

  if (!account) {
    console.error(
      `\nNo user found with email "${email}".\n` +
        "They need to sign in through the site once before they can be promoted.\n",
    );
    await closeDb();
    process.exit(1);
  }

  if (account.role === "admin") {
    console.log(`\n${email} is already an admin.\n`);
    await closeDb();
    return;
  }

  await users.updateOne(
    { email },
    { $set: { role: "admin", roleUpdatedAt: new Date(), roleUpdatedBy: "script" } },
  );

  console.log(`\n${email} is now an admin.`);
  console.log("Sign out and back in for the change to appear in the app.\n");

  await closeDb();
};

run().catch((error) => {
  console.error("Failed:", error.message);
  process.exit(1);
});
