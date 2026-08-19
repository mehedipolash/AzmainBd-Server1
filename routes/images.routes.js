const express = require("express");
const multer = require("multer");
const { ObjectId } = require("mongodb");
const { getImageBucket } = require("../config/db");
const { requireAuth } = require("../middleware/verifyToken");
const { requireAdmin } = require("../middleware/requireAdmin");
const { ValidationError } = require("../utils/validate");

const router = express.Router();

/* ---------------------------------------------------------------------------
   Product photo storage.

   Files go into GridFS in the same MongoDB the rest of the data lives in, so
   there is no third-party account to manage and nothing on the server's disk —
   which matters because free hosts wipe the filesystem on every redeploy.

   Uploading is admin-only. Reading is public, because product images appear on
   the storefront to signed-out visitors.
--------------------------------------------------------------------------- */

const MAX_BYTES = 5 * 1024 * 1024; // 5MB — comfortably above a phone photo

// Only raster formats a browser renders as an image. SVG is deliberately
// excluded: it can carry <script>, and we serve these from our own origin.
const ALLOWED = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Memory storage, not disk. The file goes straight from the request into
// GridFS, so nothing is ever written to a filesystem that may not persist.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED[file.mimetype]) {
      return callback(
        new ValidationError("Upload a JPG, PNG, WebP or GIF image", "image"),
      );
    }
    callback(null, true);
  },
});

// The declared mimetype is only a hint — a client can claim anything. Checking
// the leading bytes means a renamed .exe cannot be stored and later served
// back with an image content-type.
const sniffType = (buffer) => {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (buffer.toString("ascii", 0, 3) === "GIF") return "image/gif";

  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
};

// POST /api/images — admin uploads a photo, gets back a URL to store on the
// product. Returns a relative path so the same database works against any
// deployed hostname.
router.post("/", requireAuth, requireAdmin, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError("No image file received", "image");
    }

    const actualType = sniffType(req.file.buffer);

    if (!actualType || !ALLOWED[actualType]) {
      throw new ValidationError("That file is not a valid image", "image");
    }

    const bucket = getImageBucket();

    const id = await new Promise((resolve, reject) => {
      const stream = bucket.openUploadStream(req.file.originalname?.slice(0, 200) ?? "product", {
        contentType: actualType,
        metadata: { uploadedBy: req.user.uid, uploadedAt: new Date() },
      });

      stream.on("error", reject);
      stream.on("finish", () => resolve(stream.id));
      stream.end(req.file.buffer);
    });

    res.status(201).json({
      url: `/api/images/${id}`,
      id: String(id),
      contentType: actualType,
      size: req.file.size,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/images/:id — public. Streams the bytes rather than buffering them,
// so a large image does not sit in memory for the whole response.
router.get("/:id", async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Image not found" });
    }

    const bucket = getImageBucket();
    const _id = new ObjectId(req.params.id);

    const [file] = await bucket.find({ _id }).limit(1).toArray();

    if (!file) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.set({
      "Content-Type": file.contentType ?? "application/octet-stream",
      "Content-Length": file.length,
      // Content is immutable — a new upload gets a new id — so it can be
      // cached hard. This is what keeps the storefront fast.
      "Cache-Control": "public, max-age=31536000, immutable",
      // Belt and braces: never let a stored file be interpreted as HTML.
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    });

    const stream = bucket.openDownloadStream(_id);
    stream.on("error", () => {
      if (!res.headersSent) res.status(404).json({ error: "Image not found" });
      else res.end();
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/images/:id — admin only, used when replacing a product photo.
router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: "Image not found" });
    }

    await getImageBucket().delete(new ObjectId(req.params.id));
    res.json({ success: true });
  } catch (error) {
    // GridFS throws when the file is already gone; deleting twice is not an
    // error from the caller's point of view.
    if (String(error?.message ?? "").includes("File not found")) {
      return res.json({ success: true });
    }
    next(error);
  }
});

module.exports = router;
