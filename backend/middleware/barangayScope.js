// Returns a barangay filter for superadmin/All (sees everything) vs scoped official
function barangayFilter(reqOrOfficial, field = "barangay") {
  const official = reqOrOfficial?.official || (reqOrOfficial?.role ? reqOrOfficial : null);
  const queryBrgy = reqOrOfficial?.query?.barangay;

  if (queryBrgy && queryBrgy !== "All") {
    return { [field]: new RegExp(`^${queryBrgy.trim()}$`, "i") };
  }

  if (!official) return {};
  if (official.barangay === "All" || official.role === "superadmin") return {};
  if (official.barangay) {
    return { [field]: new RegExp(`^${official.barangay.trim()}$`, "i") };
  }
  return {};
}

module.exports = { barangayFilter };
