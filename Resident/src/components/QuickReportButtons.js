import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export default function QuickReportButtons({ onReportPress }) {
  return (
    <View style={styles.container}>
      {/* Overflowing Bin */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => onReportPress?.("overflowing")}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, styles.overflowIcon]}>
          <MaterialIcons name="delete" size={28} color="#BA1A1A" />
        </View>
        <Text style={styles.label}>Overflowing Bin</Text>
      </TouchableOpacity>

      {/* Bad Odor */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => onReportPress?.("odor")}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, styles.odorIcon]}>
          <MaterialIcons name="air" size={28} color="#EA580C" />
        </View>
        <Text style={styles.label}>Bad Odor</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 16,
  },
  button: {
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
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  overflowIcon: {
    backgroundColor: "#FFDAD6",
  },
  odorIcon: {
    backgroundColor: "#FED7AA",
  },
  label: {
    fontSize: 15,
    color: "#1B1C1C",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
});
