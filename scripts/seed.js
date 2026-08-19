/* ---------------------------------------------------------------------------
   Seeds the real Azmain BD catalogue.

   Every product here is stock the client actually sells, taken from the
   product list they supplied. Nothing is invented — where the client has not
   fixed a price yet, price is null and the storefront shows "Price on request"
   with a WhatsApp button instead of an amount.

   Safe to re-run: products and categories are replaced wholesale, but users
   and sales are never touched, so admin roles and the sales ledger survive.

   Usage:  npm run seed
--------------------------------------------------------------------------- */

const { connectDb, getCollections, closeDb } = require("../config/db");

const UNSPLASH = (id) => `https://images.unsplash.com/${id}?w=900&q=80`;

const CATEGORIES = [
  { name: "Hair Care", slug: "hair-care", image: UNSPLASH("photo-1595475207225-428b62bda831") },
  { name: "Body Care", slug: "body-care", image: UNSPLASH("photo-1556228720-195a672e8a03") },
  { name: "Skin Care", slug: "skin-care", image: UNSPLASH("photo-1570172619644-dfd03ed5d881") },
  { name: "Herbal Soap", slug: "herbal-soap", image: UNSPLASH("photo-1600857544200-b2f666a9a2ec") },
  { name: "Oral Care", slug: "oral-care", image: UNSPLASH("photo-1607613009820-a29f7bb81c04") },
];

/* The catalogue. `price: null` means the client has not set a price yet, which
   the storefront renders as "Price on request" — never as free. */
