/* ---------------------------------------------------------------------------
   One-off migration: copy the whole shop from one MongoDB cluster to another.

   Used when moving to the client's own Atlas account — the new cluster starts
   empty, and this brings the existing catalogue across so the owner does not
   have to re-enter every product. It copies the document collections AND the
   GridFS image bucket (the product photos), because a product whose image was
   left behind would render broken.

   SAFETY
   - Reads from SOURCE, writes to TARGET. It never deletes or modifies the
     source, so the old database is untouched and remains a fallback.
   - Refuses to run if SOURCE and TARGET point at the same host, so it can never
     copy a cluster onto itself.
   - By default it SKIPS a collection that already has documents in the target,
     so re-running does not duplicate data. Pass --overwrite to clear a target
     collection first (use with care).

   CREDENTIALS — never hard-coded. Both connection strings come from the
   environment, so no secret lives in this file or in git:

     MIGRATE_SOURCE_URI=mongodb+srv://user:pass@old-cluster.mongodb.net
     MIGRATE_TARGET_URI=mongodb+srv://user:pass@new-cluster.mongodb.net

   Set them for THIS command only (they are read here, nowhere else). Example
   (PowerShell):
     $env:MIGRATE_SOURCE_URI="..."; $env:MIGRATE_TARGET_URI="..."; npm run migrate-data

   Usage:  npm run migrate-data            (skip already-populated collections)
           npm run migrate-data -- --overwrite   (replace target collections)
--------------------------------------------------------------------------- */

const { MongoClient, GridFSBucket } = require("mongodb");

const DB_NAME = process.env.DB_NAME ?? "AzmainBd";
const COLLECTIONS = ["categories", "products", "banners", "sales", "users", "orders"];
const IMAGE_BUCKET = "productImages";
const overwrite = process.argv.includes("--overwrite");

const need = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`\nMissing ${name}. Set MIGRATE_SOURCE_URI and MIGRATE_TARGET_URI first.\n`);
    process.exit(1);
  }
  return value;
};

const hostOf = (uri) => {
  const m = uri.match(/@([^/?]+)/);
  return m ? m[1] : uri;
};

// The TARGET is the cluster the app is currently configured for (the new one),
// built from the normal .env so it never has to be typed twice. Only the SOURCE
// (the old cluster being migrated away from) is supplied explicitly.
const targetFromEnv = () => {
  require("dotenv").config();
  const { DB_USER, DB_PASS, DB_HOST } = process.env;
  if (!DB_USER || !DB_PASS || !DB_HOST) return null;
  return `mongodb+srv://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASS)}@${DB_HOST}/?appName=Cluster0`;
};

const run = async () => {
  const sourceUri = need("MIGRATE_SOURCE_URI");
  const targetUri = process.env.MIGRATE_TARGET_URI || targetFromEnv();

  if (!targetUri) {
    console.error("\nNo target. Set MIGRATE_TARGET_URI, or fill DB_USER/DB_PASS/DB_HOST in .env.\n");
    process.exit(1);
  }

  if (hostOf(sourceUri) === hostOf(targetUri)) {
    console.error("\nSOURCE and TARGET are the same cluster — refusing to run.\n");
    process.exit(1);
  }

  console.log(`\nMigrating "${DB_NAME}"`);
  console.log(`  from  ${hostOf(sourceUri)}`);
  console.log(`  to    ${hostOf(targetUri)}`);
  console.log(overwrite ? "  mode  OVERWRITE target collections\n" : "  mode  skip non-empty target collections\n");

  const source = new MongoClient(sourceUri);
  const target = new MongoClient(targetUri);

  try {
    await source.connect();
    await target.connect();
    const sdb = source.db(DB_NAME);
    const tdb = target.db(DB_NAME);

    // ---- document collections ----
    for (const name of COLLECTIONS) {
      const scoll = sdb.collection(name);
      const tcoll = tdb.collection(name);

      const docs = await scoll.find({}).toArray();
      if (docs.length === 0) {
        console.log(`  ${name}: source empty, skipped`);
        continue;
      }

      const existing = await tcoll.countDocuments();
      if (existing > 0 && !overwrite) {
        console.log(`  ${name}: target already has ${existing} — skipped (use --overwrite to replace)`);
        continue;
      }
      if (existing > 0 && overwrite) {
        await tcoll.deleteMany({});
      }

      // Preserve _id so references between collections (product.category slug,
      // image ids on products) still line up after the move.
      await tcoll.insertMany(docs, { ordered: false });
      console.log(`  ${name}: copied ${docs.length}`);
    }

    // ---- GridFS images ----
    await migrateGridFs(sdb, tdb);

    console.log("\nMigration complete. Verify the new site, then you can retire the old cluster.\n");
  } catch (error) {
    console.error("\nMigration failed:", error.message, "\n");
    process.exitCode = 1;
  } finally {
    await source.close();
    await target.close();
  }
};

// Streams every stored image (files + chunks) from the source bucket into the
// target bucket, keeping the same _id so product documents still point at them.
const migrateGridFs = async (sdb, tdb) => {
  const filesColl = sdb.collection(`${IMAGE_BUCKET}.files`);
  const files = await filesColl.find({}).toArray();

  if (files.length === 0) {
    console.log(`  images: none in source`);
    return;
  }

  const targetFiles = tdb.collection(`${IMAGE_BUCKET}.files`);
  const already = await targetFiles.countDocuments();
  if (already > 0 && !overwrite) {
    console.log(`  images: target already has ${already} — skipped (use --overwrite to replace)`);
    return;
  }
  if (already > 0 && overwrite) {
    await targetFiles.deleteMany({});
    await tdb.collection(`${IMAGE_BUCKET}.chunks`).deleteMany({});
  }

  const sourceBucket = new GridFSBucket(sdb, { bucketName: IMAGE_BUCKET });
  const targetBucket = new GridFSBucket(tdb, { bucketName: IMAGE_BUCKET });

  let done = 0;
  for (const file of files) {
    await new Promise((resolve, reject) => {
      const upload = targetBucket.openUploadStreamWithId(file._id, file.filename, {
        contentType: file.contentType,
        metadata: file.metadata,
      });
      sourceBucket
        .openDownloadStream(file._id)
        .pipe(upload)
        .on("finish", resolve)
        .on("error", reject);
    });
    done += 1;
  }

  console.log(`  images: copied ${done}`);
};

run();
