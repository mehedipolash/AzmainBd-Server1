/* ---------------------------------------------------------------------------
   Shows every account holding the admin role, plus the ADMIN_EMAILS bootstrap
   list, so the two can be compared at a glance.

   Worth running before a deployment: ADMIN_EMAILS only takes effect on a first
   sign-in, so an address left in that variable is a standing invitation for
   whoever controls it to become an admin the moment they sign in. The two lists
   drifting apart is the normal way a stale admin survives unnoticed.

   Usage:  npm run list-admins
--------------------------------------------------------------------------- */

const { connectDb, getCollections, closeDb } = require("../config/db");
const { adminEmails } = require("../config/env");

const run = async () => {
  await connectDb();
  const { users } = getCollections();

  const admins = await users
    .find(
      { role: "admin" },
      { projection: { email: 1, uid: 1, disabled: 1, createdAt: 1, roleUpdatedAt: 1 } },
    )
    .sort({ createdAt: 1 })
    .toArray();

  console.log(`\nAdmins in the database (${admins.length}):\n`);

  if (admins.length === 0) {
    console.log("  none — nobody can reach the admin panel\n");
  }

  admins.forEach((admin) => {
    const flags = [];
    if (admin.disabled) flags.push("DISABLED");
    if (!adminEmails.includes((admin.email ?? "").toLowerCase())) {
      flags.push("not in ADMIN_EMAILS");
    }
    console.log(
      `  ${admin.email}` +
        `\n      uid ${admin.uid}` +
        (flags.length ? `\n      ${flags.join(", ")}` : ""),
    );
  });

  console.log(`\nADMIN_EMAILS bootstrap list (${adminEmails.length}):\n`);
  if (adminEmails.length === 0) {
    console.log("  empty");
  }
  adminEmails.forEach((email) => {
    const live = admins.some((admin) => (admin.email ?? "").toLowerCase() === email);
    console.log(`  ${email}${live ? "" : "   <-- no admin account yet; would become one on sign-in"}`);
  });

  // A single admin is a lockout waiting to happen: lose that password or that
  // mailbox and the panel is unreachable, because nothing else can grant the
  // role. Two is the minimum that survives losing one.
  const active = admins.filter((admin) => !admin.disabled).length;
  if (active < 2) {
    console.log(
      `\nWarning: only ${active} active admin. Losing access to that account locks the panel.`,
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
