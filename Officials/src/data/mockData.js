export const stats = {
  totalCollected: { value: "12,458kg", change: "+12%", trend: "up" },
  activeTrucks: { value: "8/12", label: "On route" },
  criticalAlerts: { value: 3, label: "Needs attention" },
  avgCollectionRate: { value: "94%", change: "+5%", trend: "up" },
};

export const trucks = [
  { id: "GT-401", driver: "Juan Dela Cruz", route: "North Cebu", status: "active", stopsCompleted: 4, totalStops: 6, currentLocation: "Lahug", eta: "10:45 AM", lat: 10.325, lng: 123.893 },
  { id: "GT-402", driver: "Pedro Santos", route: "South Cebu", status: "active", stopsCompleted: 3, totalStops: 8, currentLocation: "Mandaue", eta: "11:30 AM", lat: 10.330, lng: 123.940 },
  { id: "GT-403", driver: "Maria Reyes", route: "IT Corridor", status: "delayed", stopsCompleted: 2, totalStops: 5, currentLocation: "IT Park", eta: "12:00 PM", lat: 10.327, lng: 123.898 },
  { id: "GT-404", driver: "Jose Bautista", route: "Lahug District", status: "active", stopsCompleted: 5, totalStops: 7, currentLocation: "Banilad", eta: "11:15 AM", lat: 10.340, lng: 123.910 },
  { id: "GT-405", driver: "Ana Lim", route: "Carbon Market", status: "stopped", stopsCompleted: 1, totalStops: 4, currentLocation: "Carbon Market", eta: "1:00 PM", lat: 10.295, lng: 123.895 },
  { id: "GT-406", driver: "Ramon Cruz", route: "Colon District", status: "active", stopsCompleted: 6, totalStops: 9, currentLocation: "Colon St.", eta: "10:30 AM", lat: 10.308, lng: 123.891 },
  { id: "GT-407", driver: "Gloria Tan", route: "Talamban", status: "active", stopsCompleted: 3, totalStops: 6, currentLocation: "Talamban", eta: "11:45 AM", lat: 10.370, lng: 123.920 },
  { id: "GT-408", driver: "Felix Uy", route: "Mabolo", status: "delayed", stopsCompleted: 2, totalStops: 7, currentLocation: "Mabolo", eta: "12:30 PM", lat: 10.318, lng: 123.909 },
];

export const barangays = [
  { rank: 1, name: "IT Park", collected: "2,845kg", collectedNum: 2845, rate: "98%", rateNum: 98, efficiency: 95, trend: "up", points: 1240 },
  { rank: 2, name: "Lahug", collected: "2,340kg", collectedNum: 2340, rate: "94%", rateNum: 94, efficiency: 91, trend: "up", points: 1105 },
  { rank: 3, name: "Ayala", collected: "1,980kg", collectedNum: 1980, rate: "92%", rateNum: 92, efficiency: 88, trend: "down", points: 980 },
  { rank: 4, name: "Banilad", collected: "1,750kg", collectedNum: 1750, rate: "89%", rateNum: 89, efficiency: 84, trend: "up", points: 870 },
  { rank: 5, name: "Talamban", collected: "1,543kg", collectedNum: 1543, rate: "87%", rateNum: 87, efficiency: 80, trend: "down", points: 760 },
  { rank: 6, name: "Mabolo", collected: "1,320kg", collectedNum: 1320, rate: "83%", rateNum: 83, efficiency: 77, trend: "up", points: 680 },
  { rank: 7, name: "Mandaue", collected: "1,210kg", collectedNum: 1210, rate: "81%", rateNum: 81, efficiency: 74, trend: "up", points: 620 },
  { rank: 8, name: "Carbon Market", collected: "980kg", collectedNum: 980, rate: "72%", rateNum: 72, efficiency: 65, trend: "down", points: 480 },
  { rank: 9, name: "Ermita", collected: "875kg", collectedNum: 875, rate: "68%", rateNum: 68, efficiency: 61, trend: "down", points: 390 },
  { rank: 10, name: "Sto. Niño", collected: "720kg", collectedNum: 720, rate: "65%", rateNum: 65, efficiency: 58, trend: "up", points: 320 },
];

