/* ---------------------------------------------------------------------------
   Repairs products whose category slug no longer matches any category.

   A product references its category by slug. Renaming a category used to
   regenerate that slug without moving the products across, so every product in
   the renamed category was left pointing at a slug nothing resolves — present
   in the database, but invisible to the shop's category filter. That is fixed
   at the source now (categories PATCH carries its products with it), but any
   product orphaned before the fix still needs putting back.

   The match is made on the slugified category NAME, which is what the old slug
   was generated from. Anything that cannot be matched confidently is reported
   rather than guessed at — moving a product into the wrong category silently is
   worse than leaving it to be placed by hand.

   Usage:  npm run fix-categories          (report only)
           npm run fix-categories -- --apply
--------------------------------------------------------------------------- */

const { connectDb, getCollections, closeDb } = require("../config/db");
const { slugify } = require("../utils/validate");

const run = async () => {
  const apply = process.argv.includes("--apply");

  await connectDb();
  const { products, categories } = getCollections();

  const categoryList = await categories.find({}).toArray();
  const knownSlugs = new Set(categoryList.map((category) => category.slug));

  const used = await products.distinct("category");
  const orphanSlugs = used.filter((slug) => !knownSlugs.has(slug));

  if (orphanSlugs.length === 0) {
    console.log("\nEvery product points at a category that exists. Nothing to do.\n");
    await closeDb();
    return;
  }

  console.log(`\nFound ${orphanSlugs.length} category slug(s) with no matching category:\n`);

  let moved = 0;
  const unmatched = [];

  for (const orphan of orphanSlugs) {
    const count = await products.countDocuments({ category: orphan });

    // The old slug came from slugify(name), so a category whose name still
    // contains the orphan slug is almost certainly the one it was renamed from
    // — "bangles" -> "Glass Bangles" -> "glass-bangles".
    const candidates = categoryList.filter((category) => {
      const slug = slugify(category.name);
      return slug === orphan || slug.includes(orphan) || orphan.includes(slug);
    });

    if (candidates.length !== 1) {
      unmatched.push({ orphan, count, candidates: candidates.map((c) => c.name) });
      console.log(
        `  "${orphan}" (${count} product${count === 1 ? "" : "s"}) -> ` +
          (candidates.length === 0
            ? "no obvious match, leave for manual placement"
            : `ambiguous: ${candidates.map((c) => c.name).join(", ")}`),
      );
      continue;
    }

    const target = candidates[0];
    console.log(
      `  "${orphan}" (${count} product${count === 1 ? "" : "s"}) -> "${target.slug}" (${target.name})`,
    );

    if (apply) {
      const result = await products.updateMany(
        { category: orphan },
        { $set: { category: target.slug, updatedAt: new Date() } },
      );
      moved += result.modifiedCount;
    }
  }

  if (apply) {
    console.log(`\nMoved ${moved} product(s).`);
  } else {
    console.log("\nReport only. Re-run with --apply to make these changes.");
  }

  if (unmatched.length > 0) {
    console.log(
      `\n${unmatched.length} slug(s) need placing by hand in the admin panel.`,
    );
  }

  console.log("");
  await closeDb();
};

run().catch(async (error) => {
  console.error("Failed:", error.message);
  await closeDb().catch(() => {});
  process.exit(1);
});
