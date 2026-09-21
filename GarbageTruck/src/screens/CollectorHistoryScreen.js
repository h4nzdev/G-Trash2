import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
  Dimensions,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import API_URL from "../config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DATE_FILTERS = ["Today", "This Week", "This Month", "All"];
const DAILY_STOP_GOAL = 8;
const INITIAL_VISIBLE_COUNT = 5;

function formatTime(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatYMD(dateInput) {
  if (!dateInput) return "";
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getLogDateStr(log) {
  if (!log) return "";
  // 1. If completedAt exists (when the route or stop was completed)
  if (log.completedAt) {
    const ymd = formatYMD(log.completedAt);
    if (ymd) return ymd;
  }
  // 2. If date is already in YYYY-MM-DD format
  if (typeof log.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(log.date)) {
    return log.date.substring(0, 10);
  }
  // 3. Fallback to createdAt
  if (log.createdAt) {
    const ymd = formatYMD(log.createdAt);
    if (ymd) return ymd;
  }
  // 4. Fallback to parsing log.date if string
  if (log.date) {
    const ymd = formatYMD(log.date);
    if (ymd) return ymd;
  }
  return "";
}

function getWeekInfo() {
  const now = new Date();
  const dow = now.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon, 0, 0, 0, 0);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);
  const startYMD = formatYMD(monday);
  const endYMD = formatYMD(sunday);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    days.push(formatYMD(d));
  }
  return { startYMD, endYMD, days };
}

