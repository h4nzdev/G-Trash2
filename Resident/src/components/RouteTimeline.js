import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import colors from "../constants/colors";

export default function RouteTimeline({ stops }) {
  return (
    <View style={styles.container}>
      {stops.map((stop, index) => (
        <View key={index} style={styles.step}>
          {/* Indicator Column */}
          <View style={styles.indicator}>
            <View style={[styles.dot, stop.active && styles.dotActive]}>
              {stop.active ? (
                <MaterialIcons name="check" size={14} color="#FFFFFF" />
              ) : (
                <View style={styles.dotInner} />
              )}
            </View>
            {index < stops.length - 1 && <View style={styles.line} />}
          </View>

          {/* Content */}
          <View style={[styles.content, stop.active && styles.contentActive]}>
            <View style={styles.header}>
              <Text style={[styles.name, stop.active && styles.nameActive]}>
                {stop.name}
              </Text>
              {stop.active && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Active</Text>
                </View>
              )}
            </View>
            <Text style={[styles.time, stop.active && styles.timeActive]}>
              {stop.status} • {stop.time}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  step: {
    flexDirection: "row",
    minHeight: 72,
  },
  indicator: {
    alignItems: "center",
    width: 24,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F6F3F2",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  dotActive: {
    backgroundColor: colors.primaryGreen || "#006A3B",
    borderColor: "#FFFFFF",
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6F7A70",
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: "#F0EDED",
    marginTop: -2,
    marginBottom: -2,
  },
  content: {
    flex: 1,
    marginLeft: 16,
    paddingBottom: 32,
  },
  contentActive: {
    backgroundColor: "#EBF3EE",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C8DDD4",
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6F7A70",
    lineHeight: 20,
  },
  nameActive: {
    color: "#006A3B",
    fontWeight: "700",
  },
  badge: {
    backgroundColor: "#006A3B",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  time: {
    fontSize: 12,
    color: "#6F7A70",
    marginTop: 4,
    lineHeight: 16,
  },
  timeActive: {
    color: "#006A3B",
  },
});
