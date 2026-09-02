import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import API_URL from "../config";

const { width } = Dimensions.get("window");
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarScreen() {
  const { user } = useAuth();
  const userBarangay = user?.barangay || "";

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const today = new Date();

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
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
      if (res.ok) {
        const data = await res.json();
        setSchedules(Array.isArray(data) ? data : data.schedules || []);
      }
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules(currentYear, currentMonth);
  }, [fetchSchedules, currentYear, currentMonth]);

  const collectionDays = useMemo(() => {
    const days = new Set();
    schedules.forEach((s) => {
      const d = parseInt(s.date?.split("-")[2], 10);
      if (!isNaN(d)) days.add(d);
    });
    return days;
  }, [schedules]);

  const schedulesForDay = useMemo(() => {
    if (!selectedDay) return [];
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
    return schedules.filter((s) => s.date === dateStr);
  }, [selectedDay, schedules, currentYear, currentMonth]);

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push({ day: null, key: `empty-${i}` });
    for (let d = 1; d <= daysInMonth; d++) days.push({ day: d, key: `day-${d}` });
    return days;
  }, [currentYear, currentMonth]);

  const nextPickup = useMemo(() => {
    if (today.getFullYear() === currentYear && today.getMonth() === currentMonth) {
      const todayDay = today.getDate();
      const upcoming = [...collectionDays].filter((d) => d >= todayDay).sort((a, b) => a - b);
      if (upcoming.length > 0) {
        const diff = upcoming[0] - todayDay;
        const matchingSched = schedules.find(
          (s) => s.date === `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(upcoming[0]).padStart(2, "0")}`
        );
        if (diff === 0) {
          return {
            label: "Today!",
            sub: matchingSched ? `Route: ${matchingSched.routeName || matchingSched.barangay}` : "Collection scheduled for today",
            truck: matchingSched?.truckId,
            urgent: true,
          };
        }
        if (diff === 1) {
          return {
            label: "Tomorrow",
            sub: `${MONTH_NAMES[currentMonth]} ${upcoming[0]}${matchingSched ? ` · ${matchingSched.routeName || matchingSched.barangay}` : ""}`,
            truck: matchingSched?.truckId,
            urgent: false,
          };
        }
        return {
          label: `In ${diff} days`,
          sub: `${MONTH_NAMES[currentMonth]} ${upcoming[0]}${matchingSched ? ` · ${matchingSched.routeName || matchingSched.barangay}` : ""}`,
          truck: matchingSched?.truckId,
          urgent: false,
        };
      }
      return { label: "Completed", sub: "No more pickups remaining this month", urgent: false };
    }
    const sorted = [...collectionDays].sort((a, b) => a - b);
    return sorted.length > 0
      ? { label: `${MONTH_NAMES[currentMonth]} ${sorted[0]}`, sub: `${sorted.length} collection days this month`, urgent: false }
      : { label: "No schedule", sub: "No collection scheduled for this month", urgent: false };
  }, [currentYear, currentMonth, collectionDays, schedules]);

  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Top Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Collection Calendar</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <MaterialIcons name="location-on" size={14} color="#006A3B" />
              <Text style={styles.headerSub}>
                {userBarangay ? `Barangay ${userBarangay}` : "All Routes"}
              </Text>
            </View>
          </View>
          {!isCurrentMonth ? (
            <TouchableOpacity style={styles.todayBtn} onPress={goToToday} activeOpacity={0.8}>
              <MaterialIcons name="today" size={16} color="#006A3B" />
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.monthPill}>
              <Text style={styles.monthPillText}>{MONTH_NAMES[currentMonth].slice(0, 3)} {currentYear}</Text>
            </View>
          )}
        </View>

        {/* Next Pickup Hero Card */}
        <View style={[styles.pickupHero, nextPickup.urgent && styles.pickupHeroUrgent]}>
          <View style={styles.pickupHeroTop}>
            <View style={[styles.pickupIconWrap, nextPickup.urgent && styles.pickupIconWrapUrgent]}>
              <MaterialIcons
                name={nextPickup.urgent ? "local-shipping" : "event-available"}
                size={22}
                color={nextPickup.urgent ? "#FFFFFF" : "#006A3B"}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.pickupTag, nextPickup.urgent && styles.pickupTagUrgent]}>
                NEXT COLLECTION
              </Text>
              <Text style={[styles.pickupTitle, nextPickup.urgent && styles.pickupTitleUrgent]}>
                {nextPickup.label}
              </Text>
            </View>
            {nextPickup.truck && (
              <View style={[styles.truckBadge, nextPickup.urgent && styles.truckBadgeUrgent]}>
                <MaterialIcons name="directions-car" size={13} color={nextPickup.urgent ? "#FFFFFF" : "#006A3B"} />
                <Text style={[styles.truckBadgeText, nextPickup.urgent && styles.truckBadgeTextUrgent]}>
                  {nextPickup.truck}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.pickupSubtext, nextPickup.urgent && styles.pickupSubtextUrgent]} numberOfLines={1}>
            {nextPickup.sub}
          </Text>
        </View>

        {/* Calendar Card */}
        <View style={styles.calendarCard}>
          {/* Month Switcher */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={goToPreviousMonth} style={styles.navArrowBtn} activeOpacity={0.7}>
              <MaterialIcons name="chevron-left" size={24} color="#1E293B" />
            </TouchableOpacity>
            <View style={styles.monthCenter}>
              <Text style={styles.monthName}>{MONTH_NAMES[currentMonth]}</Text>
              <Text style={styles.yearName}>{currentYear}</Text>
            </View>
            <TouchableOpacity onPress={goToNextMonth} style={styles.navArrowBtn} activeOpacity={0.7}>
              <MaterialIcons name="chevron-right" size={24} color="#1E293B" />
            </TouchableOpacity>
          </View>

          {/* Weekday Names */}
          <View style={styles.weekRow}>
            {DAY_NAMES.map((d) => (
              <Text key={d} style={[styles.weekDayLabel, (d === "Sun" || d === "Sat") && styles.weekDayWeekend]}>
                {d}
              </Text>
            ))}
          </View>

          {/* Month Grid */}
          <View style={styles.gridContainer}>
            {calendarGrid.map((item) => {
              if (!item.day) return <View key={item.key} style={styles.gridCell} />;
              const day = item.day;
              const isCol = collectionDays.has(day);
              const isToday = isCurrentMonth && today.getDate() === day;
              const isSel = selectedDay === day;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={styles.gridCell}
                  onPress={() => setSelectedDay(isSel ? null : day)}
                  activeOpacity={0.6}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isCol && styles.dayCircleCollection,
                      isToday && styles.dayCircleToday,
                      isSel && styles.dayCircleSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        isCol && styles.dayNumberCollection,
                        isToday && styles.dayNumberToday,
                        isSel && styles.dayNumberSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                  {isCol && (
                    <View style={[styles.collectionDot, isSel && styles.collectionDotSelected]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendIndicator, { backgroundColor: "#DCFCE7", borderColor: "#059669" }]} />
              <Text style={styles.legendLabel}>Collection Day</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendIndicator, { backgroundColor: "#FFFFFF", borderColor: "#006A3B" }]} />
              <Text style={styles.legendLabel}>Today</Text>
            </View>
            <View style={styles.legendCountPill}>
              <Text style={styles.legendCountText}>
                {collectionDays.size} {collectionDays.size === 1 ? "day" : "days"}
              </Text>
            </View>
          </View>
        </View>

        {/* Schedules Section */}
        <View style={styles.schedulesSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                {selectedDay
                  ? `Schedules for ${MONTH_NAMES[currentMonth]} ${selectedDay}`
                  : `Monthly Collection Schedules`}
              </Text>
              <Text style={styles.sectionSubtitle}>
                {selectedDay
                  ? `${schedulesForDay.length} pickup${schedulesForDay.length !== 1 ? "s" : ""} on this date`
                  : `${schedules.length} total route${schedules.length !== 1 ? "s" : ""} in ${MONTH_NAMES[currentMonth]}`}
              </Text>
            </View>
            {selectedDay && (
              <TouchableOpacity onPress={() => setSelectedDay(null)} style={styles.clearBtn} activeOpacity={0.7}>
                <Text style={styles.clearBtnText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#006A3B" />
              <Text style={styles.loadingText}>Loading schedules...</Text>
            </View>
          ) : selectedDay ? (
            /* Selected Date Schedules */
            schedulesForDay.length > 0 ? (
              schedulesForDay.map((sched, idx) => (
                <View key={sched._id || idx} style={styles.scheduleCard}>
                  <View style={styles.scheduleCardHeader}>
                    <View style={styles.truckIconBadge}>
                      <MaterialIcons name="local-shipping" size={20} color="#006A3B" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.scheduleRouteName}>
                        {sched.routeName || sched.barangay || "Collection Route"}
                      </Text>
                      <Text style={styles.scheduleTruckMeta}>
                        Truck {sched.truckId || "GT-001"} · {sched.driverName || "Driver Assigned"}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusPill,
                      sched.status === "completed" ? styles.statusPillDone : styles.statusPillActive
                    ]}>
                      <Text style={[
                        styles.statusPillText,
                        sched.status === "completed" ? styles.statusPillTextDone : styles.statusPillTextActive
                      ]}>
                        {sched.status ? sched.status.toUpperCase() : "SCHEDULED"}
                      </Text>
                    </View>
                  </View>

                  {/* Shift Time */}
                  {sched.startTime && (
                    <View style={styles.scheduleTimeRow}>
                      <MaterialIcons name="schedule" size={14} color="#64748B" />
                      <Text style={styles.scheduleTimeText}>
                        Shift: {sched.startTime} {sched.endTime ? `- ${sched.endTime}` : ""}
                      </Text>
                    </View>
                  )}

                  {/* Route Stops Checklist */}
                  {sched.sitioTasks && sched.sitioTasks.length > 0 && (
                    <View style={styles.stopsContainer}>
                      <Text style={styles.stopsHeader}>Route Stops Checklist:</Text>
                      <View style={styles.stopsList}>
                        {sched.sitioTasks.map((t, sIdx) => (
                          <View key={sIdx} style={styles.stopRow}>
                            <MaterialIcons
                              name={t.completed ? "check-circle" : "radio-button-unchecked"}
                              size={15}
                              color={t.completed ? "#059669" : "#94A3B8"}
                            />
                            <Text style={[styles.stopText, t.completed && styles.stopTextDone]}>
                              {t.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {sched.notes && (
                    <View style={styles.notesBox}>
                      <Text style={styles.notesText}>Note: {sched.notes}</Text>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <MaterialIcons name="event-busy" size={40} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No Collection Scheduled</Text>
                <Text style={styles.emptySub}>
                  No garbage collection is assigned for {MONTH_NAMES[currentMonth]} {selectedDay}.
                </Text>
              </View>
            )
          ) : (
            /* Month Schedules Overview List */
            schedules.length > 0 ? (
              schedules.map((sched, idx) => {
                const dayNum = sched.date?.split("-")[2] || "01";
                const isPast = isCurrentMonth && parseInt(dayNum, 10) < today.getDate();
                const isToday = isCurrentMonth && parseInt(dayNum, 10) === today.getDate();

                return (
                  <TouchableOpacity
                    key={sched._id || idx}
                    style={[styles.scheduleCard, isToday && styles.scheduleCardToday]}
                    onPress={() => setSelectedDay(parseInt(dayNum, 10))}
                    activeOpacity={0.8}
                  >
                    <View style={styles.scheduleCardHeader}>
                      {/* Date Stamp Pill */}
                      <View style={[styles.dateStamp, isToday && styles.dateStampToday, isPast && styles.dateStampPast]}>
                        <Text style={[styles.dateStampMonth, isToday && styles.dateStampMonthToday]}>
                          {MONTH_NAMES[currentMonth].slice(0, 3).toUpperCase()}
                        </Text>
                        <Text style={[styles.dateStampDay, isToday && styles.dateStampDayToday]}>
                          {dayNum}
                        </Text>
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={styles.scheduleRouteName} numberOfLines={1}>
                            {sched.routeName || sched.barangay || "Collection Route"}
                          </Text>
                        </View>
                        <Text style={styles.scheduleTruckMeta} numberOfLines={1}>
                          Truck {sched.truckId || "GT-001"} · {sched.driverName || "Driver Assigned"}
                        </Text>
                      </View>

                      <View style={[
                        styles.statusPill,
                        isToday ? styles.statusPillToday : isPast ? styles.statusPillPast : styles.statusPillActive
                      ]}>
                        <Text style={[
                          styles.statusPillText,
                          isToday ? styles.statusPillTextToday : isPast ? styles.statusPillTextPast : styles.statusPillTextActive
                        ]}>
                          {isToday ? "TODAY" : isPast ? "COMPLETED" : "UPCOMING"}
                        </Text>
                      </View>
                    </View>

                    {sched.sitioTasks && sched.sitioTasks.length > 0 && (
                      <View style={styles.cardStopsSummary}>
                        <MaterialIcons name="place" size={13} color="#059669" />
                        <Text style={styles.cardStopsText} numberOfLines={1}>
                          {sched.sitioTasks.length} stops ({sched.sitioTasks.map(t => t.name).join(", ")})
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <MaterialIcons name="calendar-today" size={40} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No Schedules for this Month</Text>
                <Text style={styles.emptySub}>
                  No collection schedules have been posted for {MONTH_NAMES[currentMonth]} {currentYear} yet.
                </Text>
              </View>
            )
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: "#006A3B",
    fontWeight: "600",
  },
  todayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#006A3B",
  },
  monthPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  monthPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },

  // Pickup Hero Banner
  pickupHero: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  pickupHeroUrgent: {
    backgroundColor: "#006A3B",
    borderColor: "#00522D",
  },
  pickupHeroTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  pickupIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  pickupIconWrapUrgent: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  pickupTag: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 1,
  },
  pickupTagUrgent: {
    color: "#A7F3D0",
  },
  pickupTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 1,
  },
  pickupTitleUrgent: {
    color: "#FFFFFF",
  },
  truckBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  truckBadgeUrgent: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  truckBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#006A3B",
  },
  truckBadgeTextUrgent: {
    color: "#FFFFFF",
  },
  pickupSubtext: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 10,
    fontWeight: "500",
  },
  pickupSubtextUrgent: {
    color: "#E2E8F0",
  },

  // Calendar Card
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 2,
  },
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  monthCenter: {
    alignItems: "center",
  },
  monthName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  yearName: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 1,
  },

  weekRow: {
    flexDirection: "row",
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 6,
  },
  weekDayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
  },
  weekDayWeekend: {
    color: "#94A3B8",
  },

  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  dayCircleCollection: {
    backgroundColor: "#DCFCE7",
  },
  dayCircleToday: {
    borderWidth: 2,
    borderColor: "#006A3B",
  },
  dayCircleSelected: {
    backgroundColor: "#006A3B",
  },
  dayNumber: {
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "500",
  },
  dayNumberCollection: {
    color: "#065F46",
    fontWeight: "700",
  },
  dayNumberToday: {
    color: "#006A3B",
    fontWeight: "800",
  },
  dayNumberSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  collectionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#059669",
    marginTop: 2,
  },
  collectionDotSelected: {
    backgroundColor: "#006A3B",
  },

  legendContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  legendLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  legendCountPill: {
    marginLeft: "auto",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  legendCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#006A3B",
  },

  // Schedules Section
  schedulesSection: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  clearBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#006A3B",
  },

  scheduleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  scheduleCardToday: {
    borderColor: "#6EE7B7",
    backgroundColor: "#F0FDF4",
  },
  scheduleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  truckIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  scheduleRouteName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  scheduleTruckMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusPillActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#D1FAE5",
  },
  statusPillTextActive: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
  },
  statusPillDone: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  statusPillTextDone: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
  },
  statusPillToday: {
    backgroundColor: "#006A3B",
    borderColor: "#006A3B",
  },
  statusPillTextToday: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statusPillPast: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  statusPillTextPast: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
  },

  scheduleTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  scheduleTimeText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },

  stopsContainer: {
    marginTop: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
  },
  stopsHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  stopsList: {
    gap: 4,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stopText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "500",
  },
  stopTextDone: {
    color: "#059669",
    fontWeight: "600",
    textDecorationLine: "line-through",
  },

  notesBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  notesText: {
    fontSize: 11,
    color: "#B45309",
    fontStyle: "italic",
  },

  // Date Stamp for overview card
  dateStamp: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  dateStampToday: {
    backgroundColor: "#006A3B",
    borderColor: "#006A3B",
  },
  dateStampPast: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  dateStampMonth: {
    fontSize: 9,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.5,
  },
  dateStampMonthToday: {
    color: "#A7F3D0",
  },
  dateStampDay: {
    fontSize: 16,
    fontWeight: "800",
    color: "#065F46",
  },
  dateStampDayToday: {
    color: "#FFFFFF",
  },

  cardStopsSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  cardStopsText: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "500",
    flex: 1,
  },

  loadingBox: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
  },

  emptyState: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
});
