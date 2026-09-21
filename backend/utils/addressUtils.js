const crypto = require("crypto");

function normalizeAddressPart(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/\bst\.?\b/g, "street")
    .replace(/\bave\.?\b/g, "avenue")
    .replace(/\bblvd\.?\b/g, "boulevard")
    .replace(/\bdr\.?\b/g, "drive")
    .replace(/\brd\.?\b/g, "road")
    .replace(/\bpurok\b/g, "purok")
    .replace(/\s+/g, " ")
    .trim();
}

function generateHouseholdId(barangay, street, houseNo) {
  const key = [
    (barangay || "").toLowerCase().trim(),
    normalizeAddressPart(street),
    normalizeAddressPart(houseNo),
  ].join("||");
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 32);
}

module.exports = {
  normalizeAddressPart,
  generateHouseholdId,
};