export const reports = [
  { id: 1, title: "Overflowing Bin at Carbon Market", location: "Carbon Market", barangay: "Ermita", reportedBy: "Resident #452", time: "10 mins ago", status: "pending", priority: "High", description: "Multiple bins overflowing with mixed waste. Strong odor detected. Immediate collection needed before market opens." },
  { id: 2, title: "Hazardous Waste Found", location: "Colon Street", barangay: "Sto. Niño", reportedBy: "Resident #128", time: "25 mins ago", status: "in-progress", priority: "Critical", description: "Suspected chemical waste found near residential area. Requires special handling team with protective equipment." },
  { id: 3, title: "Missed Collection - Day 2", location: "Mabolo Rotunda", barangay: "Mabolo", reportedBy: "Resident #389", time: "1 hour ago", status: "pending", priority: "Medium", description: "Garbage not collected for 2 consecutive days. All bins are full and waste is spilling onto sidewalk." },
  { id: 4, title: "Illegal Dumping Site Discovered", location: "Talamban Road", barangay: "Talamban", reportedBy: "Resident #201", time: "2 hours ago", status: "resolved", priority: "High", description: "Large pile of construction debris and household waste illegally dumped along the road. Area has been cleaned." },
  { id: 5, title: "Broken Bin - Replacement Needed", location: "Lahug Avenue", barangay: "Lahug", reportedBy: "Resident #567", time: "3 hours ago", status: "in-progress", priority: "Low", description: "Public bin lid is broken and waste is exposed. Unit needs replacement or repair." },
  { id: 6, title: "High Ammonia Reading at Sector 4", location: "IT Park Sector 4", barangay: "IT Park", reportedBy: "Sensor #12", time: "4 hours ago", status: "pending", priority: "Critical", description: "Automated sensor detected dangerously high ammonia levels (52 ppm) near IT Park waste station. Manual inspection required." },
  { id: 7, title: "Bin Vandalism Reported", location: "Ayala Business Park", barangay: "Ayala", reportedBy: "Resident #334", time: "5 hours ago", status: "resolved", priority: "Low", description: "Waste bins were vandalized and some units overturned. Maintenance team has restored the site." },
];

export const heatmapZones = [
  { id: 1, name: "Carbon Market", status: "critical", ammonia: "45 ppm", methane: "2.8%", bins: 12, riskLevel: "High", lat: 10.295, lng: 123.895 },
  { id: 2, name: "Colon Street", status: "moderate", ammonia: "22 ppm", methane: "1.2%", bins: 8, riskLevel: "Medium", lat: 10.308, lng: 123.895 },
  { id: 3, name: "IT Park", status: "clean", ammonia: "5 ppm", methane: "0.2%", bins: 3, riskLevel: "Low", lat: 10.328, lng: 123.900 },
  { id: 4, name: "Lahug", status: "moderate", ammonia: "18 ppm", methane: "0.9%", bins: 6, riskLevel: "Medium", lat: 10.325, lng: 123.893 },
  { id: 5, name: "Talamban", status: "clean", ammonia: "8 ppm", methane: "0.4%", bins: 4, riskLevel: "Low", lat: 10.370, lng: 123.920 },
  { id: 6, name: "Mabolo", status: "moderate", ammonia: "28 ppm", methane: "1.5%", bins: 9, riskLevel: "Medium", lat: 10.318, lng: 123.909 },
  { id: 7, name: "Ermita", status: "critical", ammonia: "52 ppm", methane: "3.1%", bins: 15, riskLevel: "High", lat: 10.300, lng: 123.890 },
  { id: 8, name: "Banilad", status: "clean", ammonia: "6 ppm", methane: "0.3%", bins: 5, riskLevel: "Low", lat: 10.340, lng: 123.910 },
];

