import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
  ScrollView, Share, Animated, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import API_URL from '../config';

const CATEGORY_META = {
  best_segregation:     { icon: 'recycling',        label: 'Best in Segregation',      color: '#10B981' },
  most_trash_collected: { icon: 'delete',            label: 'Most Trash Collected',     color: '#3B82F6' },
  most_reports:         { icon: 'report-problem',   label: 'Most Reports Submitted',   color: '#F59E0B' },
  most_active:          { icon: 'emoji-events',      label: 'Most Active',              color: '#8B5CF6' },
};

const STATUS_META = {
  published: { label: 'Available to Claim', color: '#006A3B', bg: '#F0FDF4' },
  claimed:   { label: 'Claimed',            color: '#3B82F6', bg: '#EFF6FF' },
  expired:   { label: 'Expired',            color: '#9CA3AF', bg: '#F9FAFB' },
  draft:     { label: 'Pending Review',     color: '#F59E0B', bg: '#FFFBEB' },
};

function daysLeft(deadline) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline) - Date.now()) / 86400000);
}

// ── Claim Code Modal ─────────────────────────────────────────
function ClaimCodeModal({ reward, onClose }) {
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 14 }).start();
  }, []);

  const share = async () => {
    try {
      await Share.share({
        message: `G-TRASH Reward Claim\n\nTitle: ${reward.title}\nClaim Code: ${reward.claimCode}\nBarangay Office: Brgy. ${reward.barangay}\nDeadline: ${reward.claimDeadline ? new Date(reward.claimDeadline).toLocaleDateString() : 'N/A'}\n\nPresent this code at your Barangay Office to claim your reward.`,
      });
    } catch { /* silent */ }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={ccStyles.overlay}>
        <Animated.View style={[ccStyles.card, { transform: [{ scale: scaleAnim }] }]}>
          {/* Confetti header */}
          <View style={ccStyles.header}>
            <MaterialIcons name="emoji-events" size={48} color="#FFD700" />
            <Text style={ccStyles.congrats}>Congratulations!</Text>
            <Text style={ccStyles.subtitle}>{reward.title}</Text>
          </View>

          {/* Code */}
          <View style={ccStyles.codeBox}>
            <Text style={ccStyles.codeLabel}>YOUR CLAIM CODE</Text>
            <Text style={ccStyles.code}>{reward.claimCode}</Text>
            <Text style={ccStyles.codeHint}>Show this code at your Barangay Office</Text>
          </View>

          {/* Details */}
          <View style={ccStyles.details}>
            {reward.rewardValue ? (
              <View style={ccStyles.detailRow}>
                <MaterialIcons name="card-giftcard" size={16} color="#006A3B" />
                <Text style={ccStyles.detailText}>{reward.rewardValue}</Text>
              </View>
            ) : null}
            <View style={ccStyles.detailRow}>
              <MaterialIcons name="location-on" size={16} color="#006A3B" />
              <Text style={ccStyles.detailText}>Barangay {reward.barangay} Office</Text>
            </View>
            {reward.claimDeadline ? (
              <View style={ccStyles.detailRow}>
                <MaterialIcons name="schedule" size={16} color="#006A3B" />
                <Text style={ccStyles.detailText}>
                  Deadline: {new Date(reward.claimDeadline).toLocaleDateString()}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={ccStyles.actions}>
            <TouchableOpacity style={ccStyles.shareBtn} onPress={share} activeOpacity={0.85}>
              <MaterialIcons name="share" size={18} color="#006A3B" />
              <Text style={ccStyles.shareBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ccStyles.closeBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={ccStyles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const ccStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#FFF', borderRadius: 28, width: '100%', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, elevation: 12 },
  header: { backgroundColor: '#006A3B', padding: 28, alignItems: 'center', gap: 8 },
  congrats: { fontSize: 22, fontWeight: '900', color: '#FFF', marginTop: 8 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600', textAlign: 'center' },
  codeBox: { alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#F0FDF4' },
  codeLabel: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.5, marginBottom: 10 },
  code: { fontSize: 28, fontWeight: '900', color: '#006A3B', letterSpacing: 4, fontVariant: ['tabular-nums'] },
  codeHint: { fontSize: 11, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  details: { paddingHorizontal: 24, paddingVertical: 16, gap: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailText: { fontSize: 13, color: '#374151', fontWeight: '500', flex: 1 },
  actions: { flexDirection: 'row', gap: 10, padding: 20, paddingTop: 8 },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, backgroundColor: '#F0FDF4', borderRadius: 16, borderWidth: 1, borderColor: '#BBF7D0' },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: '#006A3B' },
  closeBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: '#006A3B', borderRadius: 16 },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});

// ── Certificate Modal ─────────────────────────────────────────
function CertificateModal({ reward, onClose }) {
  const { bottom } = useSafeAreaInsets();
  const categoryMeta = CATEGORY_META[reward.category] || CATEGORY_META.most_active;

  const share = async () => {
    try {
      await Share.share({
        message: `G-TRASH Certificate of Recognition\n\nThis certifies that ${reward.recipientName} has been recognized for ${categoryMeta.label}.\n\nIssued by: ${reward.issuedByName || 'Barangay Official'}, Brgy. ${reward.barangay}\nDate: ${reward.issuedDate ? new Date(reward.issuedDate).toLocaleDateString() : 'N/A'}`,
      });
    } catch { /* silent */ }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={certStyles.safeArea} edges={['top']}>
        {/* Close button */}
        <TouchableOpacity style={certStyles.closeTopBtn} onPress={onClose} activeOpacity={0.8}>
          <MaterialIcons name="close" size={22} color="#fff" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={certStyles.scroll} showsVerticalScrollIndicator={false}>
          {/* Certificate card */}
          <View style={certStyles.cert}>
            {/* Decorative top border strip */}
            <View style={certStyles.topStrip}>
              <View style={certStyles.stripInner} />
            </View>

            {/* Header */}
            <View style={certStyles.header}>
              <View style={certStyles.sealCircle}>
                <MaterialIcons name="emoji-events" size={36} color="#FFD700" />
              </View>
              <Text style={certStyles.govLabel}>G-TRASH SMART WASTE MANAGEMENT</Text>
              <Text style={certStyles.certTitle}>Certificate of Recognition</Text>
              <View style={certStyles.dividerLine} />
            </View>

            {/* Body */}
            <View style={certStyles.body}>
              <Text style={certStyles.presentsText}>This certifies that</Text>
              <Text style={certStyles.recipientName}>{reward.recipientName}</Text>
              <Text style={certStyles.bodyText}>has been recognized for outstanding contribution in</Text>
              <View style={[certStyles.categoryBadge, { backgroundColor: categoryMeta.color + '18', borderColor: categoryMeta.color + '40' }]}>
                <MaterialIcons name={categoryMeta.icon} size={16} color={categoryMeta.color} />
                <Text style={[certStyles.categoryText, { color: categoryMeta.color }]}>{categoryMeta.label}</Text>
              </View>
              {reward.description ? (
                <Text style={certStyles.description}>"{reward.description}"</Text>
              ) : null}
              {reward.rewardValue ? (
                <View style={certStyles.prizeBox}>
                  <MaterialIcons name="card-giftcard" size={14} color="#006A3B" />
                  <Text style={certStyles.prizeText}>{reward.rewardValue}</Text>
                </View>
              ) : null}
            </View>

            {/* Signature + Seal row */}
            <View style={certStyles.sigRow}>
              {/* Official's signature block */}
              <View style={certStyles.sigBlock}>
                {reward.officialSignatureUrl ? (
                  <Image
                    source={{ uri: reward.officialSignatureUrl }}
                    style={certStyles.sigImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={certStyles.sigPlaceholder} />
                )}
                <View style={certStyles.sigUnderline} />
                <Text style={certStyles.sigName}>{reward.issuedByName || 'Barangay Official'}</Text>
                <Text style={certStyles.sigRole}>Brgy. {reward.barangay}</Text>
              </View>

              {/* Official seal */}
              <View style={certStyles.sealBlock}>
                <View style={certStyles.sealRing}>
                  <View style={certStyles.sealInner}>
                    <MaterialIcons name="verified" size={32} color="#006A3B" />
                  </View>
                </View>
                <Text style={certStyles.sealLabel}>OFFICIAL{'\n'}SEAL</Text>
              </View>
            </View>

            {/* Date */}
            <View style={certStyles.dateRow}>
              <Text style={certStyles.dateText}>
                Issued on {reward.issuedDate
                  ? new Date(reward.issuedDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
                  : 'N/A'}
              </Text>
            </View>

            {/* Bottom strip */}
            <View style={certStyles.bottomStrip}>
              <Text style={certStyles.bottomStripText}>
                Barangay {reward.barangay}  ·  G-TRASH System  ·  Cebu City
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={[certStyles.actions, { paddingBottom: bottom + 16 }]}>
          <TouchableOpacity style={certStyles.shareBtn} onPress={share} activeOpacity={0.85}>
            <MaterialIcons name="share" size={18} color="#006A3B" />
            <Text style={certStyles.shareBtnText}>Share Certificate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={certStyles.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={certStyles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const certStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1a1a2e' },
  closeTopBtn: { position: 'absolute', top: 56, right: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingTop: 60 },
  cert: { backgroundColor: '#FFFDF7', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 12 },
  topStrip: { height: 10, backgroundColor: '#006A3B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stripInner: { flex: 1, height: 3, marginHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 2 },
  header: { alignItems: 'center', paddingTop: 28, paddingHorizontal: 24, paddingBottom: 20 },
  sealCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#006A3B', alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#006A3B', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  govLabel: { fontSize: 9, fontWeight: '800', color: '#006A3B', letterSpacing: 2, textAlign: 'center', marginBottom: 6 },
  certTitle: { fontSize: 22, fontWeight: '900', color: '#1a1a2e', letterSpacing: 0.5, textAlign: 'center' },
  dividerLine: { width: 60, height: 2, backgroundColor: '#D4AF37', borderRadius: 1, marginTop: 12 },
  body: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F0EDE0' },
  presentsText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 10 },
  recipientName: { fontSize: 26, fontWeight: '900', color: '#1a1a2e', textAlign: 'center', letterSpacing: 0.5, marginBottom: 12, fontStyle: 'italic' },
  bodyText: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 14 },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginBottom: 14 },
  categoryText: { fontSize: 13, fontWeight: '800' },
  description: { fontSize: 12, color: '#6B7280', fontStyle: 'italic', textAlign: 'center', lineHeight: 18, marginBottom: 10 },
  prizeBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0' },
  prizeText: { fontSize: 13, fontWeight: '700', color: '#006A3B' },
  sigRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 24 },
  sigBlock: { alignItems: 'center', flex: 1 },
  sigImage: { width: 140, height: 56, marginBottom: 4 },
  sigPlaceholder: { width: 140, height: 56, marginBottom: 4 },
  sigUnderline: { width: 130, height: 1, backgroundColor: '#374151', marginBottom: 6 },
  sigName: { fontSize: 12, fontWeight: '800', color: '#1F2937', textAlign: 'center' },
  sigRole: { fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 2 },
  sealBlock: { alignItems: 'center', marginLeft: 16 },
  sealRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, borderColor: '#006A3B', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  sealInner: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: '#006A3B', alignItems: 'center', justifyContent: 'center' },
  sealLabel: { fontSize: 8, fontWeight: '800', color: '#006A3B', letterSpacing: 1.5, textAlign: 'center', marginTop: 6 },
  dateRow: { alignItems: 'center', paddingBottom: 16 },
  dateText: { fontSize: 11, color: '#9CA3AF' },
  bottomStrip: { backgroundColor: '#006A3B', paddingVertical: 10, alignItems: 'center' },
  bottomStripText: { fontSize: 9, color: 'rgba(255,255,255,0.8)', letterSpacing: 1.5, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, backgroundColor: '#1a1a2e' },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, backgroundColor: '#F0FDF4', borderRadius: 16, borderWidth: 1, borderColor: '#BBF7D0' },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: '#006A3B' },
  doneBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: '#006A3B', borderRadius: 16 },
  doneBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});

