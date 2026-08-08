const express = require("express");
const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");
const { requireAuth } = require("../middleware/verifyToken");
const { requireAdmin } = require("../middleware/requireAdmin");
const { buildProduct, ValidationError, asInteger } = require("../utils/validate");

const router = express.Router();

const MAX_LIMIT = 60;

// Rejects malformed ids before they reach Mongo, so a bad id returns 400 rather
// than throwing a BSONError that would surface as a 500.
const toObjectId = (id) => {
  if (!ObjectId.isValid(id)) {
    throw new ValidationError("Invalid product id", "id");
  }
  return new ObjectId(id);
};

/* ------------------------------- public reads ---------------------------- */

// GET /api/products
router.get("/", async (req, res, next) => {
  try {
    const { products } = getCollections();

    const filter = {};

    if (req.query.category) {
      filter.category = String(req.query.category).slice(0, 60);
    }

    if (req.query.brand) {
      filter.brand = String(req.query.brand).slice(0, 60);
    }

    if (req.query.inStock === "true") {
      filter.stock = { $gt: 0 };
    }

    // Regex is escaped — an unescaped user string here is a ReDoS vector and
    // lets a visitor craft queries the index cannot serve.
    if (req.query.search) {
      const term = String(req.query.search).slice(0, 100);
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.name = { $regex: escaped, $options: "i" };
    }

    const limit = Math.min(
      MAX_LIMIT,
      asInteger(req.query.limit ?? 24, "limit", { min: 1, max: MAX_LIMIT, required: false }) ?? 24,
    );
    const skip = asInteger(req.query.skip ?? 0, "skip", { min: 0, max: 100_000, required: false }) ?? 0;

    const sortMap = {
      newest: { createdAt: -1 },
      "price-asc": { price: 1 },
      "price-desc": { price: -1 },
      rating: { rating: -1 },
    };
    const sort = sortMap[req.query.sort] ?? sortMap.newest;

    const [items, total] = await Promise.all([
      products.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
      products.countDocuments(filter),
    ]);

    res.json({ items, total, limit, skip });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res, next) => {
  try {
    const { products } = getCollections();
    const product = await products.findOne({ _id: toObjectId(req.params.id) });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

/* ------------------------------- admin writes ---------------------------- */

// POST /api/products
router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { products } = getCollections();

    // Server owns these fields; anything the client sent for them is discarded.
    const doc = {
      ...buildProduct(req.body),
      rating: 0,
      reviews: 0,
      soldCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: req.user.uid,
    };

    const result = await products.insertOne(doc);
    res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/products/:id
router.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { products } = getCollections();
    const _id = toObjectId(req.params.id);

    const updates = buildProduct(req.body, { partial: true });

    // Validate the price relationship against stored values when only one side
    // is being changed, otherwise a partial update can leave oldPrice <= price.
    if (updates.price !== undefined || updates.oldPrice !== undefined) {
      const current = await products.findOne({ _id }, { projection: { price: 1, oldPrice: 1 } });
      if (!current) return res.status(404).json({ error: "Product not found" });

      const nextPrice = updates.price ?? current.price;
      const nextOld = updates.oldPrice === undefined ? current.oldPrice : updates.oldPrice;

      if (nextOld !== null && nextOld !== undefined && nextOld <= nextPrice) {
        return res.status(400).json({ error: "oldPrice must be higher than price" });
      }
    }

    const result = await products.findOneAndUpdate(
      { _id },
      { $set: { ...updates, updatedAt: new Date(), updatedBy: req.user.uid } },
      { returnDocument: "after" },
    );

    if (!result) return res.status(404).json({ error: "Product not found" });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/products/:id
router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { products } = getCollections();
    const result = await products.deleteOne({ _id: toObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
