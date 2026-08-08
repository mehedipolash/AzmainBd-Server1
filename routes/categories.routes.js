const express = require("express");
const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");
const { requireAuth } = require("../middleware/verifyToken");
const { requireAdmin } = require("../middleware/requireAdmin");
const { buildCategory, ValidationError } = require("../utils/validate");

const router = express.Router();

const toObjectId = (id) => {
  if (!ObjectId.isValid(id)) throw new ValidationError("Invalid category id", "id");
  return new ObjectId(id);
};

// GET /api/categories — includes a live in-stock count per category.
router.get("/", async (req, res, next) => {
  try {
    const { categories, products } = getCollections();

    const list = await categories.find({}).sort({ name: 1 }).toArray();

    const counts = await products
      .aggregate([
        { $match: { stock: { $gt: 0 } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ])
      .toArray();

    const countBySlug = Object.fromEntries(counts.map((row) => [row._id, row.count]));

    res.json(list.map((item) => ({ ...item, inStockCount: countBySlug[item.slug] ?? 0 })));
  } catch (error) {
    next(error);
  }
});

// POST /api/categories
router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { categories } = getCollections();
    const doc = { ...buildCategory(req.body), createdAt: new Date() };

    const existing = await categories.findOne({ slug: doc.slug });
    if (existing) {
      return res.status(409).json({ error: "A category with that name already exists" });
    }

    const result = await categories.insertOne(doc);
    res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (error) {
    // The unique index is the real guard — this catches the race where two
    // requests pass the findOne check simultaneously.
    if (error.code === 11000) {
      return res.status(409).json({ error: "A category with that name already exists" });
    }
    next(error);
  }
});

// PATCH /api/categories/:id
router.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { categories } = getCollections();
    const updates = buildCategory(req.body, { partial: true });

    const result = await categories.findOneAndUpdate(
      { _id: toObjectId(req.params.id) },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: "after" },
    );

    if (!result) return res.status(404).json({ error: "Category not found" });
    res.json(result);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "A category with that name already exists" });
    }
    next(error);
  }
});

// DELETE /api/categories/:id — refuses while products still reference it.
router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { categories, products } = getCollections();
    const _id = toObjectId(req.params.id);

    const category = await categories.findOne({ _id });
    if (!category) return res.status(404).json({ error: "Category not found" });

    const inUse = await products.countDocuments({ category: category.slug });
    if (inUse > 0) {
      return res.status(409).json({
        error: `${inUse} product${inUse === 1 ? "" : "s"} still use this category. Move them first.`,
      });
    }

    await categories.deleteOne({ _id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
