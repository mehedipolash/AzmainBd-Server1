const { createRemoteJWKSet, jwtVerify } = require("jose");
const { firebaseProjectId } = require("../config/env");

/* ---------------------------------------------------------------------------
   Firebase ID token verification, without the Admin SDK.

   A Firebase ID token is a standard RS256 JWT signed by Google. Verifying it
   means checking, in this order:

     1. the signature, against Google's published public keys
     2. the issuer   — https://securetoken.google.com/<project-id>
     3. the audience — <project-id>
     4. expiry       — handled by jwtVerify
     5. auth_time    — the token must not predate the sign-in it claims

   Skipping any of these turns the check into decoration. In particular,
   decoding a JWT without verifying its signature (jwt.decode, atob on the
   payload) proves nothing at all: anyone can craft that payload by hand.

   The JWKS is fetched once and cached by `jose`, which handles key rotation.
--------------------------------------------------------------------------- */

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
  {
    cooldownDuration: 30_000,
    cacheMaxAge: 600_000,
  },
);

const ISSUER = `https://securetoken.google.com/${firebaseProjectId}`;

const verifyFirebaseToken = async (token) => {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: ISSUER,
    audience: firebaseProjectId,
    algorithms: ["RS256"],
  });

  // Firebase sets `sub` to the uid and requires it to be non-empty.
  if (!payload.sub) {
    throw new Error("Token has no subject");
  }

  // auth_time in the future means the token is malformed or the clock is
  // wrong; either way it should not be trusted. Allow 5 minutes of skew.
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.auth_time === "number" && payload.auth_time > now + 300) {
    throw new Error("Token auth_time is in the future");
  }

  return payload;
};

// Express middleware. Attaches req.user on success; never calls next() on
// failure, so a route behind this can assume req.user is genuine.
const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization ?? "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = header.slice(7).trim();

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = await verifyFirebaseToken(token);

    req.user = {
      uid: payload.sub,
      email: payload.email ?? null,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };

    return next();
  } catch (error) {
    // Do not echo the underlying error to the client — it can reveal whether a
    // token was expired, malformed or forged, which helps an attacker tune.
    if (!module.exports.isProduction) {
      console.warn("Token verification failed:", error.message);
    }
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Requires a verified email address on top of a valid token. Used for actions
// that must be traceable to a reachable person, such as placing an order.
const requireVerifiedEmail = (req, res, next) => {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      error: "Please verify your email address before continuing",
      code: "EMAIL_NOT_VERIFIED",
    });
  }
  return next();
};

module.exports = { requireAuth, requireVerifiedEmail, verifyFirebaseToken };