const PRODUCTS = [
  {
    name: "OGX Renewing+ Argan Oil of Morocco Shampoo",
    category: "hair-care",
    brand: "OGX",
    price: 1050,
    oldPrice: null,
    stock: 24,
    specs: ["385 ml", "No Sulphates", "No Parabens", "pH Balanced"],
    variants: ["385 ml"],
    customFields: [
      { label: "Product Type", value: "Hair Care / Shampoo" },
      { label: "Key Ingredient", value: "Argan Oil of Morocco" },
      { label: "Best For", value: "Damaged, dry hair" },
    ],
    description:
      "OGX Argan Oil of Morocco Shampoo is designed to nourish and repair the appearance of damaged, dry hair. Enriched with argan oil, it helps leave hair looking smoother, softer, and shinier.",
    image: UNSPLASH("photo-1631729371254-42c2892f0e6e"),
  },
  {
    name: "OGX Strength & Length+ Keratin Oil Shampoo",
    category: "hair-care",
    brand: "OGX",
    price: 1050,
    oldPrice: null,
    stock: 18,
    specs: ["385 ml", "No Sulphates", "No Parabens", "pH Balanced"],
    variants: ["385 ml"],
    customFields: [
      { label: "Product Type", value: "Hair Care / Shampoo" },
      { label: "Key Ingredient", value: "Keratin Proteins" },
      { label: "Best For", value: "Weak hair, breakage" },
    ],
    description:
      "OGX Keratin Oil Shampoo is formulated for hair that needs strength and shine. The keratin oil formula helps nourish the hair and supports a smoother, healthier-looking appearance while cleansing the scalp and hair.",
    image: UNSPLASH("photo-1608248543803-ba4f8c70ae0b"),
  },
  {
    name: "Chinese Herbal Hair Nourishing Liquid",
    category: "hair-care",
    brand: "Chinese Herbal",
    price: null,
    oldPrice: null,
    stock: 15,
    specs: ["100 ml", "Herbal Formula", "All Hair Types"],
    variants: ["100 ml"],
    customFields: [
      { label: "Product Type", value: "Hair Nourishing Treatment / Hair Serum" },
      { label: "Benefits", value: "Nourishes roots, promotes growth" },
    ],
    description:
      "A lightweight herbal hair treatment designed to nourish and strengthen the hair. It helps improve the appearance of dry or dull hair and leaves hair feeling smoother and healthier.",
    image: UNSPLASH("photo-1620916566398-39f1143ab7be"),
  },
  {
    name: "Chinese Herbal Shampoo — Green",
    category: "hair-care",
    brand: "Chinese Herbal",
    price: null,
    oldPrice: null,
    stock: 20,
    specs: ["300 ml", "Gentle Cleansing", "Herbal Formula", "All Hair Types"],
    variants: ["300 ml"],
    customFields: [
      { label: "Product Type", value: "Herbal Shampoo" },
      { label: "Variant", value: "Green — Natural Care" },
    ],
    description:
      "A botanical herbal shampoo designed for gentle cleansing and hair nourishment. Its herbal-inspired formula helps maintain a clean, refreshed scalp and healthy-looking hair.",
    image: UNSPLASH("photo-1626015449072-2a4ba0e6ad06"),
  },
  {
    name: "Chinese Herbal Shampoo — Red",
    category: "hair-care",
    brand: "Chinese Herbal",
    price: null,
    oldPrice: null,
    stock: 20,
    specs: ["300 ml", "Strengthens Hair", "Nourishes Scalp", "All Hair Types"],
    variants: ["300 ml"],
    customFields: [
      { label: "Product Type", value: "Herbal Shampoo" },
      { label: "Variant", value: "Red — Healthy Scalp" },
    ],
    description:
      "A gentle Chinese herbal shampoo formulated for everyday hair care. It helps cleanse the scalp, nourish the hair, and keep hair feeling fresh, smooth, and healthy.",
    image: UNSPLASH("photo-1585232004423-244e0e6904e3"),
  },
  {
    name: "Pantene Pro-V Oil Replacement",
    category: "hair-care",
    brand: "Pantene",
    price: 600,
    oldPrice: null,
    stock: 30,
    specs: ["Vitamins B, C & E", "Non-greasy", "Leave-on"],
    variants: ["Milky Damage Repair", "Daily Care"],
    customFields: [
      { label: "Product Type", value: "Hair Care / Leave-on Cream" },
      { label: "Benefits", value: "Repairs damage, daily care" },
    ],
    description:
      "Nourishing leave-on hair cream enriched with Vitamins B, C, and E, formulated to repair hair damage and provide daily hair care without greasiness.",
    image: UNSPLASH("photo-1571781926291-c477ebfd024b"),
  },
  {
    name: "L’Oréal Paris Elvive Extraordinary Oil Nourishing Conditioner",
    category: "hair-care",
    brand: "L’Oréal Paris",
    price: 740,
    oldPrice: null,
    stock: 26,
    specs: ["Flower Oils", "Normal to Dry Hair"],
    variants: ["Normal to Dry Hair"],
    customFields: [
      { label: "Product Type", value: "Hair Care / Conditioner" },
      { label: "Benefits", value: "Soft, shiny, manageable hair" },
    ],
    description:
      "A deeply nourishing hair conditioner formulated with flower oils for normal to dry hair, designed to leave hair soft, shiny, and manageable.",
    image: UNSPLASH("photo-1608571423902-eed4a5ad8108"),
  },
  {
    name: "Herbal Essences bio:renew Shampoo",
    category: "hair-care",
    brand: "Herbal Essences",
    price: 850,
    oldPrice: null,
    stock: 22,
    specs: ["90% Natural Origin", "0% Parabens", "0% Colourants", "0% Silicones"],
    variants: ["Argan Oil of Morocco", "White Strawberry & Mint"],
    customFields: [
      { label: "Product Type", value: "Hair Care / Shampoo" },
      { label: "Free From", value: "Parabens, colourants, silicones" },
    ],
    description:
      "Shampoos designed for hair care — the blue bottles feature Argan Oil of Morocco for repairing damaged hair, while the clear pink bottle features White Strawberry & Mint with 0% parabens, colourants, or silicones for a gentle clean.",
    image: UNSPLASH("photo-1626015449072-2a4ba0e6ad06"),
  },
  {
    name: "NIVEA Smooth Sensation Body Lotion",
    category: "body-care",
    brand: "NIVEA",
    price: 950,
    oldPrice: null,
    stock: 28,
    specs: ["48h Moisture", "Dry Skin", "Non-Greasy", "Dermatologically Tested"],
    variants: ["Dry Skin"],
    customFields: [
      { label: "Product Type", value: "Body Care / Body Lotion" },
      { label: "Moisture", value: "48h+" },
    ],
    description:
      "NIVEA Smooth Sensation Body Lotion provides long-lasting moisture and helps keep dry skin feeling soft and smooth. Its moisturizing formula is designed for everyday use and leaves skin feeling comfortable and cared for.",
    image: UNSPLASH("photo-1611930022073-b7a4ba5fcccd"),
  },
  {
    name: "NIVEA Cocoa Nourish Body Lotion",
    category: "body-care",
    brand: "NIVEA",
    price: 950,
    oldPrice: null,
    stock: 25,
    specs: ["48h Moisture", "Cocoa Butter", "Non-Greasy", "Dermatologically Tested"],
    variants: ["Dry Skin"],
    customFields: [
      { label: "Product Type", value: "Body Care / Body Lotion" },
      { label: "Key Ingredient", value: "Cocoa Butter" },
    ],
    description:
      "NIVEA Cocoa Nourish Body Lotion is designed for dry skin, providing intensive moisture while helping leave the skin feeling soft and nourished. Enriched with cocoa-inspired care, it is suitable for everyday body moisturizing.",
    image: UNSPLASH("photo-1608248597279-f99d160bfcbc"),
  },
  {
    name: "NIVEA Rich Nourishing Body Lotion — 72H Moisture",
    category: "body-care",
    brand: "NIVEA",
    price: 950,
    oldPrice: null,
    stock: 4,
    specs: ["72h Moisture", "Very Dry Skin", "Non-Greasy", "Dermatologically Tested"],
    variants: ["Very Dry Skin"],
    customFields: [
      { label: "Product Type", value: "Body Care / Body Lotion" },
      { label: "Moisture", value: "72h — Intense Care" },
    ],
    description:
      "NIVEA Rich Nourishing Body Lotion provides up to 72-hour moisture for very dry skin. Its rich moisturizing formula helps nourish dry skin and leaves it feeling soft, smooth, and healthy-looking.",
    image: UNSPLASH("photo-1585232351009-aa87416fca90"),
  },
  {
    name: "Chinese Herbal Shower Gel",
    category: "body-care",
    brand: "Chinese Herbal",
    price: null,
    oldPrice: null,
    stock: 16,
    specs: ["500 ml", "Deep Cleansing", "Moisturizing", "All Skin Types"],
    variants: ["500 ml"],
    customFields: [
      { label: "Product Type", value: "Herbal Shower Gel / Body Wash" },
      { label: "Benefits", value: "Refreshing daily cleanse" },
    ],
    description:
      "A refreshing herbal shower gel designed for daily body cleansing. It gently removes dirt and impurities while leaving the skin feeling clean, refreshed, and moisturized.",
    image: UNSPLASH("photo-1600857544200-b2f666a9a2ec"),
  },
  {
    name: "Chinese Herbal Facial Mask Cream",
    category: "skin-care",
    brand: "Chinese Herbal",
    price: null,
    oldPrice: null,
    stock: 12,
    specs: ["50 g", "Deep Nourishment", "Brightens Skin", "All Skin Types"],
    variants: ["50 g"],
    customFields: [
      { label: "Product Type", value: "Facial Mask / Skincare Cream" },
      { label: "Benefits", value: "Nourishes, revitalizes, brightens" },
    ],
    description:
      "A nourishing herbal facial mask cream designed to care for the skin. It helps provide moisture and nourishment while leaving the skin feeling soft, refreshed, and revitalized.",
    image: UNSPLASH("photo-1570172619644-dfd03ed5d881"),
  },
  {
    name: "VICA Premium Herbal Soap",
    category: "herbal-soap",
    brand: "VICA",
    price: 450,
    oldPrice: null,
    stock: 40,
    specs: ["Handmade", "Natural Ingredients", "Skin Softening"],
    variants: ["Original"],
    customFields: [
      { label: "Product Type", value: "Herbal Bar Soap" },
      { label: "Made With", value: "Natural essential oils & herbal extracts" },
    ],
    description:
      "A handmade, natural herbal soap bar enriched with natural essential oils and herbal extracts, formulated for skin softening.",
    image: UNSPLASH("photo-1600857544200-b2f666a9a2ec"),
  },
  {
    name: "VICA Premium Herbal Soap (Charcoal Lavender)",
    category: "herbal-soap",
    brand: "VICA",
    price: 480,
    oldPrice: null,
    stock: 35,
    specs: ["Handmade", "Charcoal & Lavender", "All Skin Types"],
    variants: ["Charcoal Lavender"],
    customFields: [
      { label: "Product Type", value: "Herbal Bar Soap" },
      { label: "Benefits", value: "Nourish & deep-cleanse" },
    ],
    description:
      "A handmade, pure, and natural herbal soap bar combining charcoal and lavender, formulated for all skin types to nourish and deep-cleanse.",
    image: UNSPLASH("photo-1607006677169-a1d0d3e2fa9c"),
  },
  {
    name: "VICA Premium Herbal Soap (Natural Gulab Rose)",
    category: "herbal-soap",
    brand: "VICA",
    price: 490,
    oldPrice: null,
    stock: 5,
    specs: ["Handmade", "Gulab Rose", "All Skin Types"],
    variants: ["Gulab Rose"],
    customFields: [
      { label: "Product Type", value: "Herbal Bar Soap" },
      { label: "Made With", value: "Natural essential oils & herbal extracts" },
    ],
    description:
      "A handmade, natural herbal soap bar enriched with natural essential oils and herbal extracts, formulated for skin softening.",
    image: UNSPLASH("photo-1584305574647-0cc949a2bb9f"),
  },
  {
    name: "Sensodyne Whitening Toothpaste (4 Pack)",
    category: "oral-care",
    brand: "Sensodyne",
    price: 3400,
    oldPrice: null,
    stock: 14,
    specs: ["4 x 145 ml", "24/7 Sensitivity Protection", "Whitening"],
    variants: ["4 Pack"],
    customFields: [
      { label: "Product Type", value: "Oral Care / Toothpaste" },
      { label: "Pack Size", value: "4 x 145 ml" },
      { label: "Benefits", value: "Strong teeth, healthy gums, whitening" },
    ],
    description:
      "A multi-pack (4 x 145 mL) of daily sensitivity protection toothpaste designed for strong teeth, healthy gums, and whitening action.",
    image: UNSPLASH("photo-1607613009820-a29f7bb81c04"),
  },
];

const seed = async () => {
  await connectDb();
  const { products, categories } = getCollections();

  await categories.deleteMany({});
  await categories.insertMany(
    CATEGORIES.map((category) => ({ ...category, createdAt: new Date() })),
  );

  await products.deleteMany({});

  const now = Date.now();

  const docs = PRODUCTS.map((product, index) => ({
    ...product,
    rating: 0,
    reviews: 0,
    soldCount: 0,
    // Spread creation dates so "newest first" produces a stable, sensible
    // order rather than an arbitrary one from identical timestamps.
    createdAt: new Date(now - index * 36e5),
    updatedAt: new Date(now - index * 36e5),
  }));

  await products.insertMany(docs);

  const priced = docs.filter((doc) => doc.price !== null).length;
  const lowStock = docs.filter((doc) => doc.stock > 0 && doc.stock <= 6).length;

  console.log(`Seeded ${CATEGORIES.length} categories and ${docs.length} products`);
  console.log(`  ${priced} priced, ${docs.length - priced} price-on-request, ${lowStock} low stock`);
  console.log("  users and sales collections were not touched");

  await closeDb();
};

seed().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
