const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { port, allowedOrigins, isProduction } = require("./config/env");
const { connectDb, closeDb } = require("./config/db");
const { ValidationError } = require("./utils/validate");

const productRoutes = require("./routes/products.routes");
const categoryRoutes = require("./routes/categories.routes");
const userRoutes = require("./routes/users.routes");
const imageRoutes = require("./routes/images.routes");
const salesRoutes = require("./routes/sales.routes");

const app = express();

// Trust the first proxy hop so rate limiting keys on the real client IP when
// deployed behind Render/Vercel rather than on the proxy's address.
app.set("trust proxy", 1);

// Query strings parse to flat strings only.
//
// The "extended" parser turns ?category[$ne]=x into a nested OBJECT, and an
// object reaching a Mongo filter is a query-operator injection: $ne, $gt and
// $regex would be evaluated as operators rather than compared as text. Express
// 5 already defaults to "simple", so this is the behaviour we have — but it is
// a default, and defaults get changed by an upgrade or a stray config line.
// Pinning it makes the guarantee explicit instead of incidental.
//
// Routes still coerce with String() on top of this; neither layer is relied on
// alone. Nothing in this API takes a nested query parameter, so there is no
// functionality to lose.
app.set("query parser", "simple");

// crossOriginResourcePolicy is relaxed to "cross-origin" so the storefront can
// display product photos served from this API. Everything else helmet sets —
// nosniff, frameguard, HSTS — stays on.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Explicit origin allowlist. A bare cors() reflects any origin, which lets any
// website on the internet call this API from a logged-in customer's browser.
app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and server-to-server requests send no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }),
);

// Body cap — the default is 100kb but being explicit documents the intent and
// stops a large payload from tying up the process.
app.use(express.json({ limit: "100kb" }));

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests — please slow down" },
  }),
);

// Writes are rate-limited harder than reads.
const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many changes in a short time — please wait a moment" },
});

app.use(["/api/products", "/api/categories", "/api/images", "/api/sales"], (req, res, next) => {
  if (req.method === "GET") return next();
  return writeLimiter(req, res, next);
});

app.get("/", (req, res) => {
  res.json({ service: "AzmainBd API", status: "ok" });
});

app.get("/health", async (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
// Mounted at /api/accounts, NOT /api/users: the shared host's firewall blocks
// any path containing "/users" (bots probe it), which was serving its bot-check
// HTML page instead of our JSON — so sign-in could never read a role and the
// admin panel never appeared. "accounts" is the same routes under a name the
// firewall leaves alone. Kept /api/users too so any stale client still resolves.
app.use("/api/accounts", userRoutes);
app.use("/api/users", userRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/sales", salesRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Central error handler. Validation problems surface their message; anything
// else returns a generic string, because stack traces and driver errors leak
// schema details to whoever triggered them.
app.use((error, req, res, _next) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message, field: error.field });
  }

  // multer raises this when a file exceeds the configured limit.
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Image must be 5MB or smaller", field: "image" });
  }

  // body-parser raises these for a request body that is too large or is not
  // valid JSON. Both are the CALLER's mistake, so they must answer 413/400
  // rather than falling through to the generic 500 — a 500 says the server
  // broke, which invites a probe to keep pushing to see what else breaks.
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }

  if (error?.type === "entity.parse.failed" || error instanceof SyntaxError) {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }

  if (error?.message === "Origin not allowed by CORS") {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Something went wrong on the server" });
});

const start = async () => {
  try {
    await connectDb();

    const server = app.listen(port, () => {
      console.log(`Server listening on port ${port} (${isProduction ? "production" : "development"})`);
    });

    const shutdown = async (signal) => {
      console.log(`\n${signal} received — shutting down`);
      server.close(async () => {
        await closeDb();
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to start:", error.message);
    process.exit(1);
  }
};

start();
