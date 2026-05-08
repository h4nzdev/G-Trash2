import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export default function PickupActionCard({
  location,
  binCount,
  status,
  onMarkCleaned,
  onReportIssue,
}) {
  // Success state shown briefly after marking cleaned
  if (status === "cleaned") {
    return (
      <View style={[styles.card, styles.cardSuccess]}>
        <View style={styles.successRow}>
          <View style={styles.successIconWrap}>
            <MaterialIcons name="check-circle" size={32} color="#006A3B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>Area Cleaned Successfully</Text>
            <Text style={styles.successSub}>{location} — System updated</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Header Row — Location + Report Icon */}
      <View style={styles.headerRow}>
        <View style={styles.locationContainer}>
          <View style={styles.locationIconBg}>
            <MaterialIcons name="location-on" size={22} color="#006A3B" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.locationLabel}>CURRENT STOP</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              {location}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.reportIconButton}
          onPress={onReportIssue}
          activeOpacity={0.7}
        >
          <MaterialIcons name="report-problem" size={20} color="#BA1A1A" />
        </TouchableOpacity>
      </View>

      {/* Stats Row — Bins + Estimated Weight */}
      <View style={styles.infoStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{binCount}</Text>
          <Text style={styles.statLabel}>Bins to Collect</Text>
        </View>
        <View style={styles.dividerVertical} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>~15kg</Text>
          <Text style={styles.statLabel}>Est. Weight</Text>
        </View>
        <View style={styles.dividerVertical} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>On Time</Text>
          <Text style={styles.statLabel}>Status</Text>
        </View>
      </View>

      {/* Main Action Button — Full width, single CTA */}
      <TouchableOpacity
        style={styles.mainActionBtn}
        onPress={onMarkCleaned}
        activeOpacity={0.85}
      >
        <MaterialIcons name="check-circle" size={22} color="#FFFFFF" />
        <Text style={styles.mainActionText}>Mark as Cleaned</Text>
        <View style={styles.btnIconBg}>
          <MaterialIcons name="chevron-right" size={20} color="#006A3B" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Card Base
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#F0EDED",
  },
  cardSuccess: {
    borderColor: "rgba(0,110,28,0.25)",
    backgroundColor: "rgba(0,106,59,0.04)",
  },

  // Header Row
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  locationIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(0,106,59,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    gap: 2,
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#006A3B",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  locationValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1B1C1C",
    lineHeight: 24,
  },
  reportIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF1F0",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },

  // Stats Row
  infoStats: {
    flexDirection: "row",
    backgroundColor: "#FBF9F8",
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#F0EDED",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B1C1C",
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 12,
    color: "#6F7A70",
    marginTop: 2,
    lineHeight: 16,
  },
  dividerVertical: {
    width: 1,
    height: "60%",
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
  },

  // Main Action Button
  mainActionBtn: {
    backgroundColor: "#006A3B",
    borderRadius: 18,
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  mainActionText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  btnIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  // Success State
  successRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  successIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,106,59,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  successTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#006A3B",
    lineHeight: 22,
  },
  successSub: {
    fontSize: 13,
    color: "#6F7A70",
    marginTop: 2,
    lineHeight: 18,
  },
});
