const express = require("express");
const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/db");
const { requireAuth } = require("../middleware/verifyToken");
const { requireAdmin } = require("../middleware/requireAdmin");
const { asInteger, asString, ValidationError } = require("../utils/validate");

const router = express.Router();

/* ---------------------------------------------------------------------------
   Sales log.

   Orders are placed over WhatsApp, not through a checkout, so the shop owner
   records each sale here after the fact. Recording a sale is what moves stock —
   there is no separate "edit stock" path that could drift out of step with the
   sales history.

   Admin-only throughout: this is the owner's private ledger.
--------------------------------------------------------------------------- */

const toObjectId = (id, field = "id") => {
  if (!ObjectId.isValid(id)) throw new ValidationError(`Invalid ${field}`, field);
  return new ObjectId(id);
};

// GET /api/sales — recent sales plus the totals the dashboard reports on.
router.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { sales } = getCollections();

    const limit = asInteger(req.query.limit ?? 50, "limit", { min: 1, max: 200, required: false }) ?? 50;

    // Boundaries are computed on the server. A client-supplied "today" would
    // let the numbers be nudged by changing a device clock.
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [items, totals, todayTotals, monthTotals] = await Promise.all([
      sales.find({}).sort({ soldAt: -1 }).limit(limit).toArray(),
      sales
        .aggregate([
          { $group: { _id: null, revenue: { $sum: "$total" }, units: { $sum: "$quantity" }, count: { $sum: 1 } } },
        ])
        .toArray(),
      sales
        .aggregate([
          { $match: { soldAt: { $gte: startOfToday } } },
          { $group: { _id: null, revenue: { $sum: "$total" }, units: { $sum: "$quantity" }, count: { $sum: 1 } } },
        ])
        .toArray(),
      sales
        .aggregate([
          { $match: { soldAt: { $gte: startOfMonth } } },
          { $group: { _id: null, revenue: { $sum: "$total" }, units: { $sum: "$quantity" }, count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

    const shape = (row) => ({
      revenue: row?.revenue ?? 0,
      units: row?.units ?? 0,
      count: row?.count ?? 0,
    });

    res.json({
      items,
      allTime: shape(totals[0]),
      today: shape(todayTotals[0]),
      month: shape(monthTotals[0]),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sales — record a WhatsApp sale and decrement stock in one step.
router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { sales, products } = getCollections();

    const productId = toObjectId(req.body.productId, "productId");
    const quantity = asInteger(req.body.quantity, "quantity", { min: 1, max: 10_000 });
    const customerName = asString(req.body.customerName, "customerName", {
      required: false,
      max: 120,
    });
    const note = asString(req.body.note, "note", { required: false, max: 500 });

    // A price may be supplied for "price on request" items, which have no
    // stored price to fall back on.
    const overridePrice =
      req.body.unitPrice === undefined || req.body.unitPrice === null || req.body.unitPrice === ""
        ? null
        : asInteger(req.body.unitPrice, "unitPrice", { min: 0, max: 100_000_000 });

    // The conditional decrement is the important part: the stock check and the
    // write are a single atomic operation, so two sales recorded at the same
    // moment cannot both pass a check that only one of them should.
    const updated = await products.findOneAndUpdate(
      { _id: productId, stock: { $gte: quantity } },
      { $inc: { stock: -quantity, soldCount: quantity }, $set: { updatedAt: new Date() } },
      { returnDocument: "after" },
    );

    if (!updated) {
      // Distinguish "no such product" from "not enough stock" so the message
      // tells the owner what actually went wrong.
      const exists = await products.findOne({ _id: productId }, { projection: { stock: 1, name: 1 } });

      if (!exists) return res.status(404).json({ error: "Product not found" });

      return res.status(409).json({
        error: `Only ${exists.stock} left in stock — cannot record a sale of ${quantity}.`,
        field: "quantity",
      });
    }

    const unitPrice = overridePrice ?? updated.price ?? 0;

    const sale = {
      productId,
      productName: updated.name,
      quantity,
      unitPrice,
      total: unitPrice * quantity,
      customerName,
      note,
      soldAt: new Date(),
      recordedBy: req.user.uid,
    };

    const result = await sales.insertOne(sale);

    res.status(201).json({
      sale: { _id: result.insertedId, ...sale },
      product: updated,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sales/:id — undo a mis-recorded sale and give the stock back.
router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { sales, products } = getCollections();

    // Delete first: if two requests race, only one removes the document, so
    // only one restores the stock. Reading then deleting could double-restore.
    const sale = await sales.findOneAndDelete({ _id: toObjectId(req.params.id) });

    if (!sale) return res.status(404).json({ error: "Sale not found" });

    await products.updateOne(
      { _id: sale.productId },
      { $inc: { stock: sale.quantity, soldCount: -sale.quantity }, $set: { updatedAt: new Date() } },
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
