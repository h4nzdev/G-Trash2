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
  if (status === "cleaned") {
    return (
      <View style={[styles.card, styles.cardSuccess]}>
        <View style={styles.successRow}>
          <View style={styles.successIconWrap}>
            <MaterialIcons name="check-circle" size={28} color="#006A3B" />
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
      {/* Header with location info */}
      <View style={styles.cardHeader}>
        <View style={styles.locationRow}>
          <View style={styles.locationIconContainer}>
            <MaterialIcons name="location-on" size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.locationText} numberOfLines={1}>
              {location}
            </Text>
            <Text style={styles.binCount}>
              {binCount} bins ready for collection
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons — vertical stack on very narrow screens, horizontal normally */}
      <View style={styles.actions}>
        {/* Primary: Mark Cleaned */}
        <TouchableOpacity
          style={styles.cleanBtn}
          onPress={onMarkCleaned}
          activeOpacity={0.85}
        >
          <View style={styles.cleanBtnInner}>
            <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
            <Text style={styles.cleanBtnText} numberOfLines={1}>
              Mark as Cleaned
            </Text>
          </View>
        </TouchableOpacity>

        {/* Secondary: Report Issue */}
        <TouchableOpacity
          style={styles.reportBtn}
          onPress={onReportIssue}
          activeOpacity={0.85}
        >
          <View style={styles.reportBtnInner}>
            <MaterialIcons name="warning-amber" size={18} color="#BA1A1A" />
            <Text style={styles.reportBtnText} numberOfLines={1}>
              Report
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F0EDED",
  },
  cardSuccess: {
    borderColor: "rgba(0,110,28,0.2)",
    backgroundColor: "rgba(0,106,59,0.03)",
  },

  // Header
  cardHeader: {
    marginBottom: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F6F3F2",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  locationIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#006A3B",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  locationText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1B1C1C",
    lineHeight: 22,
  },
  binCount: {
    fontSize: 13,
    color: "#6F7A70",
    marginTop: 2,
    lineHeight: 18,
  },

  // Actions
  actions: {
    flexDirection: "row",
    gap: 10,
  },

  // Clean Button — prominent, fills available space
  cleanBtn: {
    flex: 1.4, // Takes more space than report button
    backgroundColor: "#006A3B",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  cleanBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cleanBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1, // Allows text to shrink if needed
  },

  // Report Button — compact, secondary
  reportBtn: {
    flex: 0.6, // Compact size
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: "#BA1A1A",
  },
  reportBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  reportBtnText: {
    color: "#BA1A1A",
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
  },

  // Success State
  successRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  successIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,106,59,0.08)",
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
