// =============================================
// OFFICIAL DASHBOARD — MOCK DATA
// =============================================

export const officialProfile = {
  name: 'Pedro Santos',
  barangay: 'Lahug',
  position: 'Barangay Captain',
  city: 'Cebu City',
  email: 'pedro.santos@lahug.gov.ph',
  phone: '+63 912 345 6789',
  initials: 'PS',
};

export const barangayStats = {
  wasteCollectedToday: { value: '245 kg', change: '+12%', trend: 'up' },
  activeCollectors: { value: 3, total: 4 },
  pendingComplaints: { value: 8, urgent: 2 },
  pollutionLevel: { value: 'Moderate', index: 42, change: '-5%', trend: 'down' },
};

export const collectionSchedule = [
  {
    id: 'CS-001',
    collector: 'Juan Dela Cruz',
    truck: 'GT-401',
    route: 'Lahug Zone A',
    status: 'in-progress',
    stopsDone: 4,
    totalStops: 6,
    startTime: '07:00',
    estEnd: '11:00',
    currentLocation: 'Orchid St.',
    wasteKg: 88,
  },
  {
    id: 'CS-002',
    collector: 'Maria Reyes',
    truck: 'GT-403',
    route: 'Lahug Zone B',
    status: 'completed',
    stopsDone: 5,
    totalStops: 5,
    startTime: '07:00',
    estEnd: '10:30',
    currentLocation: 'Depot',
    wasteKg: 112,
  },
  {
    id: 'CS-003',
    collector: 'Roberto Cruz',
    truck: 'GT-406',
    route: 'Lahug Zone C',
    status: 'pending',
    stopsDone: 0,
    totalStops: 7,
    startTime: '13:00',
    estEnd: '17:00',
    currentLocation: 'Depot',
    wasteKg: 0,
  },
  {
    id: 'CS-004',
    collector: 'Ana Mendoza',
    truck: 'GT-407',
    route: 'Lahug Zone D',
    status: 'delayed',
    stopsDone: 2,
    totalStops: 5,
    startTime: '09:00',
    estEnd: '12:30',
    currentLocation: 'Banilad Rd.',
    wasteKg: 45,
  },
];

export const collectionHistory = [
  { date: 'Dec 14, 2024', routes: 4, collected: '228 kg', stops: '23/23', status: 'completed' },
  { date: 'Dec 13, 2024', routes: 4, collected: '195 kg', stops: '20/23', status: 'completed' },
  { date: 'Dec 12, 2024', routes: 4, collected: '280 kg', stops: '23/23', status: 'completed' },
  { date: 'Dec 11, 2024', routes: 4, collected: '210 kg', stops: '22/23', status: 'completed' },
  { date: 'Dec 10, 2024', routes: 3, collected: '150 kg', stops: '18/23', status: 'completed' },
  { date: 'Dec 09, 2024', routes: 4, collected: '262 kg', stops: '23/23', status: 'completed' },
  { date: 'Dec 08, 2024', routes: 4, collected: '238 kg', stops: '22/23', status: 'completed' },
];

