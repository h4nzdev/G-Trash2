import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import colors from "../constants/colors";
import API_URL from "../config";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarScreen() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // 0-based
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const today = new Date();

  const handleQuickReport = (type) => {
    const messages = {
      overflowing:
        "Thank you! We've received your report about an overflowing bin.",
      odor: "Thank you! We've received your report about bad odor.",
    };
    Alert.alert("Quick Report", messages[type] || "Report submitted.");
  };

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };
  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const fetchSchedules = useCallback(async (year, month) => {
    setIsLoading(true);
    try {
      const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
      const res = await fetch(`${API_URL}/api/schedules?month=${monthStr}`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (_) {
      // silently fail — calendar still works showing no highlights
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules(currentYear, currentMonth);
  }, [fetchSchedules, currentYear, currentMonth]);

  // Set of day-of-month numbers that have a scheduled collection
  const collectionDays = useMemo(() => {
    const days = new Set();
    schedules.forEach((s) => {
      const d = parseInt(s.date?.split("-")[2], 10);
      if (!isNaN(d)) days.add(d);
    });
    return days;
  }, [schedules]);

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++)
      days.push({ day: null, key: `empty-${i}` });
    for (let d = 1; d <= daysInMonth; d++)
      days.push({ day: d, key: `day-${d}` });
    return days;
  }, [currentYear, currentMonth]);

  const nextPickup = useMemo(() => {
    const todayDate = new Date();
    if (
      todayDate.getFullYear() === currentYear &&
      todayDate.getMonth() === currentMonth
    ) {
      const todayDay = todayDate.getDate();
      const upcoming = [...collectionDays]
        .filter((d) => d >= todayDay)
        .sort((a, b) => a - b);
      if (upcoming.length > 0) {
        const daysUntil = upcoming[0] - todayDay;
        if (daysUntil === 0) return "Today!";
        if (daysUntil === 1) return "Tomorrow";
        return `in ${daysUntil} days`;
      }
      return collectionDays.size > 0
        ? "No more pickups this month"
        : "No pickups scheduled";
    }
    const sorted = [...collectionDays].sort((a, b) => a - b);
    return sorted.length > 0
      ? `${MONTH_NAMES[currentMonth]} ${sorted[0]}`
      : "No pickups scheduled";
  }, [currentYear, currentMonth, collectionDays]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Waste Collection</Text>
          <Text style={styles.subtitle}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </Text>
        </View>

        {/* Next Pickup Card */}
        <View style={styles.nextPickupCard}>
          <MaterialIcons
            name="notifications-active"
            size={22}
            color="#006A3B"
          />
          <View style={styles.nextPickupContent}>
            <Text style={styles.nextPickupTitle}>Next pickup</Text>
            <Text style={styles.nextPickupDate}>{nextPickup}</Text>
          </View>
          {isLoading && <ActivityIndicator size="small" color="#006A3B" />}
        </View>

        {/* Monthly Calendar Card */}
        <View style={styles.calendarCard}>
          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={goToPreviousMonth}
              style={styles.navButton}
            >
              <MaterialIcons name="chevron-left" size={24} color="#6F7A70" />
            </TouchableOpacity>
            <Text style={styles.monthText}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </Text>
            <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
              <MaterialIcons name="chevron-right" size={24} color="#6F7A70" />
            </TouchableOpacity>
          </View>

          {/* Day Headers */}
          <View style={styles.dayHeaders}>
            {DAY_NAMES.map((day) => (
              <Text key={day} style={styles.dayLabel}>
                {day}
              </Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.grid}>
            {calendarGrid.map((item) => {
              if (item.day === null) {
                return <View key={item.key} style={styles.dayCell} />;
              }
              const day = item.day;
              const isCollection = collectionDays.has(day);
              const isToday =
                today.getFullYear() === currentYear &&
                today.getMonth() === currentMonth &&
                today.getDate() === day;

              return (
                <View
                  key={item.key}
                  style={[
                    styles.dayCell,
                    isToday && !isCollection && styles.todayCell,
                  ]}
                >
                  {isCollection ? (
                    <View style={styles.collectionDayContainer}>
                      <View
                        style={[
                          styles.collectionDayCircle,
                          isToday && styles.collectionTodayCircle,
                        ]}
                      >
                        <Text style={styles.collectionDayNumber}>{day}</Text>
                      </View>
                      <MaterialIcons
                        name="local-shipping"
                        size={10}
                        color="#00731E"
                      />
                    </View>
                  ) : (
                    <Text
                      style={[styles.dayNumber, isToday && styles.todayNumber]}
                    >
                      {day}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Legend */}
          {collectionDays.size > 0 && (
            <View style={styles.legend}>
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>Collection day</Text>
            </View>
          )}
        </View>

        {/* Quick Report Section */}
        <View style={styles.quickReportSection}>
          <Text style={styles.sectionTitle}>Quick Report</Text>
          <View style={styles.quickReportGrid}>
            <TouchableOpacity
              style={styles.reportCard}
              onPress={() => handleQuickReport("overflowing")}
              activeOpacity={0.7}
            >
              <View style={[styles.reportIcon, styles.overflowIcon]}>
                <MaterialIcons name="delete" size={28} color="#BA1A1A" />
              </View>
              <Text style={styles.reportLabel}>Overflowing Bin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reportCard}
              onPress={() => handleQuickReport("odor")}
              activeOpacity={0.7}
            >
              <View style={[styles.reportIcon, styles.odorIcon]}>
                <MaterialIcons name="air" size={28} color="#EA580C" />
              </View>
              <Text style={styles.reportLabel}>Bad Odor</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Reminders Card */}
        <View style={styles.remindersCard}>
          <Text style={styles.remindersHeader}>Today's Reminders</Text>
          <View style={styles.reminderItem}>
            <View style={styles.reminderIconContainer}>
              <MaterialIcons name="inventory-2" size={20} color="#3F4941" />
            </View>
            <View style={styles.reminderContent}>
              <Text style={styles.reminderTitle}>Curbside Pickup</Text>
              <Text style={styles.reminderText}>
                Ensure bins are out by 7:00 AM
              </Text>
            </View>
          </View>
          <View style={styles.reminderItem}>
            <View style={styles.reminderIconContainer}>
              <MaterialIcons name="recycling" size={20} color="#3F4941" />
            </View>
            <View style={styles.reminderContent}>
              <Text style={styles.reminderTitle}>Sort Your Waste</Text>
              <Text style={styles.reminderText}>
                Place recyclables in blue bins
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FBF9F8" },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },

  titleSection: { paddingVertical: 16, marginBottom: 12 },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#1B1C1C",
    letterSpacing: -0.4,
    lineHeight: 41,
  },
  subtitle: { fontSize: 15, color: "#6F7A70", marginTop: 4, lineHeight: 20 },

  nextPickupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D4FCDD",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  nextPickupContent: { flex: 1 },
  nextPickupTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#00522D",
    lineHeight: 20,
  },
  nextPickupDate: {
    fontSize: 17,
    fontWeight: "700",
    color: "#006A3B",
    lineHeight: 22,
    marginTop: 2,
  },

  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E4E2E1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
    marginBottom: 24,
  },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F6F3F2",
    justifyContent: "center",
    alignItems: "center",
  },
  monthText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1B1C1C",
    lineHeight: 22,
  },

  dayHeaders: { flexDirection: "row", marginBottom: 16 },
  dayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    color: "#6F7A70",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    lineHeight: 16,
    paddingVertical: 8,
  },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dayNumber: { fontSize: 15, color: "#1B1C1C" },
  todayCell: { borderRadius: 20, borderWidth: 1.5, borderColor: "#006A3B" },
  todayNumber: { color: "#006A3B", fontWeight: "600" },

  collectionDayContainer: { alignItems: "center", justifyContent: "center" },
  collectionDayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D9F8DA",
    borderWidth: 1,
    borderColor: "#006E1C",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  collectionTodayCircle: {
    backgroundColor: "#BDF5BE",
    borderColor: "#006A3B",
    borderWidth: 2,
  },
  collectionDayNumber: {
    fontSize: 17,
    fontWeight: "600",
    color: "#006E1C",
    lineHeight: 22,
  },

  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0EDED",
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#BDF5BE",
    borderWidth: 1,
    borderColor: "#006E1C",
  },
  legendText: { fontSize: 12, color: "#6F7A70" },

  quickReportSection: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1B1C1C",
    marginBottom: 12,
    paddingHorizontal: 4,
    lineHeight: 22,
  },
  quickReportGrid: { flexDirection: "row", gap: 16 },
  reportCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E4E2E1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  reportIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  overflowIcon: { backgroundColor: "#FFDAD6" },
  odorIcon: { backgroundColor: "#FED7AA" },
  reportLabel: {
    fontSize: 15,
    color: "#1B1C1C",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },

  remindersCard: {
    backgroundColor: "#F6F3F2",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  remindersHeader: {
    fontSize: 12,
    color: "#6F7A70",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 12,
    lineHeight: 16,
  },
  reminderItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  reminderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E4E2E1",
    justifyContent: "center",
    alignItems: "center",
  },
  reminderContent: { flex: 1 },
  reminderTitle: { fontSize: 17, color: "#1B1C1C", lineHeight: 22 },
  reminderText: { fontSize: 13, color: "#6F7A70", lineHeight: 18 },

  bottomSpacer: { height: 40 },
});
