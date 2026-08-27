const dotenv = require("dotenv");

dotenv.config();

/* ---------------------------------------------------------------------------
   Environment loading and validation.

   Fail at startup with a clear message rather than at the first request with an
   opaque one. A server that boots with half its configuration missing is worse
   than one that refuses to boot.
--------------------------------------------------------------------------- */

const required = ["DB_USER", "DB_PASS", "FIREBASE_PROJECT_ID"];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `\nMissing required environment variables: ${missing.join(", ")}\n` +
      "Copy .env.example to .env and fill in the values.\n",
  );
  process.exit(1);
}

// Allowed browser origins. Anything not listed is refused by CORS — a wildcard
// origin is what lets any website call this API on a logged-in user's behalf.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const splitEmails = (value) =>
  (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

// SUPER ADMINS — the proprietor. Only a super admin can add or remove admins,
// or change anyone's role. This is the top of the hierarchy and the one control
// that cannot be reached from the panel: it is set ONLY by this server-side
// variable, so no admin can ever promote themselves to it or strip it from the
// owner. A rogue or mistaken admin therefore cannot escalate past the owner.
const superAdminEmails = splitEmails(process.env.SUPER_ADMIN_EMAILS);

// ADMINS — general admins seeded on first sign-in. They run the shop (products,
// categories, orders) but CANNOT manage users. A super admin is also an admin
// by definition, so the two lists are merged when deciding admin access.
const adminEmails = [
  ...new Set([...superAdminEmails, ...splitEmails(process.env.ADMIN_EMAILS)]),
];

const normalise = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

// The role an email is seeded with on its FIRST sign-in. Super admins outrank
// admins; everyone else is a customer. After the first sign-in the role lives
// in MongoDB and is changed only by a super admin through the panel.
const bootstrapRoleFor = (email) => {
  const e = normalise(email);
  if (!e) return "customer";
  if (superAdminEmails.includes(e)) return "superadmin";
  if (adminEmails.includes(e)) return "admin";
  return "customer";
};

// A super admin is a protected owner: it can never be demoted or deleted from
// the panel, by anyone, including another super admin — only the server-side
// variable changes it. This is the worst-case guard against lock-out.
const isSuperAdminEmail = (email) => superAdminEmails.includes(normalise(email));

// Kept for existing callers: an "owner" is now precisely a super admin.
const isOwnerEmail = isSuperAdminEmail;

const isProduction = process.env.NODE_ENV === "production";

/* ---------------------------------------------------------------------------
   Production sanity checks.

   These are the settings that are harmless in development and dangerous in
   production, and every one of them fails SILENTLY — the server boots, serves
   requests, and looks healthy while being wide open or unreachable. A deploy
   that is broken in a visible way gets fixed in minutes; one that is broken
   quietly ships to the client.

   Only enforced when NODE_ENV=production, so local development is untouched.
--------------------------------------------------------------------------- */
if (isProduction) {
  const problems = [];

  // A production API whose only allowed origin is localhost refuses every real
  // browser request. The symptom is a storefront that loads but shows no
  // products, with the reason buried in the browser console as a CORS error.
  const localOnly = allowedOrigins.every((origin) => /^https?:\/\/localhost(:\d+)?$/i.test(origin));
  if (allowedOrigins.length === 0 || localOnly) {
    problems.push(
      "ALLOWED_ORIGINS contains no deployed domain. Set it to the storefront's real URL.",
    );
  }

  // http:// in production means tokens travel in clear text over the network.
  const insecure = allowedOrigins.filter((origin) => origin.startsWith("http://") && !/localhost/i.test(origin));
  if (insecure.length > 0) {
    problems.push(`ALLOWED_ORIGINS uses plain http for: ${insecure.join(", ")}. Use https.`);
  }

  // Without a super admin, nobody can manage users — the proprietor could never
  // add or remove an admin. This is the account the whole hierarchy hangs from.
  if (superAdminEmails.length === 0) {
    problems.push(
      "SUPER_ADMIN_EMAILS is empty — no owner who can manage admins. Set it to the proprietor's email.",
    );
  }

  // ADMIN_EMAILS grants the admin role to whoever signs in with a listed
  // address. Every entry is therefore a standing key to the panel, and one left
  // behind from testing is the most likely way an unintended admin appears.
  // (super admins are counted in adminEmails, so an owner-only setup is valid.)
  if (adminEmails.length === 0) {
    problems.push("Neither SUPER_ADMIN_EMAILS nor ADMIN_EMAILS is set — no way to create the first admin.");
  }
  if (adminEmails.length > 3) {
    problems.push(
      `ADMIN_EMAILS/SUPER_ADMIN_EMAILS list ${adminEmails.length} addresses total. Each one can become an admin by signing in — keep it to the accounts that genuinely need it.`,
    );
  }

  if (problems.length > 0) {
    console.error("\nRefusing to start in production with these problems:\n");
    problems.forEach((problem) => console.error(`  - ${problem}`));
    console.error("");
    process.exit(1);
  }
}

module.exports = {
  port: Number(process.env.PORT) || 5000,
  isProduction,
  dbUser: process.env.DB_USER,
  dbPass: process.env.DB_PASS,
  dbName: process.env.DB_NAME ?? "AzmainBd",
  // The MongoDB cluster host (the "cluster0.xxxxx.mongodb.net" part). Kept in
  // the environment so switching to a different Atlas account is a .env edit,
  // not a code edit. Falls back to the current cluster so nothing breaks if the
  // variable is not set on an existing deployment.
  dbHost: process.env.DB_HOST ?? "cluster0.azj20jt.mongodb.net",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  allowedOrigins,
  adminEmails,
  superAdminEmails,
  bootstrapRoleFor,
  isSuperAdminEmail,
  isOwnerEmail,
};
