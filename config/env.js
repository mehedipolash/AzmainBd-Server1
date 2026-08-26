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

// Emails allowed to hold the admin role. Seeded into the database on first run
// so there is always a way in; afterwards the role lives in MongoDB.
//
// These are also the PROTECTED OWNERS: they are the shop's real proprietor and
// the maintainer, the accounts the whole site is run from. An owner can never
// be demoted or deleted from the admin panel — only by editing this server-side
// variable — so no admin the owner adds through the UI can ever turn round and
// lock the owner out of their own site. This is the worst-case guard: a rogue
// or mistaken admin cannot escalate past the people who hold the server.
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

// True when the given email is one of the protected owners. Comparison is
// lower-cased on both sides because ADMIN_EMAILS is already normalised and an
// email from a token can arrive in any case.
const isOwnerEmail = (email) =>
  typeof email === "string" && adminEmails.includes(email.trim().toLowerCase());

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

  // ADMIN_EMAILS grants the admin role to whoever signs in with a listed
  // address. Every entry is therefore a standing key to the panel, and one left
  // behind from testing is the most likely way an unintended admin appears.
  if (adminEmails.length === 0) {
    problems.push("ADMIN_EMAILS is empty — no way to create the first admin.");
  }
  if (adminEmails.length > 3) {
    problems.push(
      `ADMIN_EMAILS lists ${adminEmails.length} addresses. Each one can become an admin by signing in — keep it to the accounts that genuinely need it.`,
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
  isOwnerEmail,
};