export const barangayComplaints = [
  {
    id: 'RPT-001',
    title: 'Missed collection on Orchid St.',
    reportedBy: 'Resident #102',
    contact: 'res102@email.com',
    type: 'Missed Collection',
    priority: 'high',
    status: 'open',
    date: '2024-12-15',
    zone: 'Zone A',
    description: 'Garbage truck did not come this morning at the usual scheduled time. Waste has been piling up since yesterday.',
    address: 'Orchid St., Lahug, Cebu City',
  },
  {
    id: 'RPT-002',
    title: 'Overflowing bin near Carbon Market',
    reportedBy: 'Resident #234',
    contact: 'res234@email.com',
    type: 'Overflow',
    priority: 'urgent',
    status: 'in-progress',
    date: '2024-12-15',
    zone: 'Zone B',
    description: 'The public bin at Carbon Market entrance is overflowing and creating sanitation and odor issues for nearby stalls.',
    address: 'Carbon Market Entrance, Lahug, Cebu City',
  },
  {
    id: 'RPT-003',
    title: 'Illegal dumping at Salinas Drive',
    reportedBy: 'Resident #318',
    contact: 'res318@email.com',
    type: 'Illegal Dumping',
    priority: 'medium',
    status: 'open',
    date: '2024-12-14',
    zone: 'Zone A',
    description: 'Someone has been dumping waste near the creek at Salinas Drive. This has been happening for three consecutive days.',
    address: 'Salinas Drive near Creek, Lahug, Cebu City',
  },
  {
    id: 'RPT-004',
    title: 'Broken bin at corner Gorordo',
    reportedBy: 'Resident #421',
    contact: 'res421@email.com',
    type: 'Infrastructure',
    priority: 'low',
    status: 'resolved',
    date: '2024-12-13',
    zone: 'Zone C',
    description: 'The community bin near the corner of Gorordo Ave has a broken lid, making it difficult to use properly.',
    address: 'Gorordo Ave corner, Lahug, Cebu City',
  },
  {
    id: 'RPT-005',
    title: 'Foul odor near residential area',
    reportedBy: 'Resident #156',
    contact: 'res156@email.com',
    type: 'Pollution',
    priority: 'high',
    status: 'open',
    date: '2024-12-12',
    zone: 'Zone B',
    description: 'Strong foul odor coming from the waste collection area, affecting nearby homes especially in the evenings.',
    address: 'Zone B Collection Point, Lahug, Cebu City',
  },
  {
    id: 'RPT-006',
    title: 'Request for additional bins in park',
    reportedBy: 'Resident #509',
    contact: 'res509@email.com',
    type: 'Infrastructure',
    priority: 'low',
    status: 'in-review',
    date: '2024-12-11',
    zone: 'Zone D',
    description: 'Lahug Park area needs additional waste bins due to increased foot traffic from recreational activities.',
    address: 'Lahug Park, Cebu City',
  },
  {
    id: 'RPT-007',
    title: 'Collection truck noise early morning',
    reportedBy: 'Resident #612',
    contact: 'res612@email.com',
    type: 'Other',
    priority: 'low',
    status: 'resolved',
    date: '2024-12-10',
    zone: 'Zone A',
    description: 'The collection truck operates as early as 5:30 AM and creates noise disturbance for residents.',
    address: 'Zone A Route, Lahug, Cebu City',
  },
];

export const barangaySensors = [
  { id: 'S-001', location: 'Carbon Market', type: 'MQ-135', battery: 85, lastReading: '45 ppm', status: 'online', trend: 'up', zone: 'Zone B' },
  { id: 'S-002', location: 'Gorordo Avenue', type: 'MQ-135', battery: 72, lastReading: '22 ppm', status: 'online', trend: 'down', zone: 'Zone C' },
  { id: 'S-007', location: 'Salinas Drive', type: 'DHT11', battery: 15, lastReading: '32°C', status: 'offline', trend: null, zone: 'Zone A' },
  { id: 'S-008', location: 'Lahug Park', type: 'Ultrasonic', battery: 90, lastReading: '15 cm', status: 'online', trend: 'stable', zone: 'Zone D' },
];

export const wasteCollectionTrend = [
  { day: 'Mon', collected: 180, target: 200 },
  { day: 'Tue', collected: 220, target: 200 },
  { day: 'Wed', collected: 195, target: 200 },
  { day: 'Thu', collected: 245, target: 200 },
  { day: 'Fri', collected: 210, target: 200 },
  { day: 'Sat', collected: 280, target: 250 },
  { day: 'Sun', collected: 150, target: 150 },
];

export const weeklyWasteData = [
  { week: 'Week 1', collected: 1240, target: 1400 },
  { week: 'Week 2', collected: 1380, target: 1400 },
  { week: 'Week 3', collected: 1195, target: 1400 },
  { week: 'Week 4', collected: 1450, target: 1400 },
];

