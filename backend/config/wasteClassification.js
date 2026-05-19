const wasteClassificationMap = {
  // ── Food & Organic → Biodegradable ──────────────────────────────────────
  banana: {
    category: "biodegradable",
    bin: "Biodegradable (Green Bin)",
    tip: "Food scraps go in biodegradable waste. Wrap wet waste before disposal.",
  },
  apple: {
    category: "biodegradable",
    bin: "Biodegradable (Green Bin)",
    tip: "Fruit waste is compostable. Remove any stickers first.",
  },
  orange: {
    category: "biodegradable",
    bin: "Biodegradable (Green Bin)",
    tip: "Citrus peels are biodegradable. Cut into smaller pieces for faster breakdown.",
  },
  carrot: {
    category: "biodegradable",
    bin: "Biodegradable (Green Bin)",
    tip: "Vegetable scraps are biodegradable. Great for home composting.",
  },
  broccoli: {
    category: "biodegradable",
    bin: "Biodegradable (Green Bin)",
    tip: "Green vegetable waste is compostable. Adds nutrients to compost.",
  },
  pizza: {
    category: "biodegradable",
    bin: "Biodegradable (Green Bin)",
    tip: "Food waste including leftovers is biodegradable. Wrap before disposal.",
  },
  "hot dog": {
    category: "biodegradable",
    bin: "Biodegradable (Green Bin)",
    tip: "Meat scraps are biodegradable. Wrap securely before disposal.",
  },
  sandwich: {
    category: "biodegradable",
    bin: "Biodegradable (Green Bin)",
    tip: "Food waste goes in the biodegradable bin. Wrap to prevent odors.",
  },
  donut: {
    category: "biodegradable",
    bin: "Biodegradable (Green Bin)",
    tip: "Bakery waste is biodegradable and compostable.",
  },
  cake: {
    category: "biodegradable",
    bin: "Biodegradable (Green Bin)",
    tip: "Leftover food is biodegradable. Remove any non-organic packaging.",
  },

  // ── Paper & Cardboard → Recyclable ──────────────────────────────────────
  book: {
    category: "recyclable",
    bin: "Recyclable (Blue Bin)",
    tip: "Paper and cardboard are recyclable. Remove plastic covers first.",
  },
  newspaper: {
    category: "recyclable",
    bin: "Recyclable (Blue Bin)",
    tip: "Newspapers are fully recyclable. Keep dry and stack neatly.",
  },
  cardboard: {
    category: "recyclable",
    bin: "Recyclable (Blue Bin)",
    tip: "Flatten cardboard before recycling. Remove tape and labels.",
  },
  paper: {
    category: "recyclable",
    bin: "Recyclable (Blue Bin)",
    tip: "Keep paper clean and dry. Shred sensitive documents before recycling.",
  },

  // ── Plastics ─────────────────────────────────────────────────────────────
  bottle: {
    category: "recyclable",
    bin: "Recyclable (Blue Bin)",
    tip: "Plastic bottles are recyclable. Rinse and remove cap before recycling.",
  },
  cup: {
    category: "non_biodegradable",
    bin: "Non-Biodegradable (Red Bin)",
    tip: "Disposable cups are typically non-biodegradable. Consider reusable cups.",
  },
  "plastic bag": {
    category: "non_biodegradable",
    bin: "Non-Biodegradable (Red Bin)",
    tip: "Single-use plastic bags are non-biodegradable. Consider switching to reusable bags.",
  },

  // ── Metals → Recyclable ──────────────────────────────────────────────────
  can: {
    category: "recyclable",
    bin: "Recyclable (Blue Bin)",
    tip: "Metal cans are highly recyclable. Rinse before disposal.",
  },
  "tin can": {
    category: "recyclable",
    bin: "Recyclable (Blue Bin)",
    tip: "Tin cans are recyclable. Rinse and crush to save space.",
  },
  "aluminum can": {
    category: "recyclable",
    bin: "Recyclable (Blue Bin)",
    tip: "Aluminum cans are infinitely recyclable. Rinse before placing in blue bin.",
  },

  // ── Glass → Recyclable ───────────────────────────────────────────────────
  "wine glass": {
    category: "recyclable",
    bin: "Recyclable (Blue Bin)",
    tip: "Glass is recyclable. Handle broken glass with care — wrap in newspaper.",
  },
  vase: {
    category: "recyclable",
    bin: "Recyclable (Blue Bin)",
    tip: "Ceramics and glass are recyclable. Remove any floral residue first.",
  },

  // ── Plastic Utensils → Non-Biodegradable ────────────────────────────────
  fork: {
    category: "non_biodegradable",
    bin: "Non-Biodegradable (Red Bin)",
    tip: "Plastic utensils are non-biodegradable. Consider switching to bamboo or metal alternatives.",
  },
  knife: {
    category: "non_biodegradable",
    bin: "Non-Biodegradable (Red Bin)",
    tip: "Plastic cutlery belongs in the red bin. Consider reusable alternatives.",
  },
  spoon: {
    category: "non_biodegradable",
    bin: "Non-Biodegradable (Red Bin)",
    tip: "Single-use plastic spoons are non-biodegradable. Switch to reusable options.",
  },

  // ── Electronics → Special / Hazardous ───────────────────────────────────
  cellphone: {
    category: "special",
    bin: "Special/Hazardous Waste",
    tip: "Electronics require special disposal. Contact your barangay for e-waste collection schedules.",
  },
  "cell phone": {
    category: "special",
    bin: "Special/Hazardous Waste",
    tip: "Electronics require special disposal. Do not mix with regular trash.",
  },
  laptop: {
    category: "special",
    bin: "Special/Hazardous Waste",
    tip: "E-waste must be disposed of properly. Remove battery and wipe data before drop-off.",
  },
  tv: {
    category: "special",
    bin: "Special/Hazardous Waste",
    tip: "Large electronics need special handling. Schedule a pickup with your barangay.",
  },
  remote: {
    category: "special",
    bin: "Special/Hazardous Waste",
    tip: "Battery-containing devices are hazardous waste. Remove batteries separately.",
  },
  keyboard: {
    category: "special",
    bin: "Special/Hazardous Waste",
    tip: "Computer peripherals are e-waste. Bring to certified e-waste collection points.",
  },
  mouse: {
    category: "special",
    bin: "Special/Hazardous Waste",
    tip: "Electronic devices should not go in regular trash. Find e-waste drop-off points.",
  },

  // ── Default fallback ─────────────────────────────────────────────────────
  default: {
    category: "non_biodegradable",
    bin: "Non-Biodegradable (Red Bin)",
    tip: "When in doubt, dispose as non-biodegradable. Check with your barangay for proper sorting guidelines.",
  },
};

function lookupWasteClassification(objectName) {
  if (!objectName) return wasteClassificationMap.default;
  const key = objectName.toLowerCase().trim();
  return wasteClassificationMap[key] || wasteClassificationMap.default;
}

module.exports = { wasteClassificationMap, lookupWasteClassification };