// ── Reward Card ──────────────────────────────────────────────
function RewardCard({ reward, onClaim, onViewCode, onViewCertificate }) {
  const meta = CATEGORY_META[reward.category] || CATEGORY_META.most_active;
  const statusMeta = STATUS_META[reward.status] || STATUS_META.draft;
  const days = daysLeft(reward.claimDeadline);
  const isClaimable = reward.status === 'published';

  return (
    <View style={[cardStyles.card, { borderLeftColor: meta.color }]}>
      <View style={cardStyles.top}>
        <View style={[cardStyles.iconBox, { backgroundColor: meta.color + '18' }]}>
          <MaterialIcons name={meta.icon} size={22} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.title} numberOfLines={2}>{reward.title}</Text>
          <Text style={cardStyles.category}>{meta.label}</Text>
        </View>
        <View style={[cardStyles.statusBadge, { backgroundColor: statusMeta.bg }]}>
          <Text style={[cardStyles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>
      </View>

      {reward.rewardValue ? (
        <View style={cardStyles.prizeRow}>
          <MaterialIcons name="card-giftcard" size={14} color="#6B7280" />
          <Text style={cardStyles.prizeText}>{reward.rewardValue}</Text>
        </View>
      ) : null}

      {reward.description ? (
        <Text style={cardStyles.desc} numberOfLines={2}>{reward.description}</Text>
      ) : null}

      <View style={cardStyles.footer}>
        {reward.claimDeadline && reward.status !== 'claimed' ? (
          <View style={cardStyles.deadlineRow}>
            <MaterialIcons name="schedule" size={12} color={days != null && days <= 7 ? '#EF4444' : '#9CA3AF'} />
            <Text style={[cardStyles.deadlineText, days != null && days <= 7 && { color: '#EF4444' }]}>
              {days != null && days > 0 ? `${days} day${days !== 1 ? 's' : ''} left` : days === 0 ? 'Due today' : 'Expired'}
            </Text>
          </View>
        ) : reward.claimedDate ? (
          <Text style={cardStyles.deadlineText}>Claimed {new Date(reward.claimedDate).toLocaleDateString()}</Text>
        ) : <View />}

        {reward.rewardType === 'certificate' ? (
          <TouchableOpacity style={cardStyles.certBtn} onPress={() => onViewCertificate(reward)} activeOpacity={0.85}>
            <MaterialIcons name="workspace-premium" size={14} color="#fff" />
            <Text style={cardStyles.certBtnText}>View Certificate</Text>
          </TouchableOpacity>
        ) : (
          <>
            {isClaimable && (
              <TouchableOpacity style={cardStyles.claimBtn} onPress={() => onClaim(reward)} activeOpacity={0.85}>
                <Text style={cardStyles.claimBtnText}>Claim Reward</Text>
                <MaterialIcons name="arrow-forward" size={14} color="#FFF" />
              </TouchableOpacity>
            )}
            {reward.status === 'claimed' && reward.claimCode && (
              <TouchableOpacity style={cardStyles.codeBtn} onPress={() => onViewCode(reward)} activeOpacity={0.85}>
                <MaterialIcons name="qr-code" size={14} color="#006A3B" />
                <Text style={cardStyles.codeBtnText}>View Code</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 12, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  top: { flexDirection: 'row', gap: 12, marginBottom: 10, alignItems: 'flex-start' },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontSize: 14, fontWeight: '800', color: '#1F2937', lineHeight: 20 },
  category: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, flexShrink: 0 },
  statusText: { fontSize: 10, fontWeight: '800' },
  prizeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  prizeText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  desc: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginBottom: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deadlineText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  claimBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#006A3B', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  claimBtnText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  codeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: '#BBF7D0' },
  codeBtnText: { fontSize: 12, fontWeight: '700', color: '#006A3B' },
  certBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#D97706', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  certBtnText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
});

// ── Main Screen ──────────────────────────────────────────────
export default function MyRewardsScreen({ navigation }) {
  const { user } = useAuth();
  const { bottom } = useSafeAreaInsets();
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimCodeReward, setClaimCodeReward] = useState(null);
  const [certificateReward, setCertificateReward] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  const fetchRewards = useCallback(async (silent = false) => {
    const uid = user?.id || user?._id;
    if (!uid) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rewards/resident/${uid}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setRewards(list);
      // Persist locally for offline access
      await AsyncStorage.setItem('@my_rewards', JSON.stringify(list));
    } catch {
      // Fallback to cache
      const cached = await AsyncStorage.getItem('@my_rewards').catch(() => null);
      if (cached) setRewards(JSON.parse(cached));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchRewards(); }, [fetchRewards]);

  const handleClaim = (reward) => {
    Alert.alert(
      'Claim Reward',
      `Claim "${reward.title}"?\n\nA unique code will be generated. Present it at your Barangay Office to receive your reward.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Claim',
          onPress: async () => {
            setClaiming(true);
            try {
              const res = await fetch(`${API_URL}/api/rewards/${reward._id}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ residentId: user?.id || user?._id }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Claim failed');
              setRewards(prev => prev.map(r => r._id === data.reward._id ? data.reward : r));
              setClaimCodeReward(data.reward);
            } catch (e) {
              Alert.alert('Error', e.message || 'Could not claim reward. Try again.');
            } finally {
              setClaiming(false);
            }
          },
        },
      ]
    );
  };

  const tabs = [
    { key: 'all',       label: 'All' },
    { key: 'published', label: 'To Claim' },
    { key: 'claimed',   label: 'Claimed' },
  ];

  const filtered = rewards.filter(r => activeTab === 'all' ? true : r.status === activeTab);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Rewards</Text>
        <TouchableOpacity onPress={() => fetchRewards()} style={styles.refreshBtn}>
          <MaterialIcons name="refresh" size={22} color="#1F2937" />
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{rewards.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#006A3B' }]}>{rewards.filter(r => r.status === 'published').length}</Text>
          <Text style={styles.statLabel}>To Claim</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#3B82F6' }]}>{rewards.filter(r => r.status === 'claimed').length}</Text>
          <Text style={styles.statLabel}>Claimed</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#006A3B" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="card-giftcard" size={64} color="#E5E7EB" />
          <Text style={styles.emptyTitle}>
            {activeTab === 'all' ? 'No rewards yet' : activeTab === 'published' ? 'Nothing to claim' : 'No claimed rewards'}
          </Text>
          <Text style={styles.emptySub}>
            {activeTab === 'all'
              ? 'Keep being active in your barangay to earn rewards!'
              : 'Check back after officials publish new rewards.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={r => r._id}
          renderItem={({ item }) => (
            <RewardCard
              reward={item}
              onClaim={handleClaim}
              onViewCode={setClaimCodeReward}
              onViewCertificate={setCertificateReward}
            />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: bottom + 24 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRewards(true); }} tintColor="#006A3B" />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {claiming && (
        <View style={styles.claimingOverlay}>
          <ActivityIndicator size="large" color="#006A3B" />
          <Text style={styles.claimingText}>Processing claim…</Text>
        </View>
      )}

      {claimCodeReward && (
        <ClaimCodeModal reward={claimCodeReward} onClose={() => setClaimCodeReward(null)} />
      )}
      {certificateReward && (
        <CertificateModal reward={certificateReward} onClose={() => setCertificateReward(null)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  refreshBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#1F2937' },
  statsBar: { flexDirection: 'row', backgroundColor: '#FFF', paddingVertical: 16, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '900', color: '#1F2937' },
  statLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },
  tabs: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  tabActive: { backgroundColor: '#006A3B' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  tabTextActive: { color: '#FFF' },
  list: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#9CA3AF', textAlign: 'center' },
  emptySub: { fontSize: 13, color: '#D1D5DB', textAlign: 'center', lineHeight: 20 },
  claimingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', gap: 12 },
  claimingText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