export const pollutionZones = [
  { zone: 'Zone A', area: 'Orchid St. & Mango Ave.', level: 'low', ammonia: 12, methane: 8, updated: '5 min ago', trend: 'stable' },
  { zone: 'Zone B', area: 'Carbon Market & Gorordo', level: 'high', ammonia: 45, methane: 32, updated: '3 min ago', trend: 'up' },
  { zone: 'Zone C', area: 'Salinas Drive & Banilad', level: 'moderate', ammonia: 28, methane: 15, updated: '8 min ago', trend: 'stable' },
  { zone: 'Zone D', area: 'Lahug Park & Ridgewood', level: 'low', ammonia: 10, methane: 5, updated: '2 min ago', trend: 'down' },
];

export const pollutionTrend = [
  { time: '06:00', ammonia: 15, methane: 10 },
  { time: '07:00', ammonia: 22, methane: 14 },
  { time: '08:00', ammonia: 35, methane: 20 },
  { time: '09:00', ammonia: 42, methane: 28 },
  { time: '10:00', ammonia: 45, methane: 32 },
  { time: '11:00', ammonia: 38, methane: 25 },
  { time: '12:00', ammonia: 30, methane: 18 },
  { time: '13:00', ammonia: 28, methane: 15 },
  { time: '14:00', ammonia: 32, methane: 20 },
  { time: '15:00', ammonia: 38, methane: 28 },
  { time: '16:00', ammonia: 44, methane: 35 },
  { time: '17:00', ammonia: 42, methane: 30 },
];

export const notifications = [
  { id: 1, title: 'High Pollution Alert', message: 'Ammonia levels exceeded threshold (45 ppm) in Zone B — Carbon Market area.', type: 'alert', priority: 'urgent', time: '10 min ago', read: false, from: 'System' },
  { id: 2, title: 'Collection Complete', message: 'GT-403 has completed the Lahug Zone B route. All 5 stops collected.', type: 'info', priority: 'normal', time: '45 min ago', read: false, from: 'Maria Reyes' },
  { id: 3, title: 'New Complaint Filed', message: 'Resident #234 reported overflow at Carbon Market bin — requires attention.', type: 'complaint', priority: 'high', time: '1 hour ago', read: true, from: 'Resident #234' },
  { id: 4, title: 'Sensor Offline', message: 'S-007 at Salinas Drive is offline. Battery may be depleted (15%).', type: 'alert', priority: 'high', time: '2 hours ago', read: true, from: 'System' },
  { id: 5, title: 'Weekly Report Ready', message: "This week's waste collection report for Barangay Lahug is ready to view.", type: 'info', priority: 'normal', time: '3 hours ago', read: true, from: 'System' },
  { id: 6, title: 'Maintenance Scheduled', message: 'GT-405 is scheduled for maintenance tomorrow. Route adjustments may be needed.', type: 'info', priority: 'normal', time: '5 hours ago', read: true, from: 'Admin' },
];

export const notificationHistory = [
  { id: 1, title: 'Collection Schedule Update', message: 'Zone A morning collection delayed by 1 hour tomorrow.', target: 'Zone A Residents', sentAt: 'Dec 14, 2024 09:30', recipients: 245, openRate: '68%', status: 'sent' },
  { id: 2, title: 'Special Cleanup Drive', message: 'Community cleanup on Dec 20. Prepare waste for collection.', target: 'All Residents', sentAt: 'Dec 13, 2024 14:00', recipients: 1205, openRate: '82%', status: 'sent' },
  { id: 3, title: 'Bin Maintenance Notice', message: 'Bins at Gorordo Ave will be replaced this week.', target: 'Zone C Residents', sentAt: 'Dec 12, 2024 10:15', recipients: 312, openRate: '71%', status: 'sent' },
];

export const complaintsByCategory = [
  { category: 'Missed', count: 12 },
  { category: 'Overflow', count: 8 },
  { category: 'Illegal Dump', count: 5 },
  { category: 'Infra', count: 7 },
  { category: 'Pollution', count: 4 },
  { category: 'Other', count: 3 },
];

// =============================================
// RESIDENT MAP — BARANGAY COLLECTION ROUTES
// =============================================

