const { MongoClient, ServerApiVersion } = require("mongodb");
const { dbUser, dbPass, dbName } = require("./env");

// Credentials are URL-encoded — a password containing @ or / silently corrupts
// the connection string otherwise, producing a confusing auth failure.
const uri = `mongodb+srv://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPass)}@cluster0.azj20jt.mongodb.net/?appName=Cluster0`;

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

const connectDb = async () => {
  await client.connect();
  await client.db("admin").command({ ping: 1 });

  const db = client.db(dbName);

  collections = {
    products: db.collection("products"),
    categories: db.collection("categories"),
    users: db.collection("users"),
    orders: db.collection("orders"),
    banners: db.collection("banners"),
  };

  // Indexes enforce uniqueness at the database level, so a race between two
  // concurrent requests cannot create duplicate users or category slugs.
  await Promise.all([
    collections.users.createIndex({ uid: 1 }, { unique: true }),
    collections.users.createIndex({ email: 1 }),
    collections.categories.createIndex({ slug: 1 }, { unique: true }),
    collections.products.createIndex({ category: 1 }),
    collections.products.createIndex({ createdAt: -1 }),
    // Text index powers search without a full collection scan.
    collections.products.createIndex({ name: "text", description: "text", brand: "text" }),
  ]);

  console.log(`Connected to MongoDB (database: ${dbName})`);
  return collections;
};

const getCollections = () => {
  if (!collections) {
    throw new Error("Database not connected — call connectDb() first");
  }
  return collections;
};

const closeDb = () => client.close();

module.exports = { connectDb, getCollections, closeDb, client };
