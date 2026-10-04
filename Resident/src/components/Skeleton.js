import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";

/**
 * Base Animated Skeleton component with a smooth pulsing shimmer effect.
 */
export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
  children,
}) {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.skeletonBase,
        {
          width,
          height,
          borderRadius,
          opacity: pulseAnim,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Circle Skeleton (for avatars, icon badges, indicators)
 */
export function SkeletonCircle({ size = 40, style }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />;
}

/**
 * Text Line Skeleton with pre-rounded pill edges
 */
export function SkeletonText({ width = "100%", height = 12, style, borderRadius = 6 }) {
  return <Skeleton width={width} height={height} borderRadius={borderRadius} style={style} />;
}

/**
 * Card Skeleton Container with subtle border & background
 */
export function SkeletonCard({ style, children }) {
  return <View style={[styles.cardContainer, style]}>{children}</View>;
}

/**
 * =====================================================================
 * SCREEN-SPECIFIC COMPOSITE SKELETONS
 * =====================================================================
 */

/**
 * 1. HomeScreen Skeleton
 */
export function HomeScreenSkeleton() {
  return (
    <View style={styles.screenContainer}>
      {/* Greeting Skeleton */}
      <View style={{ marginBottom: 18 }}>
        <Skeleton width={180} height={22} style={{ marginBottom: 8 }} />
        <Skeleton width={260} height={14} />
      </View>

      {/* 3-Column Status Card Skeleton */}
      <View style={styles.threeColSkeleton}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.colSkeletonItem}>
            <SkeletonCircle size={36} style={{ marginBottom: 8 }} />
            <Skeleton width={50} height={14} style={{ marginBottom: 4 }} />
            <Skeleton width={68} height={10} />
          </View>
        ))}
      </View>

      {/* Proximity / Hero Radar Card Skeleton */}
      <View style={styles.heroCardSkeleton}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <SkeletonCircle size={44} />
            <View>
              <Skeleton width={130} height={16} style={{ marginBottom: 6 }} />
              <Skeleton width={90} height={11} />
            </View>
          </View>
          <Skeleton width={70} height={24} borderRadius={12} />
        </View>
        <Skeleton width="100%" height={120} borderRadius={16} style={{ marginBottom: 14 }} />
        <Skeleton width="100%" height={44} borderRadius={12} />
      </View>

      {/* Route Stops Timeline Skeleton */}
      <View style={styles.sectionCardSkeleton}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }}>
          <Skeleton width={140} height={16} />
          <Skeleton width={60} height={14} />
        </View>
        {[1, 2, 3].map((s) => (
          <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <SkeletonCircle size={22} />
            <Skeleton width={160} height={13} />
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Skeleton width={45} height={10} />
            </View>
          </View>
        ))}
      </View>

      {/* Air Quality Mini Card Skeleton */}
      <View style={styles.sectionCardSkeleton}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
          <Skeleton width={130} height={16} />
          <Skeleton width={80} height={14} />
        </View>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end", height: 60, marginTop: 10 }}>
          {[30, 50, 40, 60, 45, 55, 35].map((h, idx) => (
            <Skeleton key={idx} width={`${100 / 7 - 3}%`} height={h} borderRadius={6} />
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * 2. Map Bottom Sheet Skeleton
 */
export function MapSheetSkeleton() {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 }}>
      {/* Status Bar */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <SkeletonCircle size={10} />
          <Skeleton width={160} height={16} />
        </View>
        <Skeleton width={80} height={24} borderRadius={12} />
      </View>

      {/* Progress Track */}
      <View style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Skeleton width={120} height={11} />
          <Skeleton width={70} height={11} />
        </View>
        <Skeleton width="100%" height={8} borderRadius={4} />
      </View>

      {/* Driver Card */}
      <View style={styles.driverSkeletonCard}>
        <SkeletonCircle size={44} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Skeleton width={100} height={15} style={{ marginBottom: 5 }} />
          <Skeleton width={140} height={12} style={{ marginBottom: 4 }} />
          <Skeleton width={180} height={10} />
        </View>
        <Skeleton width={60} height={20} borderRadius={8} />
      </View>
    </View>
  );
}

/**
 * 3. Calendar Schedules Skeleton
 */
export function CalendarSchedulesSkeleton() {
  return (
    <View style={{ marginTop: 6, gap: 12 }}>
      {[1, 2, 3].map((k) => (
        <View key={k} style={styles.scheduleCardSkeleton}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <SkeletonCircle size={40} />
            <View style={{ flex: 1 }}>
              <Skeleton width={110} height={12} borderRadius={6} style={{ marginBottom: 6 }} />
              <Skeleton width={170} height={15} style={{ marginBottom: 5 }} />
              <Skeleton width={130} height={11} />
            </View>
            <Skeleton width={72} height={24} borderRadius={12} />
          </View>
          <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9", flexDirection: "row", justifyContent: "space-between" }}>
            <Skeleton width={90} height={12} />
            <Skeleton width={110} height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * 4. Community Feed Skeleton
 */
export function CommunityFeedSkeleton() {
  return (
    <View style={styles.screenContainer}>
      {[1, 2, 3].map((c) => (
        <View key={c} style={styles.feedCardSkeleton}>
          {/* Header (Avatar + Name) */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <SkeletonCircle size={40} />
            <View style={{ flex: 1 }}>
              <Skeleton width={130} height={14} style={{ marginBottom: 5 }} />
              <Skeleton width={80} height={10} />
            </View>
            <Skeleton width={24} height={24} borderRadius={12} />
          </View>

          {/* Status strip */}
          <Skeleton width="100%" height={26} borderRadius={8} style={{ marginBottom: 10 }} />

          {/* Body Text */}
          <Skeleton width="90%" height={13} style={{ marginBottom: 6 }} />
          <Skeleton width="70%" height={13} style={{ marginBottom: 12 }} />

          {/* Image Placeholder */}
          <Skeleton width="100%" height={160} borderRadius={14} style={{ marginBottom: 14 }} />

          {/* Actions Bar */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F1F5F9" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <SkeletonCircle size={28} />
              <Skeleton width={60} height={16} borderRadius={8} />
              <SkeletonCircle size={28} />
            </View>
            <Skeleton width={80} height={20} borderRadius={8} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * 5. Profile Reports Skeleton
 */
export function ProfileReportsSkeleton() {
  return (
    <View style={{ marginTop: 8, gap: 10 }}>
      {[1, 2, 3].map((r) => (
        <View key={r} style={styles.profileReportSkeleton}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Skeleton width={140} height={14} />
            <Skeleton width={70} height={20} borderRadius={10} />
          </View>
          <Skeleton width="80%" height={11} style={{ marginBottom: 6 }} />
          <Skeleton width={100} height={9} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonBase: {
    backgroundColor: "#E2E8F0",
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  screenContainer: {
    padding: 16,
  },
  threeColSkeleton: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    justifyContent: "space-around",
  },
  colSkeletonItem: {
    alignItems: "center",
    flex: 1,
  },
  heroCardSkeleton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  sectionCardSkeleton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  driverSkeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  scheduleCardSkeleton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  feedCardSkeleton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  profileReportSkeleton: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
});

export default Skeleton;