export const pollutionTrends = [
  { date: "Mon", ammonia: 35, methane: 1.8 },
  { date: "Tue", ammonia: 42, methane: 2.1 },
  { date: "Wed", ammonia: 38, methane: 1.9 },
  { date: "Thu", ammonia: 45, methane: 2.4 },
  { date: "Fri", ammonia: 40, methane: 2.0 },
  { date: "Sat", ammonia: 32, methane: 1.5 },
  { date: "Sun", ammonia: 28, methane: 1.2 },
];

export const collectionHistory = [
  { id: 1, date: "2025-05-05", barangay: "IT Park", truckId: "GT-401", route: "North Cebu", weight: "485kg", type: "Mixed", status: "completed" },
  { id: 2, date: "2025-05-05", barangay: "Lahug", truckId: "GT-402", route: "South Cebu", weight: "392kg", type: "Organic", status: "completed" },
  { id: 3, date: "2025-05-05", barangay: "Ayala", truckId: "GT-403", route: "IT Corridor", weight: "321kg", type: "Recyclable", status: "completed" },
  { id: 4, date: "2025-05-04", barangay: "Banilad", truckId: "GT-404", route: "Lahug District", weight: "298kg", type: "Mixed", status: "completed" },
  { id: 5, date: "2025-05-04", barangay: "Carbon Market", truckId: "GT-405", route: "Carbon Market", weight: "512kg", type: "Organic", status: "partial" },
  { id: 6, date: "2025-05-04", barangay: "Talamban", truckId: "GT-407", route: "Talamban", weight: "267kg", type: "Mixed", status: "completed" },
  { id: 7, date: "2025-05-03", barangay: "Mabolo", truckId: "GT-408", route: "Mabolo", weight: "189kg", type: "Recyclable", status: "missed" },
  { id: 8, date: "2025-05-03", barangay: "Ermita", truckId: "GT-406", route: "Colon District", weight: "445kg", type: "Organic", status: "completed" },
  { id: 9, date: "2025-05-03", barangay: "IT Park", truckId: "GT-401", route: "North Cebu", weight: "502kg", type: "Mixed", status: "completed" },
  { id: 10, date: "2025-05-02", barangay: "Lahug", truckId: "GT-402", route: "South Cebu", weight: "378kg", type: "Organic", status: "completed" },
  { id: 11, date: "2025-05-02", barangay: "Banilad", truckId: "GT-404", route: "Lahug District", weight: "312kg", type: "Mixed", status: "completed" },
  { id: 12, date: "2025-05-01", barangay: "Sto. Niño", truckId: "GT-406", route: "Colon District", weight: "198kg", type: "Recyclable", status: "completed" },
];

export const alerts = [
  { id: 1, location: "Carbon Market, Ermita", time: "10 mins ago", severity: "critical", message: "Ammonia level exceeded 45 ppm threshold" },
  { id: 2, location: "Colon Street, Sto. Niño", time: "25 mins ago", severity: "critical", message: "Hazardous waste detected by sensor array" },
  { id: 3, location: "Mabolo Rotunda", time: "1 hour ago", severity: "moderate", message: "Bin overflow warning — 85% capacity reached" },
  { id: 4, location: "IT Park Sector 4", time: "2 hours ago", severity: "moderate", message: "Methane spike 2.4% — monitor closely" },
  { id: 5, location: "Talamban Junction", time: "3 hours ago", severity: "moderate", message: "Missed collection day 2 — bins near full" },
];

export const summaryStats = {
  monthlyCollected: "38,245kg",
  avgDailyCollection: "1,274kg",
  mostActiveTruck: "GT-401",
  peakDay: "Tuesday",
};

export const wasteByBarangay = [
  { name: "IT Park", value: 2845 },
  { name: "Lahug", value: 2340 },
  { name: "Ayala", value: 1980 },
  { name: "Banilad", value: 1750 },
  { name: "Talamban", value: 1543 },
];

export const categoryWinners = {
  bestSegregation: { name: "IT Park", score: "98/100" },
  mostCollected: { name: "IT Park", weight: "2,845kg" },
  mostImproved: { name: "Mabolo", percentage: "+23%" },
};
