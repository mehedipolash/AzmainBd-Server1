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
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

module.exports = {
  port: Number(process.env.PORT) || 5000,
  isProduction: process.env.NODE_ENV === "production",
  dbUser: process.env.DB_USER,
  dbPass: process.env.DB_PASS,
  dbName: process.env.DB_NAME ?? "AzmainBd",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  allowedOrigins,
  adminEmails,
};
