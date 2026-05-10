import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function HeatmapLegend() {
  return (
    <View style={styles.container}>
      <View style={styles.legendItem}>
        <View style={[styles.dot, { backgroundColor: "#E53935" }]} />
        <Text style={styles.label}>Critical</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.dot, { backgroundColor: "#FDD835" }]} />
        <Text style={styles.label}>Moderate</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.dot, { backgroundColor: "#4CAF50" }]} />
        <Text style={styles.label}>Clean</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  label: {
    fontSize: 12,
    color: "#1B1C1C",
    fontWeight: "500",
    lineHeight: 16,
  },
});