export default function CollectorHistoryScreen() {
  const { user } = useAuth();
  const TRUCK_ID = user?.truckId ?? "GT-000";

  const [activeFilter, setActiveFilter] = useState("Today");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [allLogs, setAllLogs] = useState([]);
  const [scheduledStops, setScheduledStops] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const todayYMD = useMemo(() => formatYMD(new Date()), []);
  const { startYMD: weekStartYMD, endYMD: weekEndYMD, days: weekDays } = useMemo(() => getWeekInfo(), []);
  const currentYM = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const [logsRes, routeRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/collections/truck/${TRUCK_ID}?period=all`).then((r) => r.json()),
        fetch(`${API_URL}/api/routes/truck/${TRUCK_ID}`).then((r) => r.json()),
      ]);
      if (logsRes.status === "fulfilled" && Array.isArray(logsRes.value)) {
        setAllLogs(logsRes.value);
      }
      if (routeRes.status === "fulfilled" && Array.isArray(routeRes.value?.waypoints)) {
        setScheduledStops(routeRes.value.waypoints.length);
      }
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [TRUCK_ID]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  // Filter logs for the selected chip
  const filteredLogs = useMemo(() => {
    if (activeFilter === "Today") {
      return allLogs.filter((l) => {
        const dStr = getLogDateStr(l);
        if (dStr === todayYMD) return true;
        if (typeof l.date === "string" && l.date.startsWith(todayYMD)) return true;
        if (l.completedAt && formatYMD(l.completedAt) === todayYMD) return true;
        return false;
      });
    }
    if (activeFilter === "This Week") {
      return allLogs.filter((l) => {
        const dStr = getLogDateStr(l);
        if (dStr && dStr >= weekStartYMD && dStr <= weekEndYMD) return true;
        if (l.date && weekDays.includes(l.date)) return true;
        return false;
      });
    }
    if (activeFilter === "This Month") {
      return allLogs.filter((l) => {
        const dStr = getLogDateStr(l);
        if (dStr && dStr.startsWith(currentYM)) return true;
        if (typeof l.date === "string" && l.date.startsWith(currentYM)) return true;
        return false;
      });
    }
    return allLogs;
  }, [allLogs, activeFilter, todayYMD, weekStartYMD, weekEndYMD, weekDays, currentYM]);

  const displayedLogs = useMemo(() => {
    return filteredLogs.slice(0, visibleCount);
  }, [filteredLogs, visibleCount]);

  // Weekly chart always shows the current week regardless of chip
  const weeklyData = useMemo(() => {
    const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return DAYS_SHORT.map((day, i) => {
      const dateStr = weekDays[i];
      const dayLogs = allLogs.filter((l) => {
        const dStr = getLogDateStr(l);
        return dStr === dateStr || l.date === dateStr;
      });
      const stops = dayLogs.length;
      const bins = dayLogs.reduce((sum, l) => sum + (l.bins || 0), 0);
      return { day, stops, bins, target: DAILY_STOP_GOAL, date: dateStr };
    });
  }, [allLogs, weekDays]);

  // Derived stats
  const totalBins = filteredLogs.reduce((sum, l) => sum + (l.bins || 0), 0);
  const completedStops = filteredLogs.length;
  const totalStops = activeFilter === "Today" && scheduledStops > 0 ? scheduledStops : completedStops;
  const efficiency = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  const weeklyTotal = weeklyData.reduce((sum, d) => sum + d.stops, 0);
  const weeklyNonZero = weeklyData.filter((d) => d.stops > 0);
  const weeklyAverage = weeklyNonZero.length > 0 ? Math.round(weeklyTotal / weeklyNonZero.length) : 0;
  const bestDay = weeklyData.reduce((best, curr) => (curr.stops > best.stops ? curr : best), { day: "—", stops: 0 });
  const MAX_STOPS = Math.max(DAILY_STOP_GOAL, ...weeklyData.map((d) => d.stops));

  const summaryLabel =
    activeFilter === "Today" ? "Today's Summary" :
    activeFilter === "This Week" ? "This Week's Summary" :
    activeFilter === "This Month" ? "This Month's Summary" :
    "All-Time Summary";

  const periodStopGoal =
    activeFilter === "Today" ? DAILY_STOP_GOAL :
    activeFilter === "This Week" ? DAILY_STOP_GOAL * 5 :
    activeFilter === "This Month" ? DAILY_STOP_GOAL * 22 :
    DAILY_STOP_GOAL * 30;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBF9F8" />

      {/* Fixed Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.avatar} onPress={fetchHistory} activeOpacity={0.7}>
            <MaterialIcons name="refresh" size={20} color="#BECABE" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Title */}
        <Text style={styles.pageTitle}>Collection History</Text>

        {/* Date Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {DATE_FILTERS.map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => {
                  setActiveFilter(filter);
                  setVisibleCount(INITIAL_VISIBLE_COUNT);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#006A3B" />
            <Text style={styles.loadingText}>Loading history…</Text>
          </View>
        ) : hasError ? (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={36} color="#EF4444" />
            <Text style={styles.errorText}>Could not load history</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchHistory}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Stats Cards Row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={[styles.statIconBg, { backgroundColor: "#E4EEE9" }]}>
                  <MaterialIcons name="delete-sweep" size={20} color="#006A3B" />
                </View>
                <Text style={styles.statValue}>{totalBins}</Text>
                <Text style={styles.statLabel}>Bins</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconBg, { backgroundColor: "#E4EEE9" }]}>
                  <MaterialIcons name="location-on" size={20} color="#006E1C" />
                </View>
                <Text style={styles.statValue}>
                  {completedStops}{totalStops > completedStops ? `/${totalStops}` : ""}
                </Text>
                <Text style={styles.statLabel}>Stops</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconBg, { backgroundColor: "#FEF4DC" }]}>
                  <MaterialIcons name="speed" size={20} color="#F59E0B" />
                </View>
                <Text style={styles.statValue}>{efficiency}%</Text>
                <Text style={styles.statLabel}>Efficiency</Text>
              </View>
            </View>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View>
                  <Text style={styles.summaryLabel}>{summaryLabel}</Text>
                  <Text style={styles.summaryValue}>
                    {completedStops} {completedStops === 1 ? "stop" : "stops"} done
                  </Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: Math.min((completedStops / Math.max(periodStopGoal, 1)) * 100, 100) + "%" },
                  ]}
                />
              </View>
              <View style={styles.summaryBottom}>
                <Text style={styles.summaryMeta}>{totalBins} bins collected</Text>
                <Text style={styles.summaryMeta}>Goal: {periodStopGoal} stops</Text>
              </View>
            </View>

            {/* Collection Log */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Collection Log</Text>
                  {filteredLogs.length > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>
                        {filteredLogs.length > INITIAL_VISIBLE_COUNT
                          ? `${displayedLogs.length} of ${filteredLogs.length}`
                          : `${filteredLogs.length}`}
                      </Text>
                    </View>
                  )}
                </View>
                {filteredLogs.length > INITIAL_VISIBLE_COUNT && (
                  <TouchableOpacity
                    style={styles.seeAllHeaderBtn}
                    onPress={() => {
                      if (visibleCount < filteredLogs.length) {
                        setVisibleCount(filteredLogs.length);
                      } else {
                        setVisibleCount(INITIAL_VISIBLE_COUNT);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.seeAllHeaderText}>
                      {visibleCount < filteredLogs.length ? "See All" : "Show Less"}
                    </Text>
                    <MaterialIcons
                      name={visibleCount < filteredLogs.length ? "chevron-right" : "expand-less"}
                      size={18}
                      color="#006A3B"
                    />
                  </TouchableOpacity>
                )}
              </View>

              {filteredLogs.length === 0 ? (
                <View style={styles.emptyLog}>
                  <MaterialIcons name="history" size={32} color="#DCD9D9" />
                  <Text style={styles.emptyLogText}>No collections logged for this period</Text>
                </View>
              ) : (
                <View style={styles.logCard}>
                  {displayedLogs.map((item, index) => {
                    const isLast = index === displayedLogs.length - 1;
                    return (
                      <View key={item._id || index}>
                        <View style={styles.logItem}>
                          <View style={styles.logTimeCol}>
                            <View style={styles.logTimeDot}>
                              <MaterialIcons name="check-circle" size={16} color="#006A3B" />
                            </View>
                            {(!isLast || (filteredLogs.length > displayedLogs.length)) && (
                              <View style={styles.logTimeLine} />
                            )}
                          </View>
                          <View style={styles.logContent}>
                            <View style={styles.logContentLeft}>
                              <Text style={styles.logLocation}>{item.stopName || "—"}</Text>
                              <Text style={styles.logAddress}>{item.stopAddress || item.routeName || "—"}</Text>
                              <View style={styles.logMetaRow}>
                                <Text style={styles.logTimeText}>{formatTime(item.completedAt || item.createdAt)}</Text>
                                <View style={styles.logMetaDot} />
                                <Text style={styles.logMetaText}>{item.wasteType || "General"}</Text>
                                <View style={styles.logMetaDot} />
                                <Text style={styles.logMetaText}>{item.bins || 1} bins</Text>
                                {item.weight > 0 && (
                                  <>
                                    <View style={styles.logMetaDot} />
                                    <Text style={[styles.logMetaText, { color: "#006A3B", fontWeight: "800" }]}>
                                      {item.weight} {item.weightUnit || "kg"}
                                    </Text>
                                  </>
                                )}
                              </View>
                              {item.disposalFacility ? (
                                <Text style={{ fontSize: 10, color: "#006A3B", fontWeight: "700", marginTop: 2 }}>
                                  🏭 {item.disposalFacility}
                                </Text>
                              ) : null}
                            </View>
                            <View style={styles.logContentRight}>
                              <Text style={styles.logBins}>{item.bins || 0}</Text>
                              <Text style={styles.logBinsLabel}>bins</Text>
                            </View>
                          </View>
                        </View>
                        {(!isLast || filteredLogs.length > displayedLogs.length) && <View style={styles.logDivider} />}
                      </View>
                    );
                  })}

                  {filteredLogs.length > INITIAL_VISIBLE_COUNT && (
                    <View style={styles.paginationFooter}>
                      {visibleCount < filteredLogs.length ? (
                        <View style={styles.paginationRow}>
                          <TouchableOpacity
                            style={styles.loadMoreBtn}
                            onPress={() =>
                              setVisibleCount((prev) =>
                                Math.min(prev + INITIAL_VISIBLE_COUNT, filteredLogs.length)
                              )
                            }
                            activeOpacity={0.7}
                          >
                            <MaterialIcons name="expand-more" size={18} color="#006A3B" />
                            <Text style={styles.loadMoreBtnText}>
                              Load More (+{Math.min(INITIAL_VISIBLE_COUNT, filteredLogs.length - visibleCount)})
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.seeAllBtn}
                            onPress={() => setVisibleCount(filteredLogs.length)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.seeAllBtnText}>See All ({filteredLogs.length})</Text>
                            <MaterialIcons name="arrow-forward" size={14} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.showLessBtn}
                          onPress={() => setVisibleCount(INITIAL_VISIBLE_COUNT)}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="expand-less" size={18} color="#6F7A70" />
                          <Text style={styles.showLessBtnText}>
                            Show Less (Top {INITIAL_VISIBLE_COUNT})
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Weekly Performance */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Weekly Performance</Text>
                <View style={styles.weekTotalBadge}>
                  <Text style={styles.weekTotalText}>{weeklyTotal} stops</Text>
                </View>
              </View>

              <View style={styles.weekCard}>
                <View style={styles.chartContainer}>
                  {weeklyData.map((item, index) => {
                    const barHeight = item.stops > 0 ? Math.max(4, (item.stops / MAX_STOPS) * 100) : 0;
                    const isAbove = item.stops >= item.target;
                    const isTodayBar = item.date === todayYMD;
                    return (
                      <View key={item.day} style={styles.barGroup}>
                        <Text style={[styles.barValue, isAbove && styles.barValueGood]}>
                          {item.stops > 0 ? item.stops : ""}
                        </Text>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barTargetLine,
                              { bottom: (item.target / MAX_STOPS) * 100 },
                            ]}
                          />
                          <View
                            style={[
                              styles.bar,
                              { height: barHeight },
                              isAbove && styles.barAbove,
                              isTodayBar && styles.barToday,
                            ]}
                          />
                        </View>
                        <Text style={[styles.barLabel, isTodayBar && styles.barLabelToday]}>
                          {item.day}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#006A3B" }]} />
                    <Text style={styles.legendText}>Stops done</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#4CAF50" }]} />
                    <Text style={styles.legendText}>Above Target</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#E0E0E0", borderWidth: 1, borderColor: "#BDBDBD" }]} />
                    <Text style={styles.legendText}>Target</Text>
                  </View>
                </View>

                <View style={styles.weekStatsRow}>
                  <View style={styles.weekStat}>
                    <MaterialIcons name="emoji-events" size={16} color="#F59E0B" />
                    <Text style={styles.weekStatText}>
                      Best:{" "}
                      <Text style={styles.weekStatBold}>
                        {bestDay.day} ({bestDay.stops} stops)
                      </Text>
                    </Text>
                  </View>
                  <View style={styles.weekStat}>
                    <MaterialIcons name="show-chart" size={16} color="#2196F3" />
                    <Text style={styles.weekStatText}>
                      Avg:{" "}
                      <Text style={styles.weekStatBold}>{weeklyAverage} stops/day</Text>
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Achievements */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Achievements</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.achievementsRow}
              >
                <View style={[styles.achievementCard, completedStops < 50 && styles.achievementLocked]}>
                  <Text style={styles.achievementEmoji}>{completedStops >= 50 ? "🏆" : "🔒"}</Text>
                  <Text style={styles.achievementTitle}>50 Stops</Text>
                  <Text style={styles.achievementDesc}>Complete 50 pickups</Text>
                </View>
                <View style={[styles.achievementCard, styles.achievementLocked]}>
                  <Text style={styles.achievementEmoji}>🔒</Text>
                  <Text style={styles.achievementTitle}>Early Bird</Text>
                  <Text style={styles.achievementDesc}>5 morning rounds</Text>
                </View>
                <View style={[styles.achievementCard, styles.achievementLocked]}>
                  <Text style={styles.achievementEmoji}>🔒</Text>
                  <Text style={styles.achievementTitle}>Perfect Week</Text>
                  <Text style={styles.achievementDesc}>All stops completed</Text>
                </View>
                <View style={[styles.achievementCard, styles.achievementLocked]}>
                  <Text style={styles.achievementEmoji}>🔒</Text>
                  <Text style={styles.achievementTitle}>Eco Warrior</Text>
                  <Text style={styles.achievementDesc}>100% recycled</Text>
                </View>
              </ScrollView>
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FBF9F8" },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerLogo: { width: 90, height: 36 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0EDED",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  container: { paddingHorizontal: 16, paddingTop: 24 },

  // Page Title
  pageTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: "#1B1C1C",
    letterSpacing: -0.4,
    lineHeight: 41,
    marginBottom: 20,
  },

  // Filters
  filterScroll: { marginBottom: 24 },
  filterRow: { gap: 8 },
  filterChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "#F0EDED",
  },
  filterChipActive: { backgroundColor: "#006A3B" },
  filterChipText: { fontSize: 14, fontWeight: "600", color: "#6F7A70" },
  filterChipTextActive: { color: "#FFFFFF" },

  // Loading / Error
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: { fontSize: 14, color: "#6F7A70" },
  errorContainer: { alignItems: "center", paddingVertical: 60, gap: 12 },
  errorText: { fontSize: 14, color: "#6F7A70" },
  retryBtn: {
    backgroundColor: "#006A3B",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },

  // Stats Row
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: { fontSize: 20, fontWeight: "800", color: "#1B1C1C", marginBottom: 2 },
  statLabel: { fontSize: 11, color: "#6F7A70", fontWeight: "500" },

  // Summary Card
  summaryCard: {
    backgroundColor: "#006A3B",
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 13, color: "#B3D2C4", marginBottom: 4 },
  summaryValue: { fontSize: 28, fontWeight: "800", color: "#FFFFFF" },
  progressBar: {
    height: 6,
    backgroundColor: "#338862",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressFill: { height: "100%", backgroundColor: "#FFFFFF", borderRadius: 3 },
  summaryBottom: { flexDirection: "row", justifyContent: "space-between" },
  summaryMeta: { fontSize: 12, color: "#99C3B1" },

  // Section
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countBadge: {
    backgroundColor: "#E4EEE9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#006A3B",
  },
  seeAllHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  seeAllHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#006A3B",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1B1C1C",
    lineHeight: 22,
  },

  // Collection Log
  logCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyLog: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyLogText: { fontSize: 14, color: "#BECABE", textAlign: "center" },
  logItem: { flexDirection: "row" },
  logTimeCol: {
    alignItems: "center",
    width: 40,
    paddingTop: 18,
    paddingLeft: 4,
  },
  logTimeDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E4EEE9",
    alignItems: "center",
    justifyContent: "center",
  },
  logTimeLine: { width: 2, flex: 1, backgroundColor: "#F0EDED", marginTop: 4 },
  logContent: {
    flex: 1,
    flexDirection: "row",
    padding: 16,
    paddingLeft: 8,
    alignItems: "center",
  },
  logContentLeft: { flex: 1 },
  logLocation: { fontSize: 15, fontWeight: "600", color: "#1B1C1C", marginBottom: 2 },
  logAddress: { fontSize: 12, color: "#BECABE", marginBottom: 8 },
  logMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  logTimeText: { fontSize: 12, fontWeight: "600", color: "#006A3B" },
  logMetaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#DCD9D9" },
  logMetaText: { fontSize: 12, color: "#6F7A70" },
  logContentRight: { alignItems: "flex-end", justifyContent: "center", paddingLeft: 12 },
  logBins: { fontSize: 20, fontWeight: "800", color: "#006A3B" },
  logBinsLabel: { fontSize: 10, color: "#9CA3AF", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  logDivider: { height: 1, backgroundColor: "#F6F3F2", marginLeft: 48 },

  // Pagination Footer
  paginationFooter: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F6F3F2",
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadMoreBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    backgroundColor: "#E4EEE9",
    borderRadius: 14,
  },
  loadMoreBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#006A3B",
  },
  seeAllBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    backgroundColor: "#006A3B",
    borderRadius: 14,
  },
  seeAllBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  showLessBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    backgroundColor: "#F0EDED",
    borderRadius: 14,
  },
  showLessBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6F7A70",
  },

  // Weekly Card
  weekTotalBadge: {
    backgroundColor: "#E4EEE9",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  weekTotalText: { fontSize: 12, fontWeight: "700", color: "#006A3B" },
  weekCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  // Chart
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 140,
    marginBottom: 16,
  },
  barGroup: { flex: 1, alignItems: "center", gap: 6 },
  barValue: { fontSize: 10, fontWeight: "600", color: "#6F7A70" },
  barValueGood: { color: "#4CAF50" },
  barTrack: {
    position: "relative",
    width: 24,
    height: 100,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  barTargetLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#BDBDBD",
    borderStyle: "dashed",
  },
  bar: { width: 20, borderRadius: 6, minHeight: 4, backgroundColor: "#006A3B" },
  barAbove: { backgroundColor: "#4CAF50" },
  barToday: { backgroundColor: "#268451" },
  barLabel: { fontSize: 11, fontWeight: "600", color: "#6F7A70" },
  barLabelToday: { color: "#006A3B", fontWeight: "700" },

  // Legend
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 16,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 3 },
  legendText: { fontSize: 10, color: "#6F7A70" },

  // Week Stats
  weekStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#F0EDED",
    paddingTop: 16,
  },
  weekStat: { flexDirection: "row", alignItems: "center", gap: 8 },
  weekStatText: { fontSize: 12, color: "#6F7A70" },
  weekStatBold: { fontWeight: "700", color: "#1B1C1C" },

  // Achievements
  achievementsRow: { gap: 12, paddingRight: 16 },
  achievementCard: {
    width: 110,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  achievementLocked: { opacity: 0.5 },
  achievementEmoji: { fontSize: 28, marginBottom: 8 },
  achievementTitle: { fontSize: 12, fontWeight: "700", color: "#1B1C1C", marginBottom: 2 },
  achievementDesc: { fontSize: 10, color: "#6F7A70", textAlign: "center" },

  bottomSpacer: { height: 32 },
});
