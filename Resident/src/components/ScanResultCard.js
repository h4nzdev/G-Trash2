import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function ScanResultCard({
  itemName,
  category,
  binColor,
  confidence,
  tips,
}) {
  const getCategoryIcon = (category) => {
    if (!category) return "help-circle";
    if (category.includes("Recyclable")) return "refresh-circle";
    if (category.includes("Compost")) return "leaf";
    if (category.includes("E-Waste")) return "hardware-chip";
    if (category.includes("Hazardous")) return "warning";
    if (category.includes("Donate")) return "heart-circle";
    if (category.includes("Non-Recyclable")) return "trash";
    return "help-circle";
  };

  const getCategoryColor = (category) => {
    if (!category) return "#9E9E9E";
    if (category.includes("Recyclable")) return "#4CAF50";
    if (category.includes("Compost")) return "#8BC34A";
    if (category.includes("E-Waste")) return "#FF9800";
    if (category.includes("Hazardous")) return "#F44336";
    if (category.includes("Donate")) return "#9C27B0";
    if (category.includes("Non-Recyclable")) return "#607D8B";
    return "#2196F3";
  };

  const getConfidenceLevel = (confidence) => {
    if (confidence >= 80) return { text: "High", color: "#4CAF50" };
    if (confidence >= 60) return { text: "Medium", color: "#FFC107" };
    if (confidence >= 40) return { text: "Low", color: "#FF9800" };
    return { text: "Uncertain", color: "#F44336" };
  };

  const confidenceLevel =
    confidence !== undefined ? getConfidenceLevel(confidence) : null;

  return (
    <View style={styles.cardWrapper}>
      <View style={styles.card}>
        {/* Color Indicator Bar */}
        <View
          style={[styles.colorBar, { backgroundColor: binColor || "#9E9E9E" }]}
        />

        {/* Main Content */}
        <View style={styles.content}>
          {/* Header Section */}
          <View style={styles.header}>
            {/* Category Icon */}
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${binColor || "#9E9E9E"}15` },
              ]}
            >
              <Ionicons
                name={getCategoryIcon(category)}
                size={28}
                color={binColor || "#9E9E9E"}
              />
            </View>

            {/* Title and Category */}
            <View style={styles.titleSection}>
              <Text style={styles.itemName} numberOfLines={2}>
                {itemName || "Unknown Item"}
              </Text>
              <View style={styles.categoryRow}>
                <View
                  style={[
                    styles.categoryDot,
                    { backgroundColor: getCategoryColor(category) },
                  ]}
                />
                <Text style={styles.category} numberOfLines={1}>
                  {category || "Unclassified"}
                </Text>
              </View>
            </View>

            {/* Confidence Badge */}
            {confidence !== undefined && confidence !== null && (
              <View style={styles.confidenceContainer}>
                <View
                  style={[
                    styles.confidenceBadge,
                    { borderColor: confidenceLevel?.color || "#9E9E9E" },
                  ]}
                >
                  <Text
                    style={[
                      styles.confidenceValue,
                      { color: confidenceLevel?.color || "#9E9E9E" },
                    ]}
                  >
                    {confidence}%
                  </Text>
                  <Text
                    style={[
                      styles.confidenceLabel,
                      { color: confidenceLevel?.color || "#9E9E9E" },
                    ]}
                  >
                    {confidenceLevel?.text || "N/A"}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Tips Section */}
          {tips && tips.length > 0 && (
            <View style={styles.tipsSection}>
              <View style={styles.tipsDivider} />
              <View style={styles.tipsHeader}>
                <Ionicons name="bulb-outline" size={18} color="#FFC107" />
                <Text style={styles.tipsTitle}>Recycling Tips</Text>
              </View>
              <View style={styles.tipsList}>
                {tips.map((tip, index) => (
                  <View key={index} style={styles.tipItem}>
                    <View style={styles.tipBullet}>
                      <Ionicons name="checkmark" size={14} color="#4CAF50" />
                    </View>
                    <Text style={styles.tipText} numberOfLines={3}>
                      {tip}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Empty State for Tips */}
          {(!tips || tips.length === 0) && confidence !== undefined && (
            <View style={styles.tipsSection}>
              <View style={styles.tipsDivider} />
              <View style={styles.emptyTips}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color="#9E9E9E"
                />
                <Text style={styles.emptyTipsText}>
                  No specific tips available for this item
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    width: "100%",
    // No horizontal margins - full width
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  colorBar: {
    height: 5,
  },
  content: {
    padding: 20,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  titleSection: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
    lineHeight: 24,
    marginBottom: 6,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  category: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    flex: 1,
  },

  // Confidence
  confidenceContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  confidenceBadge: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 70,
  },
  confidenceValue: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
  },
  confidenceLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Tips Section
  tipsSection: {
    marginTop: 16,
  },
  tipsDivider: {
    height: 1,
    backgroundColor: "#E8E8E8",
    marginBottom: 16,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
  },
  tipsList: {
    gap: 10,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 2,
  },
  tipBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },

  // Empty Tips
  emptyTips: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 14,
  },
  emptyTipsText: {
    fontSize: 14,
    color: "#9E9E9E",
    marginLeft: 10,
    fontStyle: "italic",
  },
});
