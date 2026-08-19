import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import API_URL from "../config";

const { width } = Dimensions.get("window");
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function CalendarScreen() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const today = new Date();

  const goToPreviousMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
    setSelectedDay(null);
  };
  const goToNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
    setSelectedDay(null);
  };
  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDay(today.getDate());
  };

  const fetchSchedules = useCallback(async (year, month) => {
    setIsLoading(true);
    try {
      const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
      const res = await fetch(`${API_URL}/api/schedules?month=${monthStr}`);
      if (res.ok) setSchedules(await res.json());
    } catch (_) {}
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchSchedules(currentYear, currentMonth); }, [fetchSchedules, currentYear, currentMonth]);

  const collectionDays = useMemo(() => {
    const days = new Set();
    schedules.forEach(s => { const d = parseInt(s.date?.split("-")[2], 10); if (!isNaN(d)) days.add(d); });
    return days;
  }, [schedules]);

  const schedulesForDay = useMemo(() => {
    if (!selectedDay) return [];
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
    return schedules.filter(s => s.date === dateStr);
  }, [selectedDay, schedules, currentYear, currentMonth]);

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push({ day: null, key: `e-${i}` });
    for (let d = 1; d <= daysInMonth; d++) days.push({ day: d, key: `d-${d}` });
    return days;
  }, [currentYear, currentMonth]);

  const nextPickup = useMemo(() => {
    if (today.getFullYear() === currentYear && today.getMonth() === currentMonth) {
      const todayDay = today.getDate();
      const upcoming = [...collectionDays].filter(d => d >= todayDay).sort((a, b) => a - b);
      if (upcoming.length > 0) {
        const diff = upcoming[0] - todayDay;
        if (diff === 0) return { label: "Today!", sub: "Collection scheduled for today", urgent: true };
        if (diff === 1) return { label: "Tomorrow", sub: `${MONTH_NAMES[currentMonth]} ${upcoming[0]}`, urgent: false };
        return { label: `In ${diff} days`, sub: `${MONTH_NAMES[currentMonth]} ${upcoming[0]}`, urgent: false };
      }
      return { label: "None left", sub: "No more pickups this month", urgent: false };
    }
    const sorted = [...collectionDays].sort((a, b) => a - b);
    return sorted.length > 0
      ? { label: `${MONTH_NAMES[currentMonth]} ${sorted[0]}`, sub: `${sorted.length} collection days`, urgent: false }
      : { label: "No schedule", sub: "No pickups scheduled", urgent: false };
  }, [currentYear, currentMonth, collectionDays]);

  const handleQuickReport = (type) => {
    const msgs = {
      overflowing: "We've received your report about an overflowing bin. Our team will address it shortly.",
      odor: "We've received your report about bad odor. Environmental team has been notified.",
      missed: "We've noted your missed collection. A truck will be rerouted to your area.",
    };
    Alert.alert("Report Submitted ✓", msgs[type] || "Report submitted.");
  };

  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Collection Schedule</Text>
            <Text style={s.headerSub}>{MONTH_NAMES[currentMonth]} {currentYear}</Text>
          </View>
          {!isCurrentMonth && (
            <TouchableOpacity style={s.todayBtn} onPress={goToToday}>
              <MaterialIcons name="today" size={16} color="#006A3B" />
              <Text style={s.todayBtnText}>Today</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Next Pickup Banner */}
        <View style={[s.pickupBanner, nextPickup.urgent && s.pickupBannerUrgent]}>
          <View style={[s.pickupIcon, nextPickup.urgent && s.pickupIconUrgent]}>
            <MaterialIcons
              name={nextPickup.urgent ? "local-shipping" : "notifications-active"}
              size={22} color={nextPickup.urgent ? "#FFFFFF" : "#006A3B"}
            />
          </View>
          <View style={s.pickupContent}>
            <Text style={s.pickupLabel}>Next Pickup</Text>
            <Text style={[s.pickupValue, nextPickup.urgent && s.pickupValueUrgent]}>{nextPickup.label}</Text>
            <Text style={s.pickupSub}>{nextPickup.sub}</Text>
          </View>
          {isLoading && <ActivityIndicator size="small" color="#006A3B" />}
        </View>

        {/* Calendar Card */}
        <View style={s.calCard}>
          <View style={s.monthNav}>
            <TouchableOpacity onPress={goToPreviousMonth} style={s.navBtn}>
              <MaterialIcons name="chevron-left" size={24} color="#3F4941" />
            </TouchableOpacity>
            <View style={s.monthCenter}>
              <Text style={s.monthText}>{MONTH_NAMES[currentMonth]}</Text>
              <Text style={s.yearText}>{currentYear}</Text>
            </View>
            <TouchableOpacity onPress={goToNextMonth} style={s.navBtn}>
              <MaterialIcons name="chevron-right" size={24} color="#3F4941" />
            </TouchableOpacity>
          </View>

          <View style={s.dayHeaders}>
            {DAY_NAMES.map(d => (
              <Text key={d} style={[s.dayLabel, (d === "Sun" || d === "Sat") && s.dayLabelWE]}>{d}</Text>
            ))}
          </View>

          <View style={s.grid}>
            {calendarGrid.map(item => {
              if (!item.day) return <View key={item.key} style={s.cell} />;
              const day = item.day;
              const isCol = collectionDays.has(day);
              const isToday = isCurrentMonth && today.getDate() === day;
              const isSel = selectedDay === day;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={s.cell}
                  onPress={() => setSelectedDay(isSel ? null : day)}
                  activeOpacity={0.6}
                >
                  <View style={[
                    s.dayCir,
                    isCol && s.dayCirCol,
                    isToday && !isCol && s.dayCirToday,
                    isSel && s.dayCirSel,
                    isToday && isCol && s.dayCirTodayCol,
                  ]}>
                    <Text style={[
                      s.dayNum,
                      isCol && s.dayNumCol,
                      isToday && s.dayNumToday,
                      isSel && s.dayNumSel,
                    ]}>{day}</Text>
                  </View>
                  {isCol && (
                    <View style={[s.colDot, isToday && s.colDotToday]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={s.legend}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: "#D4FCDD", borderColor: "#006A3B" }]} />
              <Text style={s.legendText}>Collection day</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: "#FFFFFF", borderColor: "#006A3B" }]} />
              <Text style={s.legendText}>Today</Text>
            </View>
            <Text style={s.legendCount}>{collectionDays.size} day{collectionDays.size !== 1 ? "s" : ""}</Text>
          </View>
        </View>

        {/* Selected Day Details */}
        {selectedDay && (
          <View style={s.detailCard}>
            <View style={s.detailHeader}>
              <MaterialIcons name="event" size={20} color="#006A3B" />
              <Text style={s.detailTitle}>
                {MONTH_NAMES[currentMonth]} {selectedDay}, {currentYear}
              </Text>
            </View>
            {schedulesForDay.length > 0 ? (
              schedulesForDay.map((sched, i) => (
                <View key={sched._id || i} style={s.schedItem}>
                  <View style={s.schedIcon}>
                    <MaterialIcons name="local-shipping" size={18} color="#006A3B" />
                  </View>
                  <View style={s.schedContent}>
                    <Text style={s.schedRoute}>{sched.routeName || "Scheduled Route"}</Text>
                    <Text style={s.schedMeta}>
                      Truck {sched.truckId}{sched.driverName ? ` · ${sched.driverName}` : ""}
                      {sched.startTime ? ` · ${sched.startTime}` : ""}
                    </Text>
                    {sched.notes ? <Text style={s.schedNotes}>{sched.notes}</Text> : null}
                  </View>
                </View>
              ))
            ) : (
              <View style={s.noSched}>
                <MaterialIcons name="event-busy" size={32} color="#BECABE" />
                <Text style={s.noSchedText}>No collection scheduled</Text>
              </View>
            )}
          </View>
        )}

        {/* Quick Report */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Quick Report</Text>
          <Text style={s.sectionSub}>Report an issue in your area</Text>
          <View style={s.reportList}>
            {[
              { key: "overflowing", icon: "delete", color: "#BA1A1A", bg: "#FFDAD6", label: "Overflowing Bin", desc: "Garbage container is full or spilling over" },
              { key: "odor", icon: "air", color: "#EA580C", bg: "#FED7AA", label: "Bad Odor", desc: "Report strong smell or chemical odor" },
              { key: "missed", icon: "event-busy", color: "#7C3AED", bg: "#EDE9FE", label: "Missed Pickup", desc: "Truck missed collecting your trash" },
            ].map(r => (
              <TouchableOpacity key={r.key} style={s.reportRow} onPress={() => handleQuickReport(r.key)} activeOpacity={0.75}>
                <View style={[s.reportIcon, { backgroundColor: r.bg }]}>
                  <MaterialIcons name={r.icon} size={22} color={r.color} />
                </View>
                <View style={s.reportRowContent}>
                  <Text style={s.reportRowLabel}>{r.label}</Text>
                  <Text style={s.reportRowDesc}>{r.desc}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Reminders */}
        <View style={s.remCard}>
          <View style={s.remHeader}>
            <MaterialIcons name="lightbulb-outline" size={18} color="#006A3B" />
            <Text style={s.remTitle}>Collection Tips</Text>
          </View>
          {[
            { icon: "inventory-2", title: "Curbside Pickup", text: "Place bins at the curb by 7:00 AM" },
            { icon: "recycling", title: "Sort Your Waste", text: "Recyclables in blue, organic in green" },
            { icon: "cleaning-services", title: "Keep It Clean", text: "Rinse containers before placing in bin" },
          ].map((tip, i) => (
            <View key={i} style={s.remItem}>
              <View style={s.remIcon}>
                <MaterialIcons name={tip.icon} size={20} color="#006A3B" />
              </View>
              <View style={s.remContent}>
                <Text style={s.remItemTitle}>{tip.title}</Text>
                <Text style={s.remItemText}>{tip.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FBF9F8" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 16, marginBottom: 8 },
  headerTitle: { fontSize: 34, fontWeight: "700", color: "#1B1C1C", letterSpacing: -0.4, lineHeight: 41 },
  headerSub: { fontSize: 15, color: "#6F7A70", marginTop: 4, lineHeight: 20 },
  todayBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#D4FCDD", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  todayBtnText: { fontSize: 13, fontWeight: "600", color: "#006A3B" },

  // Pickup Banner
  pickupBanner: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#D4FCDD",
    borderRadius: 20, padding: 16, marginBottom: 16, gap: 14,
    shadowColor: "#006A3B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  pickupBannerUrgent: { backgroundColor: "#006A3B" },
  pickupIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF20", justifyContent: "center", alignItems: "center" },
  pickupIconUrgent: { backgroundColor: "#FFFFFF30" },
  pickupContent: { flex: 1 },
  pickupLabel: { fontSize: 11, fontWeight: "600", color: "#00522D", textTransform: "uppercase", letterSpacing: 1.5, lineHeight: 14 },
  pickupValue: { fontSize: 20, fontWeight: "800", color: "#006A3B", lineHeight: 26, marginTop: 2 },
  pickupValueUrgent: { color: "#FFFFFF" },
  pickupSub: { fontSize: 13, color: "#3F4941", lineHeight: 18, marginTop: 1 },

  // Calendar Card
  calCard: {
    backgroundColor: "#FFFFFF", borderRadius: 24, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: "#F0EDED",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 30, elevation: 3,
  },
  monthNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F6F3F2", justifyContent: "center", alignItems: "center" },
  monthCenter: { alignItems: "center" },
  monthText: { fontSize: 18, fontWeight: "700", color: "#1B1C1C", lineHeight: 24 },
  yearText: { fontSize: 12, color: "#6F7A70", marginTop: 1 },

  dayHeaders: { flexDirection: "row", marginBottom: 8 },
  dayLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: "#6F7A70", textTransform: "uppercase", letterSpacing: 1.2, paddingVertical: 8 },
  dayLabelWE: { color: "#BECABE" },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.28%", aspectRatio: 1, justifyContent: "center", alignItems: "center" },
  dayCir: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  dayCirCol: { backgroundColor: "#D4FCDD" },
  dayCirToday: { borderWidth: 2, borderColor: "#006A3B" },
  dayCirTodayCol: { backgroundColor: "#BDF5BE", borderWidth: 2, borderColor: "#006A3B" },
  dayCirSel: { backgroundColor: "#006A3B" },
  dayNum: { fontSize: 15, color: "#1B1C1C", fontWeight: "500" },
  dayNumCol: { color: "#006A3B", fontWeight: "600" },
  dayNumToday: { color: "#006A3B", fontWeight: "700" },
  dayNumSel: { color: "#FFFFFF", fontWeight: "700" },
  colDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#006A3B", marginTop: 2 },
  colDotToday: { backgroundColor: "#006A3B" },

  legend: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#F0EDED" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
  legendText: { fontSize: 12, color: "#6F7A70" },
  legendCount: { marginLeft: "auto", fontSize: 12, fontWeight: "600", color: "#006A3B", backgroundColor: "#D4FCDD", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },

  // Selected Day Detail
  detailCard: {
    backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: "#F0EDED",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2,
  },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F0EDED" },
  detailTitle: { fontSize: 16, fontWeight: "700", color: "#1B1C1C" },
  schedItem: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  schedIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#D4FCDD", justifyContent: "center", alignItems: "center", marginTop: 2 },
  schedContent: { flex: 1 },
  schedRoute: { fontSize: 15, fontWeight: "600", color: "#1B1C1C", lineHeight: 20 },
  schedMeta: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginTop: 2 },
  schedNotes: { fontSize: 12, color: "#6F7A70", fontStyle: "italic", marginTop: 4 },
  noSched: { alignItems: "center", paddingVertical: 20, gap: 8 },
  noSchedText: { fontSize: 14, color: "#BECABE" },

  // Quick Report
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1B1C1C", lineHeight: 24, marginBottom: 2 },
  sectionSub: { fontSize: 13, color: "#6B7280", marginBottom: 14 },
  reportList: { gap: 10 },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#F0EDED",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  reportIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  reportRowContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  reportRowLabel: {
    fontSize: 15,
    color: "#1B1C1C",
    fontWeight: "700",
  },
  reportRowDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },

  // Reminders / Tips
  remCard: {
    backgroundColor: "#F4FDF7", borderRadius: 22, padding: 18,
    borderWidth: 1, borderColor: "#E8F7EE",
  },
  remHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  remTitle: { fontSize: 12, fontWeight: "800", color: "#006A3B", textTransform: "uppercase", letterSpacing: 1.2 },
  remItem: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  remIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#E6F4EA", justifyContent: "center", alignItems: "center" },
  remContent: { flex: 1 },
  remItemTitle: { fontSize: 14, fontWeight: "700", color: "#1B1C1C", lineHeight: 18 },
  remItemText: { fontSize: 12, color: "#555F56", lineHeight: 16, marginTop: 2 },
});
