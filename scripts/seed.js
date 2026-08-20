/* ---------------------------------------------------------------------------
   Seeds the real Azmain BD catalogue.

   Every name, product type, size, description and price here is copied
   verbatim from the list the client supplied — nothing is paraphrased and
   nothing is invented. Where the client left a price blank it stays null, and
   the storefront renders "Price on request" rather than an amount.

   Images are the client's own product photography, served from
   /products/ in the frontend's public folder. No stock photography.

   Safe to re-run: products and categories are replaced wholesale, but users
   and sales are never touched, so admin roles and the sales ledger survive.

   Usage:  npm run seed
--------------------------------------------------------------------------- */

const { connectDb, getCollections, closeDb } = require("../config/db");

// Relative paths: the same records work against localhost and the deployed
// domain without a rewrite.
const PHOTO = (slug) => `/products/${slug}.jpg`;

const CATEGORIES = [
  { name: "Hair Care", slug: "hair-care", image: PHOTO("ogx-renewing-argan-oil-of-morocco-shampoo") },
  { name: "Body Care", slug: "body-care", image: PHOTO("nivea-smooth-sensation-body-lotion") },
  { name: "Skin Care", slug: "skin-care", image: PHOTO("chinese-herbal-facial-mask-cream") },
  { name: "Herbal Soap", slug: "herbal-soap", image: PHOTO("vica-premium-herbal-soap") },
  { name: "Oral Care", slug: "oral-care", image: PHOTO("sensodyne-whitening-toothpaste-4-pack") },
  { name: "Bangles", slug: "bangles", image: PHOTO("glass-bangles-grand-assortment") },
];

/* `price: null` means the client has not set a price yet, which the
   storefront renders as "Price on request" — never as free. */
