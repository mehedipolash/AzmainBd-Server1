/* ---------------------------------------------------------------------------
   Seeds demo catalogue data.

   Safe to re-run: products and categories are replaced wholesale, but the
   users collection is never touched, so admin roles survive a reseed.

   Usage:  npm run seed
--------------------------------------------------------------------------- */

const { connectDb, getCollections, closeDb } = require("../config/db");

const CATEGORIES = [
  { name: "Smartphones", slug: "smartphones", image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80" },
  { name: "Laptops", slug: "laptops", image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80" },
  { name: "Audio Gear", slug: "audio", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80" },
  { name: "Televisions", slug: "televisions", image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80" },
  { name: "Refrigerators", slug: "refrigerators", image: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&q=80" },
  { name: "Home Appliances", slug: "appliances", image: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800&q=80" },
  { name: "Cameras", slug: "cameras", image: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&q=80" },
  { name: "Gaming", slug: "gaming", image: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&q=80" },
  { name: "Accessories", slug: "accessories", image: "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=800&q=80" },
];

// price / oldPrice are integer BDT. stock drives every availability state in
// the UI, so the mix here deliberately covers in-stock, low-stock and sold-out.
const PRODUCTS = [
  // smartphones
  ["Titanium X Pro Max", "smartphones", "Apple", 189999, 205000, 3, 4.9, 214, ["5G", "512GB", "A18 Pro"], "Flagship performance with an AI-accelerated chipset, a 200MP sensor and all-day battery.", "photo-1592750475338-74b7b21085ab"],
  ["Galaxy Edge Ultra", "smartphones", "Samsung", 164999, null, 24, 4.8, 156, ["5G", "512GB", "S-Pen"], "Titanium frame, adaptive 144Hz display and the fastest charging we have shipped.", "photo-1511707171634-5f897ff02aa9"],
  ["Redmi Note Pro 5G", "smartphones", "Xiaomi", 32999, 36500, 42, 4.4, 689, ["5G", "128GB"], "A 120Hz AMOLED panel, 5000mAh battery and 67W charging at a mid-range price.", "photo-1598327105666-5b89351aff97"],
  ["Pixel Vision 9", "smartphones", "Apple", 118500, 129000, 11, 4.7, 302, ["5G", "256GB"], "Computational photography that holds detail in low light without a tripod.", "photo-1510557880182-3d4d3cba35a5"],
  ["Galaxy A56 Lite", "smartphones", "Samsung", 27999, null, 58, 4.2, 445, ["5G", "128GB"], "Everyday reliability with a big battery and a clean, ad-free interface.", "photo-1580910051074-3eb694886505"],
  ["Xiaomi Fold Flex", "smartphones", "Xiaomi", 142000, 158000, 0, 4.5, 88, ["5G", "Foldable"], "A book-style fold with a crease-resistant hinge rated for 400,000 cycles.", "photo-1616348436168-de43ad0db179"],

  // laptops
  ["EliteBook Carbon Edition", "laptops", "LG Electronics", 120500, 138000, 5, 4.7, 132, ["M3 Max", "16GB RAM", "1TB"], "Carbon-fibre ultrabook tuned for developers, with an 18-hour battery.", "photo-1517336714731-489689fd1ca8"],
  ["ZenBook Ultra 14", "laptops", "Apple", 89500, null, 15, 4.7, 198, ["M3", "16GB RAM"], "Featherweight 14-inch chassis with a colour-calibrated panel for creators.", "photo-1496181133206-80ce9b88a853"],
  ["StudioBook Creator 16", "laptops", "Samsung", 165000, null, 3, 4.8, 71, ["32GB RAM", "RTX 4060"], "Colour-accurate workstation for video and 3D, with quiet thermals.", "photo-1541807084-5c52b6b3adef"],
  ["ThinkPro Business 14", "laptops", "LG Electronics", 78900, 86000, 22, 4.5, 156, ["16GB RAM", "512GB"], "Spill-resistant keyboard, docking support and a three-year on-site warranty.", "photo-1588872657578-7efd1f1555ed"],
  ["GameForce RTX Rig", "laptops", "Samsung", 215000, 239000, 7, 4.6, 94, ["RTX 4080", "32GB RAM"], "240Hz panel and a vapour chamber that holds clocks under sustained load.", "photo-1603302576837-37561b2e2302"],
  ["ChromeSlim 13", "laptops", "Xiaomi", 42500, null, 31, 4.1, 267, ["8GB RAM", "256GB"], "Boots in seconds and runs cool — built for study and browsing.", "photo-1531297484001-80022131f5a1"],

  // audio
  ["SonicBlast 7.1.2 Soundbar", "audio", "Sony Bravia", 79900, 89900, 0, 4.5, 64, ["Dolby Atmos", "WiFi"], "Immersive spatial audio with a wireless subwoofer and room calibration.", "photo-1545454675-3531b543be5d"],
  ["SoundForge Elite Wireless", "audio", "Sony Bravia", 18200, 21000, 2, 4.4, 421, ["Hi-Res", "40H Battery"], "Reference-grade headphones with adaptive noise cancelling.", "photo-1505740420928-5e560c06d30e"],
  ["Nova Buds Pro 2", "audio", "Xiaomi", 9800, 12500, 48, 4.2, 512, ["ANC", "30H Battery"], "Compact earbuds with adaptive ANC and a pocketable charging case.", "photo-1590658268037-6bf12165a8df"],
  ["StudioMonitor M40", "audio", "Panasonic", 34500, null, 9, 4.6, 78, ["Studio", "Bi-amped"], "Near-field monitors with a flat response for mixing at home.", "photo-1558537348-c0f8e733989d"],
  ["PartyBox Portable 300", "audio", "Sony Bravia", 42000, 48000, 14, 4.3, 189, ["Bluetooth", "IPX4"], "12-hour battery, splash resistance and genuinely loud output.", "photo-1608043152269-423dbba4e7e1"],
  ["DeskMic Studio USB", "audio", "Panasonic", 8900, null, 37, 4.4, 231, ["USB-C", "Cardioid"], "Broadcast-quality voice capture with zero-latency monitoring.", "photo-1590602847861-f357a9332bbc"],

  // televisions
  ["UltraThin OLED 65\"", "televisions", "LG Electronics", 219900, 249900, 8, 4.9, 301, ["4K UHD", "OLED", "120Hz"], "Pure blacks and infinite contrast from a self-lit OLED panel.", "photo-1593359677879-a4bb92f829d1"],
  ["Aurora QLED 55\" Smart TV", "televisions", "Samsung", 92000, 108000, 6, 4.6, 143, ["4K UHD", "HDR10+"], "Quantum dot colour with a slim bezel and built-in streaming apps.", "photo-1461151304267-38535e780c79"],
  ["ProCanvas 4K Monitor 32\"", "televisions", "Samsung", 68900, null, 4, 4.6, 94, ["4K UHD", "HDR10+"], "Factory-calibrated 32-inch panel with 99% DCI-P3 coverage.", "photo-1527443224154-c4a3942d3acf"],
  ["DeskPro 27\" IPS Monitor", "televisions", "LG Electronics", 34500, null, 0, 4.3, 112, ["4K UHD", "USB-C"], "USB-C power delivery and a height-adjustable stand for long days.", "photo-1585792180666-f7347c490ee2"],
  ["CinemaMax 75\" 8K", "televisions", "Sony Bravia", 445000, 489000, 2, 4.8, 47, ["8K", "120Hz"], "Flagship 8K processing that upscales existing content convincingly.", "photo-1552975084-6e027cd345c2"],

  // refrigerators
  ["Smart Refrigerator Hub X", "refrigerators", "Samsung", 145000, null, 12, 4.6, 88, ["Inverter", "485L"], "Advanced cooling with a built-in touch hub and smart inventory tracking.", "photo-1571175443880-49e1d25b2bc5"],
  ["FrostFree Double Door 320L", "refrigerators", "LG Electronics", 62500, 69900, 18, 4.4, 234, ["Inverter", "320L"], "Ten-year compressor warranty and stabiliser-free operation.", "photo-1584568694244-14fbdf83bd30"],
  ["CompactCool Single Door", "refrigerators", "Panasonic", 32000, null, 26, 4.1, 167, ["Inverter", "190L"], "Fits a small kitchen without giving up freezer space.", "photo-1536353284924-9220c464e262"],
  ["SideBySide Pro 620L", "refrigerators", "Samsung", 198000, 219000, 5, 4.7, 91, ["Inverter", "620L", "Water"], "Plumbed water and ice dispenser with a door-in-door compartment.", "photo-1610701596007-11502861dcfa"],

  // appliances
  ["FrostLine Inverter AC 1.5 Ton", "appliances", "LG Electronics", 68500, 74900, 19, 4.5, 267, ["Inverter", "Dual Cool"], "Dual-inverter cooling built for Dhaka summers, copper condenser.", "photo-1631545806609-9c69bc0dd4b0"],
  ["Heritage Washer Pro 9KG", "appliances", "Panasonic", 125000, null, 0, 4.3, 52, ["Inverter", "9KG"], "Quiet inverter drive with steam-clean cycles and a steel finish.", "photo-1626806787461-102c1bfaaea1"],
  ["AirPure Smart Purifier", "appliances", "Xiaomi", 24500, 29900, 31, 4.5, 176, ["HEPA 13", "App Control"], "Medical-grade filtration with real-time air quality reporting.", "photo-1585771724684-38269d6639fd"],
  ["PureSteam Microwave 30L", "appliances", "Panasonic", 18900, 22000, 27, 4.1, 198, ["30L", "Convection"], "Convection, grill and steam modes with everyday presets.", "photo-1585659722983-3a675dabf23d"],
  ["TurboDry Water Heater 25L", "appliances", "LG Electronics", 14500, null, 41, 4.2, 143, ["25L", "5-Star"], "Rapid heating with a rust-proof tank and thermal cut-out.", "photo-1585338447937-7082f8fc763d"],
  ["RoboVac Mapping X2", "appliances", "Xiaomi", 38900, 44000, 13, 4.4, 289, ["LiDAR", "Mop"], "LiDAR mapping with no-go zones and a self-emptying base.", "photo-1589006833790-b0d2b5e4e1cb"],

  // cameras
  ["MirrorLess Alpha 7C", "cameras", "Sony Bravia", 178000, 195000, 6, 4.8, 122, ["Full Frame", "33MP"], "Compact full-frame body with class-leading autofocus tracking.", "photo-1502920917128-1aa500764cbd"],
  ["VlogCam Pocket 4K", "cameras", "Panasonic", 52000, null, 17, 4.4, 208, ["4K60", "Gimbal"], "Stabilised pocket camera that shoots broadcast-usable 4K.", "photo-1516035069371-29a1b244cc32"],
  ["ActionPro Waterproof 12", "cameras", "Xiaomi", 28500, 33000, 23, 4.3, 341, ["5.3K", "Waterproof"], "Rugged action camera rated to 10m without a housing.", "photo-1526170375885-4d8ecf77b99f"],

  // gaming
  ["ConsoleX Pro 2TB", "gaming", "Sony Bravia", 78900, 85000, 4, 4.9, 512, ["4K120", "2TB SSD"], "Flagship console with a 2TB drive and haptic controller included.", "photo-1606144042614-b2417e99c4e3"],
  ["MechKeys RGB Pro", "gaming", "Xiaomi", 9200, 11500, 52, 4.5, 428, ["Hot-swap", "RGB"], "Hot-swappable switches with a machined aluminium case.", "photo-1587829741301-dc798b83add3"],
  ["PrecisionMouse Wireless 8K", "gaming", "Samsung", 12500, null, 34, 4.6, 267, ["8K Polling", "Wireless"], "8000Hz polling with a 70-hour charge and 54g shell.", "photo-1527864550417-7fd91fc51a46"],

  // accessories
  ["PowerBank 20000mAh PD", "accessories", "Xiaomi", 4200, 5500, 87, 4.4, 613, ["20000mAh", "65W"], "Charges a laptop and a phone at once over USB-C PD.", "photo-1609592806596-b43bada2f4bb"],
  ["USB-C Hub 11-in-1", "accessories", "Samsung", 6800, null, 45, 4.3, 289, ["HDMI", "Ethernet"], "Dual 4K output, gigabit ethernet and 100W pass-through.", "photo-1625948515291-69613efd103f"],
  ["Laptop Sleeve Leather 16\"", "accessories", "Panasonic", 3500, 4200, 63, 4.2, 174, ["16 inch", "Leather"], "Full-grain leather sleeve with a felt lining.", "photo-1553062407-98eeb64c6a62"],
];

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

const buildProducts = () =>
  PRODUCTS.map(([name, category, brand, price, oldPrice, stock, rating, reviews, specs, description, photo], index) => ({
    name,
    category,
    brand,
    price,
    oldPrice,
    stock,
    rating,
    reviews,
    specs,
    description,
    image: `https://images.unsplash.com/${photo}?w=900&q=80`,
    // Spread creation dates so "newest" ordering is meaningful in the demo.
    soldCount: Math.max(0, Math.round(reviews * 0.35)),
    stockTotal: stock + Math.max(0, Math.round(reviews * 0.35)),
    createdAt: daysAgo(index * 3 + 1),
    updatedAt: new Date(),
  }));

const run = async () => {
  await connectDb();
  const { products, categories } = getCollections();

  await categories.deleteMany({});
  await categories.insertMany(CATEGORIES.map((c) => ({ ...c, createdAt: new Date() })));

  await products.deleteMany({});
  const docs = buildProducts();
  await products.insertMany(docs);

  const inStock = docs.filter((p) => p.stock > 0).length;
  const lowStock = docs.filter((p) => p.stock > 0 && p.stock <= 6).length;
  const soldOut = docs.filter((p) => p.stock === 0).length;

  console.log(`\nSeeded ${CATEGORIES.length} categories and ${docs.length} products`);
  console.log(`  in stock: ${inStock}   low stock: ${lowStock}   sold out: ${soldOut}`);
  console.log("  users collection untouched — admin roles preserved\n");

  await closeDb();
};

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
