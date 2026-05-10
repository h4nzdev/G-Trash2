import React from "react";
import { View, Text, Image, StyleSheet, Dimensions } from "react-native";

const ANT_DEFAULT = require("../../assets/ant-2.png");
const ANT_URGENT = require("../../assets/ant-2-urgent.png");
const ANT_WORRYING = require("../../assets/ant-2-worrying.png");
const ANT_CELEBRATE = require("../../assets/ant-2-celebrate.png");

const { width } = Dimensions.get("window");

const ANT_W = 138;
const ANT_H = 140;

export default function TarsiAssistant({ insight, variant = "default" }) {
  const getAntSource = () => {
    if (variant === "worrying") return ANT_WORRYING;
    if (variant === "urgent") return ANT_URGENT;
    if (variant === "celebrate") return ANT_CELEBRATE;
    return ANT_DEFAULT;
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {/* Speech bubble on the left */}
        <View style={styles.bubble}>
          <Text style={styles.ganttLabel}>Gantt</Text>
          <Text style={styles.insightText}>{insight}</Text>
        </View>

        {/* Speech bubble tail pointing to ant */}
        <View style={styles.bubbleTail} />

        {/* Ant on the right - only the image changes based on variant */}
        <Image source={getAntSource()} style={styles.ant} resizeMode="contain" />
      </View>

      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 8,
    marginBottom: 20,
    marginHorizontal: -16,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    marginBottom: -1,
  },
  bubble: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flex: 1,
    maxWidth: width * 0.55,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 16,
    elevation: 6,
  },
  bubbleTail: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#FFFFFF",
    marginRight: -2,
    zIndex: 1,
  },
  ganttLabel: {
    color: "#006A3B",
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  insightText: {
    color: "#374151",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "400",
  },
  ant: {
    width: ANT_W,
    height: ANT_H,
  },
  divider: {
    height: 3,
    backgroundColor: "#006A3B",
    borderRadius: 2,
    marginHorizontal: 20,
    marginTop: 16,
  },
});
