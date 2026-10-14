import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

export default function ScanResultCard({
  itemName,
  category,
  binColor,
  confidence,
  tips,
}) {
  const getCategoryMeta = (cat) => {
    if (!cat) {
      return { icon: "help-circle-outline", color: "#64748B", bg: "#F1F5F9" };
    }
    const lower = cat.toLowerCase();
    if (lower.includes("recyclable") && !lower.includes("non-recyclable")) {
      return { icon: "refresh-circle", color: "#2563EB", bg: "#EFF6FF" };
    }
    if (lower.includes("compost") || lower.includes("biodegradable") || lower.includes("food")) {
      return { icon: "leaf", color: "#006A3B", bg: "#ECFDF5" };
    }
    if (lower.includes("e-waste") || lower.includes("electronic")) {
      return { icon: "hardware-chip", color: "#7C3AED", bg: "#F5F3FF" };
    }
    if (lower.includes("hazardous")) {
      return { icon: "warning", color: "#DC2626", bg: "#FEF2F2" };
    }
    if (lower.includes("donate")) {
      return { icon: "heart-circle", color: "#DB2777", bg: "#FDF2F8" };
    }
    if (lower.includes("non-recyclable") || lower.includes("residual")) {
      return { icon: "trash-bin", color: "#D97706", bg: "#FEF3C7" };
    }
    return { icon: "cube-outline", color: "#0284C7", bg: "#F0F9FF" };
  };

  const getConfidenceLevel = (val) => {
    if (val >= 80) return { text: "High Confidence", color: "#006A3B", bg: "#ECFDF5", border: "#A7F3D0" };
    if (val >= 60) return { text: "Medium Confidence", color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" };
    if (val >= 40) return { text: "Low Confidence", color: "#EA580C", bg: "#FFEDD5", border: "#FED7AA" };
    return { text: "Uncertain", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" };
  };

  const meta = getCategoryMeta(category);
  const activeColor = binColor || meta.color;
  const confMeta = confidence !== undefined && confidence !== null ? getConfidenceLevel(confidence) : null;

  return (
    <View style={styles.cardWrapper}>
      <View style={[styles.card, { borderLeftColor: activeColor }]}>
        {/* Top Header Row */}
        <View style={styles.header}>
          {/* Icon Box */}
          <View style={[styles.iconContainer, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon} size={28} color={activeColor} />
          </View>

          {/* Title and Category */}
          <View style={styles.titleSection}>
            <Text style={styles.itemName} numberOfLines={2}>
              {itemName || "Unknown Item"}
            </Text>

            <View style={styles.categoryPillRow}>
              <View style={[styles.categoryBadge, { backgroundColor: meta.bg, borderColor: `${activeColor}40` }]}>
                <View style={[styles.categoryDot, { backgroundColor: activeColor }]} />
                <Text style={[styles.categoryText, { color: activeColor }]} numberOfLines={1}>
                  {category || "Unclassified"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Confidence Meter Banner */}
        {confMeta && (
          <View style={[styles.confidenceBanner, { backgroundColor: confMeta.bg, borderColor: confMeta.border }]}>
            <View style={styles.confidenceLeft}>
              <Ionicons name="sparkles" size={15} color={confMeta.color} />
              <Text style={[styles.confidenceLabel, { color: confMeta.color }]}>
                AI Match: {confidence}% ({confMeta.text})
              </Text>
            </View>
            <View style={styles.confidenceBarTrack}>
              <View style={[styles.confidenceBarFill, { width: `${Math.min(100, confidence)}%`, backgroundColor: confMeta.color }]} />
            </View>
          </View>
        )}

        {/* Tips Section */}
        {tips && tips.length > 0 ? (
          <View style={styles.tipsSection}>
            <View style={styles.tipsDivider} />
            <View style={styles.tipsHeader}>
              <Ionicons name="bulb" size={17} color="#D97706" />
              <Text style={styles.tipsTitle}>Proper Segregation Tips</Text>
            </View>
            <View style={styles.tipsList}>
              {tips.map((tip, index) => (
                <View key={index} style={styles.tipItem}>
                  <View style={styles.tipBullet}>
                    <MaterialIcons name="check" size={14} color="#006A3B" />
                  </View>
                  <Text style={styles.tipText}>
                    {tip}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.tipsSection}>
            <View style={styles.tipsDivider} />
            <View style={styles.emptyTips}>
              <Ionicons name="information-circle-outline" size={18} color="#64748B" />
              <Text style={styles.emptyTipsText}>
                Dispose in your barangay's designated collection stream
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    width: "100%",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  titleSection: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 23,
    marginBottom: 6,
  },
  categoryPillRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  categoryText: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  // Confidence
  confidenceBanner: {
    flexDirection: "column",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    gap: 6,
  },
  confidenceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  confidenceLabel: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  confidenceBarTrack: {
    width: "100%",
    height: 5,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 2.5,
    overflow: "hidden",
  },
  confidenceBarFill: {
    height: "100%",
    borderRadius: 2.5,
  },

  // Tips Section
  tipsSection: {
    marginTop: 14,
  },
  tipsDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 14,
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 6,
  },
  tipsTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1E293B",
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    gap: 10,
  },
  tipBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  tipText: {
    flex: 1,
    fontSize: 12.5,
    color: "#334155",
    lineHeight: 18,
    fontWeight: "500",
  },

  // Empty Tips
  emptyTips: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    gap: 8,
  },
  emptyTipsText: {
    fontSize: 12,
    color: "#64748B",
    flex: 1,
  },
});