export const barangayRoutes = {
  lahug: {
    name: 'Lahug',
    color: '#10b981',
    truck: { id: 'GT-401', driver: 'Juan Dela Cruz', status: 'in-progress' },
    center: [10.3300, 123.9042],
    zoom: 15,
    stops: [
      { id: 1, name: 'Lahug Barangay Hall', coords: [10.3267, 123.8986], status: 'completed', time: '07:00 AM', type: 'public' },
      { id: 2, name: 'Orchid St. Residential', coords: [10.3283, 123.9011], status: 'completed', time: '07:25 AM', type: 'residential' },
      { id: 3, name: 'Gorordo Ave Junction', coords: [10.3311, 123.9042], status: 'completed', time: '07:50 AM', type: 'commercial' },
      { id: 4, name: 'IT Park Gate (Lahug)', coords: [10.3302, 123.9059], status: 'completed', time: '08:15 AM', type: 'commercial' },
      { id: 5, name: 'Archbishop Reyes Ave', coords: [10.3318, 123.9075], status: 'in-progress', time: '08:45 AM', type: 'residential' },
      { id: 6, name: 'Salinas Drive (End)', coords: [10.3340, 123.9090], status: 'pending', time: '09:15 AM', type: 'residential' },
    ],
  },
  apas: {
    name: 'Apas',
    color: '#6366f1',
    truck: { id: 'GT-407', driver: 'Ana Mendoza', status: 'completed' },
    center: [10.3460, 123.8958],
    zoom: 15,
    stops: [
      { id: 1, name: 'Apas Barangay Hall', coords: [10.3487, 123.8917], status: 'completed', time: '07:00 AM', type: 'public' },
      { id: 2, name: 'Apas Rd. Residential', coords: [10.3460, 123.8950], status: 'completed', time: '07:30 AM', type: 'residential' },
      { id: 3, name: 'Banilad Road Junction', coords: [10.3430, 123.8980], status: 'completed', time: '08:00 AM', type: 'residential' },
      { id: 4, name: 'Upper Banilad Area', coords: [10.3400, 123.9010], status: 'completed', time: '08:30 AM', type: 'residential' },
      { id: 5, name: 'Apas Depot (Return)', coords: [10.3450, 123.8940], status: 'completed', time: '09:00 AM', type: 'depot' },
    ],
  },
  mabolo: {
    name: 'Mabolo',
    color: '#f59e0b',
    truck: { id: 'GT-406', driver: 'Roberto Cruz', status: 'delayed' },
    center: [10.3235, 123.9130],
    zoom: 15,
    stops: [
      { id: 1, name: 'Mabolo Church Area', coords: [10.3224, 123.9137], status: 'completed', time: '09:00 AM', type: 'public' },
      { id: 2, name: 'Gov. M. Cuenco Ave', coords: [10.3245, 123.9115], status: 'completed', time: '09:30 AM', type: 'commercial' },
      { id: 3, name: 'Gaisano Country Mall', coords: [10.3210, 123.9160], status: 'in-progress', time: '10:00 AM', type: 'commercial' },
      { id: 4, name: 'MJ Cuenco Ave Market', coords: [10.3195, 123.9145], status: 'pending', time: '10:30 AM', type: 'commercial' },
      { id: 5, name: 'Kasambagan Junction', coords: [10.3270, 123.9100], status: 'pending', time: '11:00 AM', type: 'residential' },
      { id: 6, name: 'Mabolo Depot (End)', coords: [10.3290, 123.9080], status: 'pending', time: '11:30 AM', type: 'depot' },
    ],
  },
};

// =============================================
// ORIGINAL ADMIN DATA (from Claude.md spec)
// =============================================

export const systemStats = {
  totalWaste: { value: '45,892kg', change: '+8%', trend: 'up' },
  activeUsers: { value: '2,450', online: 185 },
  trucksDeployed: { value: '12/15', utilization: '80%' },
  criticalAlerts: { value: 5, immediate: 3 },
};