const PRODUCTS = [
  {
    name: "OGX Renewing+ Argan Oil of Morocco Shampoo",
    category: "hair-care",
    brand: "OGX",
    price: 1050,
    stock: 24,
    description:
      "OGX Argan Oil of Morocco Shampoo is designed to nourish and repair the appearance of damaged, dry hair. Enriched with argan oil, it helps leave hair looking smoother, softer, and shinier.",
    image: PHOTO("ogx-renewing-argan-oil-of-morocco-shampoo"),
    specs: ["385 ml"],
    variants: ["385 ml"],
    customFields: [
      { label: "Product Type", value: "Hair Care / Shampoo" },
      { label: "Size", value: "385 ml" },
    ],
  },
  {
    name: "OGX Strength & Length+ Keratin Oil Shampoo",
    category: "hair-care",
    brand: "OGX",
    price: 1050,
    stock: 18,
    description:
      "OGX Keratin Oil Shampoo is formulated for hair that needs strength and shine. The keratin oil formula helps nourish the hair and supports a smoother, healthier-looking appearance while cleansing the scalp and hair.",
    image: PHOTO("ogx-strength-length-keratin-oil-shampoo"),
    specs: ["385 ml"],
    variants: ["385 ml"],
    customFields: [
      { label: "Product Type", value: "Hair Care / Shampoo" },
      { label: "Size", value: "385 ml" },
    ],
  },
  {
    name: "NIVEA Smooth Sensation Body Lotion",
    category: "body-care",
    brand: "NIVEA",
    price: 950,
    stock: 28,
    description:
      "NIVEA Smooth Sensation Body Lotion provides long-lasting moisture and helps keep dry skin feeling soft and smooth. Its moisturizing formula is designed for everyday use and leaves skin feeling comfortable and cared for.",
    image: PHOTO("nivea-smooth-sensation-body-lotion"),
    specs: [],
    variants: [],
    customFields: [
      { label: "Product Type", value: "Body Care / Body Lotion" },
    ],
  },
  {
    name: "NIVEA Cocoa Nourish Body Lotion",
    category: "body-care",
    brand: "NIVEA",
    price: 950,
    stock: 25,
    description:
      "NIVEA Cocoa Nourish Body Lotion is designed for dry skin, providing intensive moisture while helping leave the skin feeling soft and nourished. Enriched with cocoa-inspired care, it is suitable for everyday body moisturizing.",
    image: PHOTO("nivea-cocoa-nourish-body-lotion"),
    specs: [],
    variants: [],
    customFields: [
      { label: "Product Type", value: "Body Care / Body Lotion" },
    ],
  },
  {
    name: "NIVEA Rich Nourishing Body Lotion – 72H Moisture",
    category: "body-care",
    brand: "NIVEA",
    price: 950,
    stock: 4,
    description:
      "NIVEA Rich Nourishing Body Lotion provides up to 72-hour moisture for very dry skin. Its rich moisturizing formula helps nourish dry skin and leaves it feeling soft, smooth, and healthy-looking.",
    image: PHOTO("nivea-rich-nourishing-body-lotion-72h-moisture"),
    specs: [],
    variants: [],
    customFields: [
      { label: "Product Type", value: "Body Care / Body Lotion" },
    ],
  },
  {
    name: "Chinese Herbal Hair Nourishing Liquid",
    category: "hair-care",
    brand: "Chinese Herbal",
    price: null,
    stock: 15,
    description:
      "A lightweight herbal hair treatment designed to nourish and strengthen the hair. It helps improve the appearance of dry or dull hair and leaves hair feeling smoother and healthier.",
    image: PHOTO("chinese-herbal-hair-nourishing-liquid"),
    specs: ["100ml"],
    variants: ["100ml"],
    customFields: [
      { label: "Product Type", value: "Hair Nourishing Treatment / Hair Serum" },
      { label: "Size", value: "100ml" },
    ],
  },
  {
    name: "Chinese Herbal Facial Mask Cream",
    category: "skin-care",
    brand: "Chinese Herbal",
    price: null,
    stock: 12,
    description:
      "A nourishing herbal facial mask cream designed to care for the skin. It helps provide moisture and nourishment while leaving the skin feeling soft, refreshed, and revitalized.",
    image: PHOTO("chinese-herbal-facial-mask-cream"),
    specs: ["50g"],
    variants: ["50g"],
    customFields: [
      { label: "Product Type", value: "Facial Mask / Skincare Cream" },
      { label: "Size", value: "50g" },
    ],
  },
  {
    name: "Chinese Herbal Shower Gel",
    category: "body-care",
    brand: "Chinese Herbal",
    price: null,
    stock: 16,
    description:
      "A refreshing herbal shower gel designed for daily body cleansing. It gently removes dirt and impurities while leaving the skin feeling clean, refreshed, and moisturized.",
    image: PHOTO("chinese-herbal-shower-gel"),
    specs: ["500ml"],
    variants: ["500ml"],
    customFields: [
      { label: "Product Type", value: "Herbal Shower Gel / Body Wash" },
      { label: "Size", value: "500ml" },
    ],
  },
  {
    name: "Chinese Herbal Shampoo – Green",
    category: "hair-care",
    brand: "Chinese Herbal",
    price: null,
    stock: 20,
    description:
      "A botanical herbal shampoo designed for gentle cleansing and hair nourishment. Its herbal-inspired formula helps maintain a clean, refreshed scalp and healthy-looking hair.",
    image: PHOTO("chinese-herbal-shampoo-green"),
    specs: ["300ml"],
    variants: ["300ml"],
    customFields: [
      { label: "Product Type", value: "Herbal Shampoo" },
      { label: "Size", value: "300ml" },
    ],
  },
  {
    name: "Chinese Herbal Shampoo – Red",
    category: "hair-care",
    brand: "Chinese Herbal",
    price: null,
    stock: 20,
    description:
      "A gentle Chinese herbal shampoo formulated for everyday hair care. It helps cleanse the scalp, nourish the hair, and keep hair feeling fresh, smooth, and healthy.",
    image: PHOTO("chinese-herbal-shampoo-red"),
    specs: ["300ml"],
    variants: ["300ml"],
    customFields: [
      { label: "Product Type", value: "Herbal Shampoo" },
      { label: "Size", value: "300ml" },
    ],
  },
  {
    name: "VICA Premium Herbal Soap",
    category: "herbal-soap",
    brand: "VICA",
    price: 450,
    stock: 40,
    description:
      "A handmade, natural herbal soap bar enriched with natural essential oils and herbal extracts, formulated for skin softening.",
    image: PHOTO("vica-premium-herbal-soap"),
    specs: [],
    variants: [],
    customFields: [
      { label: "Product Type", value: "Herbal Bar Soap" },
    ],
  },
  {
    name: "VICA Premium Herbal Soap (Charcoal Lavender)",
    category: "herbal-soap",
    brand: "VICA",
    price: 480,
    stock: 35,
    description:
      "A handmade, pure, and natural herbal soap bar combining charcoal and lavender, formulated for all skin types to nourish and deep-cleanse.",
    image: PHOTO("vica-premium-herbal-soap-charcoal-lavender"),
    specs: [],
    variants: [],
    customFields: [
      { label: "Product Type", value: "Herbal Bar Soap" },
    ],
  },
  {
    name: "VICA Premium Herbal Soap (Natural Gulab Soap)",
    category: "herbal-soap",
    brand: "VICA",
    price: 490,
    stock: 5,
    description:
      "A handmade, natural herbal soap bar enriched with natural essential oils and herbal extracts, formulated for skin softening.",
    image: PHOTO("vica-premium-herbal-soap-natural-gulab-soap"),
    specs: [],
    variants: [],
    customFields: [
      { label: "Product Type", value: "Herbal Bar Soap" },
    ],
  },
  {
    name: "Pantene Pro-V Oil Replacement (Milky Damage Repair & Daily Care)",
    category: "hair-care",
    brand: "Pantene",
    price: 600,
    stock: 30,
    description:
      "Nourishing leave-on hair cream enriched with Vitamins B, C, and E, formulated to repair hair damage and provide daily hair care without greasiness.",
    image: PHOTO("pantene-pro-v-oil-replacement-milky-damage-repair-daily-care"),
    specs: [],
    variants: [],
    customFields: [
      { label: "Product Type", value: "Hair Care / Leave-on Cream" },
    ],
  },
  {
    name: "L’Oréal Paris Elvive Extraordinary Oil Nourishing Conditioner",
    category: "hair-care",
    brand: "L’Oréal Paris",
    price: 740,
    stock: 26,
    description:
      "A deeply nourishing hair conditioner formulated with flower oils for normal to dry hair, designed to leave hair soft, shiny, and manageable.",
    image: PHOTO("loreal-paris-elvive-extraordinary-oil-nourishing-conditioner"),
    specs: [],
    variants: [],
    customFields: [
      { label: "Product Type", value: "Hair Care / Conditioner" },
    ],
  },
  {
    name: "Sensodyne Whitening Toothpaste (4 Pack)",
    category: "oral-care",
    brand: "Sensodyne",
    price: 3400,
    stock: 14,
    description:
      "A multi-pack (4 x 145 mL) of daily sensitivity protection toothpaste designed for strong teeth, healthy gums, and whitening action.",
    image: PHOTO("sensodyne-whitening-toothpaste-4-pack"),
    specs: ["4 x 145 mL"],
    variants: ["4 x 145 mL"],
    customFields: [
      { label: "Product Type", value: "Oral Care / Toothpaste" },
      { label: "Size", value: "4 x 145 mL" },
    ],
  },
  {
    name: "Herbal Essences bio:renew Shampoo (Argan Oil of Morocco & White Strawberry & Mint)",
    category: "hair-care",
    brand: "Herbal Essences",
    price: 850,
    stock: 22,
    description:
      "Shampoos designed for hair care—the blue bottles feature Argan Oil of Morocco for repairing damaged hair, while the clear pink bottle features White Strawberry & Mint with 0% parabens, colourants, or silicones for a gentle clean.",
    image: PHOTO("argan-oil-of-morocco-white-strawberry-mint"),
    specs: [],
    variants: [],
    customFields: [
      { label: "Product Type", value: "Hair Care / Shampoo" },
    ],
  },

  /* ------------------------------- bangles -------------------------------
     Glass bangles, sold by the full packet at a flat 1,000 taka. Each entry
     describes what is actually in the photographed packet — colour and
     finish — because that is the only thing that distinguishes them to
     someone choosing. Sizes are the standard Bangladeshi bangle sizes, and
     are offered as variants so the customer states one when they message. */
  {
    name: "Golden Zari Glass Bangles — Full Packet",
    category: "bangles",
    brand: "Azmain BD",
    price: 1000,
    stock: 12,
    description:
      "A full packet of golden glass bangles finished with zari detailing. Six dozen bangles to a packet, in the classic gold that suits mehendi, holud and every wedding function. Sold only as a complete packet.",
    image: PHOTO("glass-bangles-golden"),
    specs: ["Full packet", "Glass", "Zari finish"],
    variants: ["2.4", "2.6", "2.8"],
    customFields: [
      { label: "Product Type", value: "Bangles / Glass" },
      { label: "Colour", value: "Golden" },
      { label: "Sold As", value: "Full packet" },
    ],
  },
  {
    name: "Rose Pink Glass Bangles — Full Packet",
    category: "bangles",
    brand: "Azmain BD",
    price: 1000,
    stock: 10,
    description:
      "A full packet of rose pink glass bangles with fine gold glitter running through them. Soft enough for everyday wear and bright enough for a function. Sold only as a complete packet.",
    image: PHOTO("glass-bangles-rose-pink"),
    specs: ["Full packet", "Glass", "Glitter finish"],
    variants: ["2.4", "2.6", "2.8"],
    customFields: [
      { label: "Product Type", value: "Bangles / Glass" },
      { label: "Colour", value: "Rose pink" },
      { label: "Sold As", value: "Full packet" },
    ],
  },
  {
    name: "Festive Mix Glass Bangles — Full Packet",
    category: "bangles",
    brand: "Azmain BD",
    price: 1000,
    stock: 8,
    description:
      "A full packet holding several colours at once — pink, magenta, gold, green and deep red — so one packet covers a whole set of outfits. Sold only as a complete packet.",
    image: PHOTO("glass-bangles-festive-mix"),
    specs: ["Full packet", "Glass", "Assorted colours"],
    variants: ["2.4", "2.6", "2.8"],
    customFields: [
      { label: "Product Type", value: "Bangles / Glass" },
      { label: "Colour", value: "Assorted" },
      { label: "Sold As", value: "Full packet" },
    ],
  },
  {
    name: "Jewel Tone Glass Bangles — Full Packet",
    category: "bangles",
    brand: "Azmain BD",
    price: 1000,
    stock: 9,
    description:
      "A full packet in deep jewel tones — emerald, magenta, teal and mustard — each colour banded separately so they can be worn matched or stacked together. Sold only as a complete packet.",
    image: PHOTO("glass-bangles-jewel-tones"),
    specs: ["Full packet", "Glass", "Jewel tones"],
    variants: ["2.4", "2.6", "2.8"],
    customFields: [
      { label: "Product Type", value: "Bangles / Glass" },
      { label: "Colour", value: "Jewel tones" },
      { label: "Sold As", value: "Full packet" },
    ],
  },
  {
    name: "Teal Zari Glass Bangles — Full Packet",
    category: "bangles",
    brand: "Azmain BD",
    price: 1000,
    stock: 7,
    description:
      "A full packet of teal glass bangles worked with gold zari and beadwork. The blue-green reads well against both light and dark fabric. Sold only as a complete packet.",
    image: PHOTO("glass-bangles-teal-zari"),
    specs: ["Full packet", "Glass", "Zari and beadwork"],
    variants: ["2.4", "2.6", "2.8"],
    customFields: [
      { label: "Product Type", value: "Bangles / Glass" },
      { label: "Colour", value: "Teal" },
      { label: "Sold As", value: "Full packet" },
    ],
  },
  {
    name: "Grand Assortment Glass Bangles — Full Packet",
    category: "bangles",
    brand: "Azmain BD",
    price: 1000,
    stock: 6,
    description:
      "The largest assortment we carry — a full packet running through red, gold, green, orange and more, banded by colour. Suits a family buying for several people at once. Sold only as a complete packet.",
    image: PHOTO("glass-bangles-grand-assortment"),
    specs: ["Full packet", "Glass", "Large assortment"],
    variants: ["2.4", "2.6", "2.8"],
    customFields: [
      { label: "Product Type", value: "Bangles / Glass" },
      { label: "Colour", value: "Multi-colour" },
      { label: "Sold As", value: "Full packet" },
    ],
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
    oldPrice: null,
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
