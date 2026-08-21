/* ---------------------------------------------------------------------------
   One-off migration: mark the homepage hero selection.

   The `featured` flag is new, so every existing product predates it. Running
   the seed would set it, but the seed also deletes and rewrites the whole
   catalogue — which would destroy anything the client has added or edited
   since. This touches the one field and nothing else.

   Safe to run more than once: it sets an explicit true/false on every product,
   so a second run produces the same state as the first rather than compounding.

   Usage:  node scripts/setFeatured.js
--------------------------------------------------------------------------- */

const { connectDb, closeDb, getCollections } = require("../config/db");

// The client's own-import range — the five products they asked to advertise.
const HERO = [
  "Chinese Herbal Hair Nourishing Liquid",
  "Chinese Herbal Facial Mask Cream",
  "Chinese Herbal Shower Gel",
  "Chinese Herbal Shampoo – Green",
  "Chinese Herbal Shampoo – Red",
];

const run = async () => {
  await connectDb();
  const { products } = getCollections();

  // Clear first, then set. Without the clear, a product the client had
  // previously featured would stay in the hero alongside the new five and the
  // carousel would quietly run long.
  await products.updateMany({}, { $set: { featured: false } });

  const result = await products.updateMany(
    { name: { $in: HERO } },
    { $set: { featured: true, updatedAt: new Date() } },
  );

  console.log(`Featured ${result.modifiedCount} of ${HERO.length} named products`);

  if (result.modifiedCount !== HERO.length) {
    // Names are matched exactly, including the en-dash in the two shampoos, so
    // a shortfall means the catalogue does not hold what this script expects.
    const found = await products
      .find({ name: { $in: HERO } }, { projection: { name: 1 } })
      .toArray();
    const missing = HERO.filter((name) => !found.some((doc) => doc.name === name));
    console.warn("  Not found in the catalogue:", missing);
  }

  await closeDb();
};

run().catch((error) => {
  console.error("Failed:", error.message);
  process.exit(1);
});
