import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MaterialIcons,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import API_URL from "../config";
import colors from "../constants/colors";

const { width } = Dimensions.get("window");

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString();
}

function slaHoursLeft(deadline) {
  if (!deadline) return null;
  const h = Math.ceil((new Date(deadline) - Date.now()) / 3600000);
  return h;
}

function StatusBar({ statusHistory = [], resolutionConfirmed }) {
  const steps = [
    { key: "pending", label: "Reported", icon: "flag" },
    { key: "in-progress", label: "In Progress", icon: "build" },
    { key: "resolved", label: "Resolved", icon: "check-circle" },
    { key: "confirmed", label: "Verified", icon: "verified" },
  ];
  const reached = new Set(statusHistory.map((h) => h.status));
  if (resolutionConfirmed === "confirmed") reached.add("confirmed");
  if (resolutionConfirmed === "disputed") reached.add("pending");
  const lastActive = steps.reduce(
    (acc, s, i) => (reached.has(s.key) ? i : acc),
    0,
  );
  return (
    <View style={sbStyles.row}>
      {steps.map((step, i) => {
        const active = reached.has(step.key);
        const isCurrent = i === lastActive;
        return (
          <React.Fragment key={step.key}>
            <View style={sbStyles.stepWrap}>
              <View
                style={[
                  sbStyles.dot,
                  active && sbStyles.dotActive,
                  isCurrent && sbStyles.dotCurrent,
                ]}
              >
                <MaterialIcons
                  name={step.icon}
                  size={10}
                  color={active ? "#fff" : "#CBD5E1"}
                />
              </View>
              <Text style={[sbStyles.label, active && sbStyles.labelActive]}>
                {step.label}
              </Text>
            </View>
            {i < steps.length - 1 && (
              <View
                style={[
                  sbStyles.line,
                  reached.has(steps[i + 1].key) && sbStyles.lineActive,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export default function CommunityFeedScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  // Hide bottom tab bar while Community screen is focused
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ tabBarStyle: { display: "none" } });
      return () => {
        navigation.setOptions({
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 10,
            position: "absolute",
          },
        });
      };
    }, [navigation]),
  );
  const [reports, setReports] = useState([]);
  const [pickupRuns, setPickupRuns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenReports, setHiddenReports] = useState([]);
  const [activeReportForOptions, setActiveReportForOptions] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const socketRef = useRef(null);

  // Discussion States
  const [activeReportForComments, setActiveReportForComments] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const fetchFeed = useCallback(async () => {
    if (!user?.barangay) return;
    try {
      const [reportsRes, pickupRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/reports?barangay=${user.barangay}`),
        fetch(`${API_URL}/api/pickup?barangay=${user.barangay}`),
      ]);
      if (reportsRes.status === "fulfilled" && reportsRes.value.ok) {
        const data = await reportsRes.value.json();
        if (Array.isArray(data)) setReports(data);
      }
      if (pickupRes.status === "fulfilled" && pickupRes.value.ok) {
        const data = await pickupRes.value.json();
        if (Array.isArray(data)) setPickupRuns(data);
      }
    } catch (error) {
      console.error("Feed fetch error:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.barangay]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Real-time report updates via socket
  useEffect(() => {
    const socket = io(API_URL, { transports: ["polling", "websocket"] });
    socketRef.current = socket;
    socket.on("report:updated", (updated) => {
      setReports((prev) =>
        prev.map((r) => (r._id === updated._id ? { ...r, ...updated } : r)),
      );
    });
    socket.on("report:new", (newReport) => {
      if (newReport.barangay === user?.barangay) {
        setReports((prev) => [newReport, ...prev]);
      }
    });
    socket.on("pickup:completed", (run) => {
      if (!run.barangay || run.barangay === user?.barangay) {
        setPickupRuns((prev) => [run, ...prev]);
      }
    });
    return () => socket.disconnect();
  }, [user?.barangay]);

  const handleVerify = async (reportId, confirmed) => {
    setVerifyingId(reportId);
    try {
      const res = await fetch(`${API_URL}/api/reports/${reportId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed, userId: user?.id }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setReports((prev) =>
        prev.map((r) => (r._id === reportId ? { ...r, ...updated } : r)),
      );
      if (confirmed) {
        Alert.alert(
          "Thank you!",
          "Your confirmation has been recorded. Barangay officials receive +20 points.",
        );
      } else {
        Alert.alert(
          "Report Reopened",
          "The issue has been reopened. Officials have been notified and -15 points deducted.",
        );
      }
    } catch {
      Alert.alert("Error", "Could not submit your response. Please try again.");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleVote = async (reportId, type) => {
    if (!user?.id) return;

    // Optimistic UI update
    setReports((prev) =>
      prev.map((report) => {
        if (report._id === reportId) {
          const isUpvoted = report.upvotes.includes(user.id);
          const isDownvoted = report.downvotes.includes(user.id);

          let newUpvotes = [...report.upvotes];
          let newDownvotes = [...report.downvotes];

          // Remove existing vote
          newUpvotes = newUpvotes.filter((id) => id !== user.id);
          newDownvotes = newDownvotes.filter((id) => id !== user.id);

          if (type === "up" && !isUpvoted) {
            newUpvotes.push(user.id);
          } else if (type === "down" && !isDownvoted) {
            newDownvotes.push(user.id);
          }

          return { ...report, upvotes: newUpvotes, downvotes: newDownvotes };
        }
        return report;
      }),
    );

    try {
      const response = await fetch(`${API_URL}/api/reports/${reportId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, type }),
      });
      if (!response.ok) throw new Error("Vote failed");
      // Success - state already updated optimistically
    } catch (error) {
      // Revert on error (optional, for now just fetch fresh)
      fetchFeed();
    }
  };

  const handleDiscuss = (report) => {
    setActiveReportForComments(report);
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !activeReportForComments || !user?.id) return;

    setIsSubmittingComment(true);
    try {
      const response = await fetch(
        `${API_URL}/api/reports/${activeReportForComments._id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, text: commentText.trim() }),
        },
      );
      const updatedComments = await response.json();

      if (!response.ok) throw new Error("Comment failed");

      // Update local reports list with new comments
      setReports((prev) =>
        prev.map((r) => {
          if (r._id === activeReportForComments._id) {
            return { ...r, comments: updatedComments };
          }
          return r;
        }),
      );

      // Update active report in modal
      setActiveReportForComments((prev) => ({
        ...prev,
        comments: updatedComments,
      }));
      setCommentText("");
    } catch (error) {
      console.error("Comment error:", error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleHidePost = (reportId) => {
    setHiddenReports((prev) => [...prev, reportId]);
    setActiveReportForOptions(null);
  };

  const handleDeleteReport = async (reportId) => {
    setActiveReportForOptions(null);
    Alert.alert(
      "Delete Report",
      "Are you sure you want to permanently delete this resolved report?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/api/reports/${reportId}`, {
                method: "DELETE",
              });
              if (!res.ok) throw new Error();
              setReports((prev) => prev.filter((r) => r._id !== reportId));
            } catch {
              Alert.alert(
                "Error",
                "Could not delete report. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const handleReportPost = (reportId) => {
    // Logic for reporting (e.g. API call)
    alert(
      "This post has been reported for review. Thank you for keeping the community safe.",
    );
    setActiveReportForOptions(null);
  };

  const renderPickupCard = ({ item }) => (
    <View style={styles.pickupCard}>
      <View style={styles.pickupHeader}>
        <View style={styles.pickupIconWrap}>
          <MaterialIcons name="local-shipping" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pickupTitle}>
            Garbage Collected — {item.routeName || `Truck ${item.truckId}`}
          </Text>
          <Text style={styles.pickupTime}>
            {formatRelativeTime(item.completedAt)}
          </Text>
        </View>
        <View style={styles.pickupBadge}>
          <Text style={styles.pickupBadgeText}>DONE</Text>
        </View>
      </View>
      <View style={styles.pickupStats}>
        <View style={styles.pickupStat}>
          <MaterialIcons name="delete-outline" size={14} color="#6B7280" />
          <Text style={styles.pickupStatText}>
            {item.totalStops} stop{item.totalStops !== 1 ? "s" : ""}
          </Text>
        </View>
        {item.totalWeight > 0 && (
          <View style={styles.pickupStat}>
            <MaterialIcons name="monitor-weight" size={14} color="#6B7280" />
            <Text style={styles.pickupStatText}>
              {item.totalWeight} kg collected
            </Text>
          </View>
        )}
        <View style={styles.pickupStat}>
          <MaterialIcons name="local-shipping" size={14} color="#6B7280" />
          <Text style={styles.pickupStatText}>Truck {item.truckId}</Text>
        </View>
      </View>
      {item.verifications && item.verifications.length > 0 && (
        <Text style={styles.pickupVerified}>
          {item.verifications.filter((v) => v.confirmed).length} resident
          {item.verifications.filter((v) => v.confirmed).length !== 1
            ? "s"
            : ""}{" "}
          confirmed pickup
        </Text>
      )}
    </View>
  );

  // Merge reports + pickup runs sorted by date
  const feedItems = [
    ...reports
      .filter((r) => !hiddenReports.includes(r._id))
      .map((r) => ({ ...r, _feedType: "report" })),
    ...pickupRuns.map((p) => ({ ...p, _feedType: "pickup" })),
  ].sort(
    (a, b) =>
      new Date(b.createdAt || b.completedAt) -
      new Date(a.createdAt || a.completedAt),
  );

  const renderFeedItem = ({ item }) => {
    if (item._feedType === "pickup") return renderPickupCard({ item });
    return renderReportCard({ item });
  };

  const renderReportCard = ({ item }) => {
    const urgency = item.upvotes.length - item.downvotes.length;
    const hasUpvoted = item.upvotes.includes(user?.id);
    const hasDownvoted = item.downvotes.includes(user?.id);
    const isOwn = item.userId?._id === user?.id || item.userId === user?.id;
    const hoursLeft = slaHoursLeft(item.deadline);
    const awaitingVerification =
      isOwn && item.resolutionConfirmed === "pending";

    return (
      <View style={[styles.card, item.escalated && styles.cardEscalated]}>
        {/* Escalation banner */}
        {item.escalated && item.status === "pending" && (
          <View style={styles.escalationBanner}>
            <MaterialIcons name="warning" size={14} color="#EF4444" />
            <Text style={styles.escalationText}>
              OVERDUE — No action taken within 72h. Barangay penalised.
            </Text>
          </View>
        )}

        {/* Header: User Info */}
        <View style={styles.cardHeader}>
          <View style={[styles.userInfo, { flex: 1 }]}>
            <View style={styles.avatarContainer}>
              {item.userId?.profilePicture ? (
                <Image
                  source={{ uri: item.userId.profilePicture }}
                  style={styles.avatar}
                />
              ) : (
                <MaterialIcons name="person" size={24} color="#9CA3AF" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.userId
                  ? `${item.userId.firstName} ${item.userId.lastName}`
                  : item.reportedBy}
              </Text>
              <Text style={styles.timeText}>
                {formatRelativeTime(item.createdAt)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setActiveReportForOptions(item)}
            style={styles.dotsBtn}
          >
            <MaterialIcons name="more-vert" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Full-width status strip */}
        {(() => {
          let bg, icon, iconColor, label;
          if (item.resolutionConfirmed === "confirmed") {
            bg = "#D1FAE5";
            icon = "verified";
            iconColor = "#059669";
            label = "Verified by Resident";
          } else if (item.resolutionConfirmed === "disputed") {
            bg = "#FEF2F2";
            icon = "error-outline";
            iconColor = "#EF4444";
            label = "Disputed — Reopened";
          } else if (item.status === "resolved") {
            bg = "#D1FAE5";
            icon = "check-circle";
            iconColor = "#059669";
            label = "Resolved";
          } else if (item.status === "in-progress") {
            bg = "#EFF6FF";
            icon = "build";
            iconColor = "#2563EB";
            label = "In Progress";
          } else {
            bg = "#FEF3C7";
            icon = "flag";
            iconColor = "#D97706";
            label = "Pending";
          }
          return (
            <View style={[styles.statusStrip, { backgroundColor: bg }]}>
              <MaterialIcons name={icon} size={13} color={iconColor} />
              <Text style={[styles.statusStripText, { color: iconColor }]}>
                {label}
              </Text>
            </View>
          );
        })()}

        {/* Status progression */}
        {(item.statusHistory?.length > 0 || item.resolutionConfirmed) && (
          <View style={styles.statusBarWrap}>
            <StatusBar
              statusHistory={item.statusHistory || []}
              resolutionConfirmed={item.resolutionConfirmed}
            />
          </View>
        )}

        {/* Content */}
        <View style={styles.cardBody}>
          <Text style={styles.categoryText}>{item.category}</Text>
          <Text style={styles.descriptionText}>{item.description}</Text>
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={14} color="#6B7280" />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
          {/* SLA countdown — only show if pending and not escalated */}
          {item.status === "pending" &&
            !item.escalated &&
            hoursLeft !== null &&
            hoursLeft > 0 && (
              <View style={styles.slaRow}>
                <MaterialIcons
                  name="schedule"
                  size={13}
                  color={hoursLeft < 12 ? "#EF4444" : "#F59E0B"}
                />
                <Text
                  style={[
                    styles.slaText,
                    hoursLeft < 12 && styles.slaTextUrgent,
                  ]}
                >
                  {hoursLeft}h left for officials to respond
                </Text>
              </View>
            )}
        </View>

        {/* Image */}
        {item.reportImage && (
          <Image
            source={{ uri: item.reportImage }}
            style={styles.reportImage}
          />
        )}

        {/* Verification prompt — only for report owner when status is resolved & unconfirmed */}
        {awaitingVerification && (
          <View style={styles.verifyPrompt}>
            <MaterialIcons
              name="check-circle-outline"
              size={20}
              color="#006A3B"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyTitle}>
                Officials marked this resolved
              </Text>
              <Text style={styles.verifySubtitle}>
                Is the issue actually fixed?
              </Text>
            </View>
            <TouchableOpacity
              style={styles.verifyBtnYes}
              onPress={() => handleVerify(item._id, true)}
              disabled={verifyingId === item._id}
            >
              <Text style={styles.verifyBtnText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.verifyBtnNo}
              onPress={() => handleVerify(item._id, false)}
              disabled={verifyingId === item._id}
            >
              <Text style={[styles.verifyBtnText, { color: "#EF4444" }]}>
                No
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer: Voting */}
        <View style={styles.cardFooter}>
          <View style={styles.votingContainer}>
            <TouchableOpacity
              style={styles.voteBtn}
              onPress={() => handleVote(item._id, "up")}
            >
              <Ionicons
                name={
                  hasUpvoted ? "arrow-up-circle" : "arrow-up-circle-outline"
                }
                size={28}
                color={hasUpvoted ? colors.primaryGreen : "#6B7280"}
              />
            </TouchableOpacity>

            <View style={styles.urgencyBadge}>
              <Text
                style={[
                  styles.urgencyText,
                  urgency > 5 && { color: "#EF4444" },
                  urgency < 0 && { color: "#6B7280" },
                ]}
              >
                {urgency > 0 ? `+${urgency}` : urgency} Urgency
              </Text>
            </View>

            <TouchableOpacity
              style={styles.voteBtn}
              onPress={() => handleVote(item._id, "down")}
            >
              <Ionicons
                name={
                  hasDownvoted
                    ? "arrow-down-circle"
                    : "arrow-down-circle-outline"
                }
                size={28}
                color={hasDownvoted ? "#EF4444" : "#6B7280"}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.commentBtn}
            onPress={() => handleDiscuss(item)}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#6B7280" />
            <Text style={styles.commentText}>
              {item.comments?.length || 0} Discuss
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryGreen} />
        <Text style={styles.loadingText}>Loading Community Feed...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Community Feed</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate("Report")}
          >
            <MaterialIcons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.barangayLabel}>
          <MaterialIcons
            name="location-city"
            size={16}
            color={colors.primaryGreen}
          />
          <Text style={styles.barangayName}>
            Area: {user?.barangay || "Cebu City"}
          </Text>
        </View>
      </View>

      <FlatList
        data={feedItems}
        renderItem={renderFeedItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              fetchFeed();
            }}
            colors={[colors.primaryGreen]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="megaphone-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Quiet in {user?.barangay}</Text>
            <Text style={styles.emptySub}>
              No issues reported in your area yet. Be the first to report
              something!
            </Text>
          </View>
        }
        ListFooterComponent={
          feedItems.length > 0 ? (
            <View style={styles.feedEndRow}>
              <View style={styles.feedEndLine} />
              <Text style={styles.feedEndText}>No more posts</Text>
              <View style={styles.feedEndLine} />
            </View>
          ) : null
        }
      />

      {/* Discussion Modal */}
      <Modal
        visible={!!activeReportForComments}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActiveReportForComments(null)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Discussion</Text>
              <TouchableOpacity
                onPress={() => setActiveReportForComments(null)}
              >
                <MaterialIcons name="close" size={24} color="#1B1C1C" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={activeReportForComments?.comments || []}
              keyExtractor={(item, index) => index.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.commentsList}
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  <View style={styles.commentAvatarContainer}>
                    {item.userId?.profilePicture ? (
                      <Image
                        source={{ uri: item.userId.profilePicture }}
                        style={styles.commentAvatar}
                      />
                    ) : (
                      <MaterialIcons name="person" size={18} color="#9CA3AF" />
                    )}
                  </View>
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentUser}>
                        {item.userId?.firstName} {item.userId?.lastName}
                      </Text>
                      <Text style={styles.commentTime}>
                        {formatRelativeTime(item.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.commentTextContent}>{item.text}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyComments}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={48}
                    color="#D1D5DB"
                  />
                  <Text style={styles.emptyCommentsText}>
                    No comments yet. Start the discussion!
                  </Text>
                </View>
              }
            />

            <View style={styles.inputArea}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  !commentText.trim() && styles.sendBtnDisabled,
                ]}
                onPress={handlePostComment}
                disabled={!commentText.trim() || isSubmittingComment}
              >
                {isSubmittingComment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialIcons name="send" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Options Modal (Action Sheet Style) */}
      <Modal
        visible={!!activeReportForOptions}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setActiveReportForOptions(null)}
      >
        <TouchableOpacity
          style={styles.optionsOverlay}
          activeOpacity={1}
          onPress={() => setActiveReportForOptions(null)}
        >
          <View style={styles.optionsContent}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => handleHidePost(activeReportForOptions?._id)}
            >
              <Ionicons name="eye-off-outline" size={22} color="#374151" />
              <Text style={styles.optionText}>Hide this post</Text>
            </TouchableOpacity>

            {/* Delete — only for own resolved reports */}
            {(() => {
              const opt = activeReportForOptions;
              const isOwn =
                opt?.userId?._id === user?.id || opt?.userId === user?.id;
              const isResolved =
                opt?.status === "resolved" ||
                opt?.resolutionConfirmed === "confirmed";
              if (!isOwn || !isResolved) return null;
              return (
                <TouchableOpacity
                  style={[styles.optionItem, styles.optionItemDestructive]}
                  onPress={() => handleDeleteReport(opt._id)}
                >
                  <MaterialIcons
                    name="delete-outline"
                    size={22}
                    color="#EF4444"
                  />
                  <Text
                    style={[styles.optionText, styles.optionTextDestructive]}
                  >
                    Delete report
                  </Text>
                </TouchableOpacity>
              );
            })()}

            <TouchableOpacity
              style={[styles.optionItem, styles.optionItemDestructive]}
              onPress={() => handleReportPost(activeReportForOptions?._id)}
            >
              <Ionicons name="flag-outline" size={22} color="#EF4444" />
              <Text style={[styles.optionText, styles.optionTextDestructive]}>
                Report this post
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionCancel}
              onPress={() => setActiveReportForOptions(null)}
            >
              <Text style={styles.optionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  addBtn: {
    backgroundColor: "#006A3B",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#006A3B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  barangayLabel: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  barangayName: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#FFFFFF",

    marginBottom: 16,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  statusStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  statusStripText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  timeText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  statusBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeResolved: {
    backgroundColor: "#D1FAE5",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#D97706",
  },
  statusTextResolved: {
    color: "#059669",
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primaryGreen,
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 20,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: "#6B7280",
  },
  reportImage: {
    width: "100%",
    height: 250,
    resizeMode: "cover",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  votingContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    paddingHorizontal: 4,
  },
  voteBtn: {
    padding: 4,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
  },
  urgencyText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#374151",
  },
  commentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  commentText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#374151",
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  feedEndRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 32,
  },
  feedEndLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  feedEndText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "80%",
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  commentsList: {
    padding: 20,
  },
  commentItem: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  commentAvatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  commentAvatar: {
    width: "100%",
    height: "100%",
  },
  commentBody: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 16,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  commentTime: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  commentTextContent: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 18,
  },
  emptyComments: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyCommentsText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
    gap: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    color: "#111827",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#D1D5DB",
  },

  // Options Styles
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dotsBtn: {
    padding: 4,
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  optionsContent: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    borderRadius: 20,
    padding: 8,
    overflow: "hidden",
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  optionItemDestructive: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  optionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  optionTextDestructive: {
    color: "#EF4444",
  },
  optionCancel: {
    padding: 16,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  optionCancelText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7280",
  },

  // Escalation
  cardEscalated: { borderWidth: 1, borderColor: "#FECACA" },
  escalationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
  },
  escalationText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EF4444",
    flex: 1,
  },

  // Status badges (extra)
  statusBadgeProgress: { backgroundColor: "#EFF6FF" },
  statusTextProgress: { color: "#2563EB" },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedText: { fontSize: 10, fontWeight: "800", color: "#059669" },
  disputedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  disputedText: { fontSize: 10, fontWeight: "800", color: "#EF4444" },

  // Status bar
  statusBarWrap: { paddingHorizontal: 12, paddingBottom: 8 },

  // SLA
  slaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  slaText: { fontSize: 12, fontWeight: "600", color: "#F59E0B" },
  slaTextUrgent: { color: "#EF4444" },

  // Verification prompt
  verifyPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderTopWidth: 1,
    borderTopColor: "#BBF7D0",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  verifyTitle: { fontSize: 13, fontWeight: "700", color: "#065F46" },
  verifySubtitle: { fontSize: 11, color: "#6B7280" },
  verifyBtnYes: {
    backgroundColor: "#006A3B",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  verifyBtnNo: {
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  verifyBtnText: { fontSize: 12, fontWeight: "800", color: "#fff" },

  // Pickup card
  pickupCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pickupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  pickupIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#006A3B",
    alignItems: "center",
    justifyContent: "center",
  },
  pickupTitle: { fontSize: 14, fontWeight: "700", color: "#1B1C1C", flex: 1 },
  pickupTime: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  pickupBadge: {
    backgroundColor: "#006A3B",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pickupBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  pickupStats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  pickupStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  pickupStatText: { fontSize: 13, color: "#4B5563" },
  pickupVerified: {
    fontSize: 12,
    color: "#006A3B",
    marginTop: 8,
    fontWeight: "600",
  },
});

// Status progression bar styles (separate from main StyleSheet to keep it clean)
const sbStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  stepWrap: { alignItems: "center", gap: 2 },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  dotActive: { backgroundColor: "#006A3B" },
  dotCurrent: {
    backgroundColor: "#006A3B",
    borderWidth: 2,
    borderColor: "#BBF7D0",
  },
  label: {
    fontSize: 9,
    color: "#94A3B8",
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 50,
  },
  labelActive: { color: "#006A3B" },
  line: { flex: 1, height: 2, backgroundColor: "#E2E8F0", marginBottom: 10 },
  lineActive: { backgroundColor: "#006A3B" },
});