export const systemHealth = {
  api: { status: 'operational', uptime: '99.9%', lastChecked: '2 min ago' },
  sensors: { online: 48, total: 50, offline: 2 },
  database: { status: 'Healthy', storage: '45%', lastBackup: '1 hour ago' },
};

export const users = [
  { id: 1, name: 'Jane Doe', email: 'jane@email.com', role: 'resident', barangay: 'Lahug', status: 'active', registered: '2024-01-15' },
  { id: 2, name: 'Juan Dela Cruz', email: 'juan@email.com', role: 'collector', barangay: 'North Cebu', status: 'active', registered: '2024-02-20' },
  { id: 3, name: 'Maria Reyes', email: 'maria@email.com', role: 'collector', barangay: 'IT Corridor', status: 'active', registered: '2024-03-10' },
  { id: 4, name: 'Pedro Santos', email: 'pedro@email.com', role: 'official', barangay: 'Lahug', status: 'active', registered: '2024-01-05' },
  { id: 5, name: 'Admin User', email: 'admin@gtrash.com', role: 'admin', barangay: 'N/A', status: 'active', registered: '2023-12-01' },
];

export const fleet = [
  { id: 'GT-401', driver: 'Juan Dela Cruz', route: 'North Cebu', status: 'active', location: 'Lahug', stopsDone: 4, totalStops: 6, fuel: '75%' },
  { id: 'GT-402', driver: 'Pedro Santos', route: 'South Cebu', status: 'active', location: 'Mandaue', stopsDone: 3, totalStops: 8, fuel: '60%' },
  { id: 'GT-403', driver: 'Maria Reyes', route: 'IT Corridor', status: 'delayed', location: 'IT Park', stopsDone: 2, totalStops: 5, fuel: '45%' },
  { id: 'GT-404', driver: 'Jose Bautista', route: 'Lahug District', status: 'active', location: 'Banilad', stopsDone: 5, totalStops: 7, fuel: '80%' },
  { id: 'GT-405', driver: 'N/A', route: 'N/A', status: 'maintenance', location: 'Depot', stopsDone: 0, totalStops: 0, fuel: '100%' },
];

export const sensors = [
  { id: 'S-001', location: 'Carbon Market', type: 'MQ-135', battery: '85%', lastReading: '45 ppm', status: 'online' },
  { id: 'S-002', location: 'Colon Street', type: 'MQ-135', battery: '72%', lastReading: '22 ppm', status: 'online' },
  { id: 'S-003', location: 'IT Park', type: 'MQ-135', battery: '90%', lastReading: '5 ppm', status: 'online' },
  { id: 'S-004', location: 'Ayala', type: 'DHT11', battery: '15%', lastReading: '32°C', status: 'offline' },
  { id: 'S-005', location: 'Mabolo', type: 'Ultrasonic', battery: '60%', lastReading: '85cm', status: 'online' },
];

export const bugReports = [
  { id: 1, title: 'App crashes on map view', reportedBy: 'Resident #452', category: 'Mobile App', severity: 'critical', status: 'open', date: '2024-12-15' },
  { id: 2, title: 'Notification not received', reportedBy: 'Collector GT-402', category: 'Notifications', severity: 'high', status: 'in-review', date: '2024-12-14' },
  { id: 3, title: 'Heatmap not loading', reportedBy: 'Official Lahug', category: 'Web Dashboard', severity: 'medium', status: 'fixed', date: '2024-12-13' },
];

export const auditLogs = [
  { id: 1, timestamp: '2024-12-15 14:30', user: 'Admin', role: 'admin', action: 'Update', description: 'Updated system settings', ip: '192.168.1.1', status: 'success' },
  { id: 2, timestamp: '2024-12-15 14:15', user: 'Jane Doe', role: 'resident', action: 'Login', description: 'User logged in', ip: '192.168.1.100', status: 'success' },
  { id: 3, timestamp: '2024-12-15 13:45', user: 'Juan Dela Cruz', role: 'collector', action: 'Update', description: 'Marked Lahug as cleaned', ip: '192.168.1.50', status: 'success' },
];
