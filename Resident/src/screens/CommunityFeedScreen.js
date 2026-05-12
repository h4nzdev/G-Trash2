import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Image, ActivityIndicator,
  RefreshControl, Dimensions, Modal, TextInput,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import API_URL from '../config';
import colors from '../constants/colors';

const { width } = Dimensions.get('window');

function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return date.toLocaleDateString();
}

export default function CommunityFeedScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenReports, setHiddenReports] = useState([]);
  const [activeReportForOptions, setActiveReportForOptions] = useState(null);

  // Discussion States
  const [activeReportForComments, setActiveReportForComments] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const fetchFeed = useCallback(async () => {
    if (!user?.barangay) return;
    try {
      const response = await fetch(`${API_URL}/api/reports?barangay=${user.barangay}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setReports(data);
      }
    } catch (error) {
      console.error('Feed fetch error:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.barangay]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleVote = async (reportId, type) => {
    if (!user?.id) return;
    
    // Optimistic UI update
    setReports(prev => prev.map(report => {
      if (report._id === reportId) {
        const isUpvoted = report.upvotes.includes(user.id);
        const isDownvoted = report.downvotes.includes(user.id);
        
        let newUpvotes = [...report.upvotes];
        let newDownvotes = [...report.downvotes];
        
        // Remove existing vote
        newUpvotes = newUpvotes.filter(id => id !== user.id);
        newDownvotes = newDownvotes.filter(id => id !== user.id);
        
        if (type === 'up' && !isUpvoted) {
          newUpvotes.push(user.id);
        } else if (type === 'down' && !isDownvoted) {
          newDownvotes.push(user.id);
        }
        
        return { ...report, upvotes: newUpvotes, downvotes: newDownvotes };
      }
      return report;
    }));

    try {
      const response = await fetch(`${API_URL}/api/reports/${reportId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, type }),
      });
      if (!response.ok) throw new Error('Vote failed');
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
      const response = await fetch(`${API_URL}/api/reports/${activeReportForComments._id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, text: commentText.trim() }),
      });
      const updatedComments = await response.json();
      
      if (!response.ok) throw new Error('Comment failed');

      // Update local reports list with new comments
      setReports(prev => prev.map(r => {
        if (r._id === activeReportForComments._id) {
          return { ...r, comments: updatedComments };
        }
        return r;
      }));
      
      // Update active report in modal
      setActiveReportForComments(prev => ({ ...prev, comments: updatedComments }));
      setCommentText('');
    } catch (error) {
      console.error('Comment error:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleHidePost = (reportId) => {
    setHiddenReports(prev => [...prev, reportId]);
    setActiveReportForOptions(null);
  };

  const handleReportPost = (reportId) => {
    // Logic for reporting (e.g. API call)
    alert("This post has been reported for review. Thank you for keeping the community safe.");
    setActiveReportForOptions(null);
  };

  const renderReportCard = ({ item }) => {
    const urgency = item.upvotes.length - item.downvotes.length;
    const hasUpvoted = item.upvotes.includes(user?.id);
    const hasDownvoted = item.downvotes.includes(user?.id);

    return (
      <View style={styles.card}>
        {/* Header: User Info */}
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <View style={styles.avatarContainer}>
              {item.userId?.profilePicture ? (
                <Image source={{ uri: item.userId.profilePicture }} style={styles.avatar} />
              ) : (
                <MaterialIcons name="person" size={24} color="#9CA3AF" />
              )}
            </View>
            <View>
              <Text style={styles.userName}>
                {item.userId ? `${item.userId.firstName} ${item.userId.lastName}` : item.reportedBy}
              </Text>
              <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.statusBadge, item.status === 'resolved' && styles.statusBadgeResolved]}>
              <Text style={[styles.statusText, item.status === 'resolved' && styles.statusTextResolved]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setActiveReportForOptions(item)} style={styles.dotsBtn}>
              <MaterialIcons name="more-vert" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.cardBody}>
          <Text style={styles.categoryText}>{item.category}</Text>
          <Text style={styles.descriptionText}>{item.description}</Text>
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={14} color="#6B7280" />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
        </View>

        {/* Image */}
        {item.reportImage && (
          <Image source={{ uri: item.reportImage }} style={styles.reportImage} />
        )}

        {/* Footer: Voting */}
        <View style={styles.cardFooter}>
          <View style={styles.votingContainer}>
            <TouchableOpacity 
              style={styles.voteBtn} 
              onPress={() => handleVote(item._id, 'up')}
            >
              <Ionicons 
                name={hasUpvoted ? "arrow-up-circle" : "arrow-up-circle-outline"} 
                size={28} 
                color={hasUpvoted ? colors.primaryGreen : "#6B7280"} 
              />
            </TouchableOpacity>
            
            <View style={styles.urgencyBadge}>
              <Text style={[
                styles.urgencyText, 
                urgency > 5 && { color: '#EF4444' },
                urgency < 0 && { color: '#6B7280' }
              ]}>
                {urgency > 0 ? `+${urgency}` : urgency} Urgency
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.voteBtn} 
              onPress={() => handleVote(item._id, 'down')}
            >
              <Ionicons 
                name={hasDownvoted ? "arrow-down-circle" : "arrow-down-circle-outline"} 
                size={28} 
                color={hasDownvoted ? "#EF4444" : "#6B7280"} 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.commentBtn} onPress={() => handleDiscuss(item)}>
            <Ionicons name="chatbubble-outline" size={20} color="#6B7280" />
            <Text style={styles.commentText}>{item.comments?.length || 0} Discuss</Text>
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
            onPress={() => navigation.navigate('Report')}
          >
            <MaterialIcons name="add" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.barangayLabel}>
          <MaterialIcons name="location-city" size={16} color={colors.primaryGreen} />
          <Text style={styles.barangayName}>Area: {user?.barangay || 'Cebu City'}</Text>
        </View>
      </View>

      <FlatList
        data={reports.filter(r => !hiddenReports.includes(r._id))}
        renderItem={renderReportCard}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={() => { setIsRefreshing(true); fetchFeed(); }} 
            colors={[colors.primaryGreen]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="megaphone-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Quiet in {user?.barangay}</Text>
            <Text style={styles.emptySub}>No issues reported in your area yet. Be the first to report something!</Text>
          </View>
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
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Discussion</Text>
              <TouchableOpacity onPress={() => setActiveReportForComments(null)}>
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
                      <Image source={{ uri: item.userId.profilePicture }} style={styles.commentAvatar} />
                    ) : (
                      <MaterialIcons name="person" size={18} color="#9CA3AF" />
                    )}
                  </View>
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentUser}>
                        {item.userId?.firstName} {item.userId?.lastName}
                      </Text>
                      <Text style={styles.commentTime}>{formatRelativeTime(item.createdAt)}</Text>
                    </View>
                    <Text style={styles.commentTextContent}>{item.text}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyComments}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyCommentsText}>No comments yet. Start the discussion!</Text>
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
                style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
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
            
            <TouchableOpacity 
              style={[styles.optionItem, styles.optionItemDestructive]}
              onPress={() => handleReportPost(activeReportForOptions?._id)}
            >
              <Ionicons name="flag-outline" size={22} color="#EF4444" />
              <Text style={[styles.optionText, styles.optionTextDestructive]}>Report this post</Text>
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
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  addBtn: {
    backgroundColor: '#006A3B',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#006A3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  barangayLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  barangayName: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  timeText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  statusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeResolved: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  statusTextResolved: {
    color: '#059669',
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryGreen,
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#6B7280',
  },
  reportImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  votingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
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
    fontWeight: '800',
    color: '#374151',
  },
  commentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  commentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#374151',
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  commentsList: {
    padding: 20,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  commentAvatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  commentAvatar: {
    width: '100%',
    height: '100%',
  },
  commentBody: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 16,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUser: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  commentTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  commentTextContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 18,
  },
  emptyComments: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyCommentsText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    color: '#111827',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },

  // Options Styles
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotsBtn: {
    padding: 4,
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  optionsContent: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    borderRadius: 20,
    padding: 8,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  optionItemDestructive: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  optionTextDestructive: {
    color: '#EF4444',
  },
  optionCancel: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  optionCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
  },
});
