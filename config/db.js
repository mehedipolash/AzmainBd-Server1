const { MongoClient, ServerApiVersion, GridFSBucket } = require("mongodb");
const { dbUser, dbPass, dbName, dbHost } = require("./env");

// Credentials are URL-encoded — a password containing @ or / silently corrupts
// the connection string otherwise, producing a confusing auth failure.
//
// The cluster host comes from the environment (DB_HOST), so moving to a
// different MongoDB account — the client's own — is a config change, never a
// code change: only .env is edited, this file stays untouched.
const uri = `mongodb+srv://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPass)}@${dbHost}/?appName=Cluster0`;

// strict:false — Stable API strict mode rejects commands outside its list,
// including createIndex, which we need for the uniqueness guarantees below.
// Version pinning and deprecation warnings are kept.
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

let collections = null;
let imageBucket = null;

const connectDb = async () => {
  await client.connect();
  await client.db("admin").command({ ping: 1 });

  const db = client.db(dbName);

  // Product photos live in GridFS rather than as base64 inside the product
  // document. A 16MB BSON cap would otherwise be shared between the image and
  // every other field, and every product query would drag the image bytes
  // along even when only the name and price are needed.
  imageBucket = new GridFSBucket(db, { bucketName: "productImages" });

  collections = {
    products: db.collection("products"),
    categories: db.collection("categories"),
    users: db.collection("users"),
    orders: db.collection("orders"),
    banners: db.collection("banners"),
    sales: db.collection("sales"),
  };

  // Indexes enforce uniqueness at the database level, so a race between two
  // concurrent requests cannot create duplicate users or category slugs.
  await Promise.all([
    collections.users.createIndex({ uid: 1 }, { unique: true }),
    collections.users.createIndex({ email: 1 }),
    collections.categories.createIndex({ slug: 1 }, { unique: true }),
    collections.products.createIndex({ category: 1 }),
    collections.products.createIndex({ createdAt: -1 }),
    collections.sales.createIndex({ soldAt: -1 }),
    collections.sales.createIndex({ productId: 1 }),
    // Text index powers search without a full collection scan.
    collections.products.createIndex({ name: "text", description: "text", brand: "text" }),
  ]);

  console.log(`Connected to MongoDB (database: ${dbName})`);
  return collections;
};

const getImageBucket = () => {
  if (!imageBucket) {
    throw new Error("Database not connected — call connectDb() first");
  }
  return imageBucket;
};

const getCollections = () => {
  if (!collections) {
    throw new Error("Database not connected — call connectDb() first");
  }
  return collections;
};

const closeDb = () => client.close();

module.exports = { connectDb, getCollections, getImageBucket, closeDb, client };
