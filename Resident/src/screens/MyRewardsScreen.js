import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
  ScrollView, Share, Animated, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import API_URL from '../config';

const GOAL_CATEGORY_META = {
  essentials:   { icon: 'shopping-bag',        label: 'Food & Essentials',    color: '#D97706', bg: '#FEF3C7' },
  merchandise:  { icon: 'eco',                 label: 'Eco-Merchandise',      color: '#059669', bg: '#D1FAE5' },
  vouchers:     { icon: 'confirmation-number', label: 'Vouchers & Discounts', color: '#2563EB', bg: '#DBEAFE' },
  utilities:    { icon: 'bolt',                label: 'Utility Perks',        color: '#7C3AED', bg: '#EDE9FE' },
  certificates: { icon: 'workspace-premium',   label: 'Honors & Certificates',color: '#E11D48', bg: '#FFE4E6' },
  other:        { icon: 'card-giftcard',       label: 'Special Reward',       color: '#4B5563', bg: '#F3F4F6' },
};

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
    } catch (_err) { /* silent */ }
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
    } catch (_err) { /* silent */ }
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

// ── Reward Goal Card (Points Milestone Target) ───────────────
function RewardGoalCard({ goal, userPoints, onRedeem, isRedeeming }) {
  const meta =
    GOAL_CATEGORY_META[goal.category] || GOAL_CATEGORY_META.essentials;
  const target = Number(goal.pointsRequired || 0);
  const current = Number(userPoints || 0);
  const percent =
    target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
  const isEligible = current >= target;
  const remainingStock = Math.max(
    0,
    (goal.quantity || 0) - (goal.claimedCount || 0)
  );
  const isOutOfStock = remainingStock <= 0 || goal.status === 'out_of_stock';
  const diff = Math.max(0, target - current);

  return (
    <View style={[goalCardStyles.card, { borderLeftColor: meta.color }]}>
      {/* Top row */}
      <View style={goalCardStyles.topRow}>
        <View style={[goalCardStyles.iconBox, { backgroundColor: meta.bg }]}>
          <MaterialIcons name={meta.icon} size={22} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
            }}
          >
            <Text style={goalCardStyles.title} numberOfLines={2}>
              {goal.title}
            </Text>
            <View style={goalCardStyles.ptsBadge}>
              <Text style={goalCardStyles.ptsBadgeText}>{target} PTS</Text>
            </View>
          </View>
          <Text style={goalCardStyles.category}>{meta.label}</Text>
        </View>
      </View>

      {/* Description */}
      {goal.description ? (
        <Text style={goalCardStyles.desc} numberOfLines={2}>
          {goal.description}
        </Text>
      ) : null}

      {/* Progress towards milestone */}
      <View style={goalCardStyles.progressSection}>
        <View style={goalCardStyles.progressLabels}>
          <Text style={goalCardStyles.progressCurrent}>
            {current.toLocaleString()} / {target.toLocaleString()} pts
          </Text>
          <Text
            style={[
              goalCardStyles.progressStatus,
              isEligible ? { color: '#006A3B' } : { color: '#D97706' },
            ]}
          >
            {isEligible ? 'Goal Reached!' : `${diff.toLocaleString()} more needed`}
          </Text>
        </View>
        <View style={goalCardStyles.progressBarTrack}>
          <View
            style={[
              goalCardStyles.progressBarFill,
              { width: `${percent}%` },
              isEligible
                ? { backgroundColor: '#006A3B' }
                : { backgroundColor: '#D97706' },
            ]}
          />
        </View>
      </View>

      {/* Meta footer: stock & validity */}
      <View style={goalCardStyles.metaFooter}>
        <View style={goalCardStyles.metaItem}>
          <MaterialIcons
            name="inventory-2"
            size={13}
            color={isOutOfStock ? '#EF4444' : '#6B7280'}
          />
          <Text
            style={[
              goalCardStyles.metaText,
              isOutOfStock && { color: '#EF4444', fontWeight: '700' },
            ]}
          >
            {isOutOfStock ? 'Out of stock' : `${remainingStock} left in stock`}
          </Text>
        </View>

        <View style={goalCardStyles.metaItem}>
          <MaterialIcons name="schedule" size={13} color="#6B7280" />
          <Text style={goalCardStyles.metaText}>
            Valid for {goal.claimValidityDays || 30}d once claimed
          </Text>
        </View>
      </View>

      {/* Action button */}
      <TouchableOpacity
        style={[
          goalCardStyles.redeemBtn,
          (!isEligible || isOutOfStock) && goalCardStyles.redeemBtnDisabled,
        ]}
        disabled={!isEligible || isOutOfStock || isRedeeming}
        onPress={() => onRedeem(goal)}
        activeOpacity={0.85}
      >
        {isOutOfStock ? (
          <Text style={goalCardStyles.redeemBtnTextDisabled}>Out of Stock</Text>
        ) : isEligible ? (
          <View style={goalCardStyles.btnContent}>
            <MaterialIcons name="redeem" size={16} color="#FFF" />
            <Text style={goalCardStyles.redeemBtnText}>
              Redeem for {target} Points
            </Text>
          </View>
        ) : (
          <View style={goalCardStyles.btnContent}>
            <MaterialIcons name="lock" size={14} color="#9CA3AF" />
            <Text style={goalCardStyles.redeemBtnTextDisabled}>
              Need {diff.toLocaleString()} more points
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const goalCardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
    lineHeight: 20,
    flex: 1,
  },
  category: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    marginTop: 2,
  },
  ptsBadge: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 6,
  },
  ptsBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#006A3B',
  },
  desc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  progressSection: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressCurrent: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F2937',
  },
  progressStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  metaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  redeemBtn: {
    backgroundColor: '#006A3B',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemBtnDisabled: {
    backgroundColor: '#F3F4F6',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  redeemBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  redeemBtnTextDisabled: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
});

// ── Main Screen ──────────────────────────────────────────────
export default function MyRewardsScreen({ navigation }) {
  const { user } = useAuth();
  const { bottom } = useSafeAreaInsets();

  // Top mode tab: "goals" (Milestones to achieve) vs "my_rewards" (Claimed vouchers & certificates)
  const [modeTab, setModeTab] = useState('goals');

  // Goals catalog state
  const [rewardGoals, setRewardGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [selectedGoalCategory, setSelectedGoalCategory] = useState('all');

  // Resident points balance
  const [userPoints, setUserPoints] = useState(user?.totalPoints || 0);

  // Claimed Rewards state
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimCodeReward, setClaimCodeReward] = useState(null);
  const [certificateReward, setCertificateReward] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  // Fetch resident points
  const fetchPoints = useCallback(async () => {
    const uid = user?.id || user?._id;
    if (!uid) return;
    try {
      const res = await fetch(`${API_URL}/api/residents/${uid}/points`);
      if (res.ok) {
        const data = await res.json();
        if (data.totalPoints != null) {
          setUserPoints(data.totalPoints);
        }
      }
    } catch (_err) {
      /* silent */
    }
  }, [user]);

  // Fetch Reward Goals created by officials
  const fetchRewardGoals = useCallback(async (silent = false) => {
    if (!silent) setGoalsLoading(true);
    try {
      const brgy = user?.barangay ? `?barangay=${encodeURIComponent(user.barangay)}` : '';
      const res = await fetch(`${API_URL}/api/reward-goals${brgy}`);
      const data = await res.json();
      const list = Array.isArray(data.goals) ? data.goals : Array.isArray(data) ? data : [];
      // Filter only active goals
      const activeList = list.filter((g) => g.isActive !== false && g.status !== 'inactive' && g.status !== 'archived');
      setRewardGoals(activeList);
      await AsyncStorage.setItem('@resident_reward_goals', JSON.stringify(activeList));
    } catch (_err) {
      const cached = await AsyncStorage.getItem('@resident_reward_goals').catch(() => null);
      if (cached) setRewardGoals(JSON.parse(cached));
    } finally {
      setGoalsLoading(false);
    }
  }, [user]);

  // Fetch direct rewards / claimed vouchers
  const fetchRewards = useCallback(async (silent = false) => {
    const uid = user?.id || user?._id;
    if (!uid) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rewards/resident/${uid}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setRewards(list);
      await AsyncStorage.setItem('@my_rewards', JSON.stringify(list));
    } catch (_err) {
      const cached = await AsyncStorage.getItem('@my_rewards').catch(() => null);
      if (cached) setRewards(JSON.parse(cached));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([fetchPoints(), fetchRewardGoals(true), fetchRewards(true)]);
    setRefreshing(false);
  }, [fetchPoints, fetchRewardGoals, fetchRewards]);

  useEffect(() => {
    fetchPoints();
    fetchRewardGoals();
    fetchRewards();
  }, [fetchPoints, fetchRewardGoals, fetchRewards]);

  // Redeem a Reward Goal using points
  const handleRedeemGoal = (goal) => {
    const ptsRequired = Number(goal.pointsRequired || 0);
    const ptsAvailable = Number(userPoints || 0);

    if (ptsAvailable < ptsRequired) {
      Alert.alert(
        'Insufficient Points',
        `You need ${ptsRequired.toLocaleString()} points to redeem this reward, but you currently have ${ptsAvailable.toLocaleString()} points.`
      );
      return;
    }

    Alert.alert(
      'Redeem Reward Goal',
      `Redeem "${goal.title}" for ${ptsRequired.toLocaleString()} points?\n\nYour eco-points balance will become ${(ptsAvailable - ptsRequired).toLocaleString()} PTS. A claim code valid for ${goal.claimValidityDays || 30} days will be generated for pickup at your Barangay Office.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Redeem',
          onPress: async () => {
            setClaiming(true);
            try {
              const res = await fetch(`${API_URL}/api/reward-goals/${goal._id}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ residentId: user?.id || user?._id }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Redemption failed');

              // Deduct points locally
              if (data.remainingPoints != null) {
                setUserPoints(data.remainingPoints);
              } else {
                setUserPoints((p) => Math.max(0, p - ptsRequired));
              }

              // Update stock count in goals list
              setRewardGoals((prev) =>
                prev.map((g) =>
                  g._id === goal._id
                    ? { ...g, claimedCount: (g.claimedCount || 0) + 1 }
                    : g
                )
              );

              // Add newly claimed reward
              if (data.reward) {
                setRewards((prev) => [data.reward, ...prev]);
                setClaimCodeReward(data.reward);
              }

              Alert.alert('Success!', `You have successfully redeemed "${goal.title}"!`);
            } catch (e) {
              Alert.alert('Error', e.message || 'Could not redeem goal. Please try again.');
            } finally {
              setClaiming(false);
            }
          },
        },
      ]
    );
  };

  // Claim direct reward
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
              setRewards((prev) =>
                prev.map((r) => (r._id === data.reward._id ? data.reward : r))
              );
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

  // Goal category filters
  const goalCategories = [
    { key: 'all', label: 'All Goals' },
    { key: 'essentials', label: 'Essentials' },
    { key: 'merchandise', label: 'Merchandise' },
    { key: 'vouchers', label: 'Vouchers' },
    { key: 'utilities', label: 'Perks' },
  ];

  const filteredGoals = rewardGoals.filter((g) =>
    selectedGoalCategory === 'all' ? true : g.category === selectedGoalCategory
  );

  const directTabs = [
    { key: 'all', label: 'All' },
    { key: 'published', label: 'To Claim' },
    { key: 'claimed', label: 'Claimed' },
  ];

  const filteredDirect = rewards.filter((r) =>
    activeTab === 'all' ? true : r.status === activeTab
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" backgroundColor="#006A3B" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rewards & Points</Text>
        <TouchableOpacity
          onPress={refreshAll}
          style={styles.refreshBtn}
          activeOpacity={0.7}
        >
          <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        {/* Top Segmented Mode Switcher */}
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, modeTab === 'goals' && styles.modeTabActive]}
            onPress={() => setModeTab('goals')}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="flag"
              size={16}
              color={modeTab === 'goals' ? '#006A3B' : '#6B7280'}
            />
            <Text
              style={[
                styles.modeTabText,
                modeTab === 'goals' && styles.modeTabTextActive,
              ]}
            >
              Reward Goals
            </Text>
            <View
              style={[
                styles.modeBadge,
                modeTab === 'goals' ? styles.modeBadgeActive : styles.modeBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.modeBadgeText,
                  modeTab === 'goals' && styles.modeBadgeTextActive,
                ]}
              >
                {rewardGoals.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, modeTab === 'my_rewards' && styles.modeTabActive]}
            onPress={() => setModeTab('my_rewards')}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="card-giftcard"
              size={16}
              color={modeTab === 'my_rewards' ? '#006A3B' : '#6B7280'}
            />
            <Text
              style={[
                styles.modeTabText,
                modeTab === 'my_rewards' && styles.modeTabTextActive,
              ]}
            >
              My Vouchers
            </Text>
            <View
              style={[
                styles.modeBadge,
                modeTab === 'my_rewards' ? styles.modeBadgeActive : styles.modeBadgeInactive,
              ]}
            >
              <Text
                style={[
                  styles.modeBadgeText,
                  modeTab === 'my_rewards' && styles.modeBadgeTextActive,
                ]}
              >
                {rewards.length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── MODE 1: REWARD GOALS (POINTS CATALOG) ── */}
        {modeTab === 'goals' && (
          <View style={{ flex: 1 }}>
            {/* Resident Points Header Banner */}
            <View style={styles.pointsBanner}>
              <View style={styles.pointsBannerLeft}>
                <View style={styles.pointsBadgeWrap}>
                  <MaterialIcons name="stars" size={24} color="#FFD700" />
                  <Text style={styles.pointsValue}>
                    {Number(userPoints || 0).toLocaleString()}
                  </Text>
                  <Text style={styles.pointsUnit}>POINTS</Text>
                </View>
                <Text style={styles.pointsSub}>
                  Earn points from proper segregation & cleanups
                </Text>
              </View>
              {user?.barangay ? (
                <View style={styles.brgyBadge}>
                  <MaterialIcons name="place" size={12} color="#006A3B" />
                  <Text style={styles.brgyText} numberOfLines={1}>
                    Brgy. {user.barangay}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Category Filter Pills */}
            <View style={styles.catFilterRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catFilterScroll}
              >
                {goalCategories.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[
                      styles.catPill,
                      selectedGoalCategory === c.key && styles.catPillActive,
                    ]}
                    onPress={() => setSelectedGoalCategory(c.key)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.catPillText,
                        selectedGoalCategory === c.key && styles.catPillTextActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {goalsLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#006A3B" />
                <Text style={styles.loadingText}>Loading reward goals…</Text>
              </View>
            ) : filteredGoals.length === 0 ? (
              <View style={styles.center}>
                <MaterialIcons name="flag" size={56} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No Reward Goals Yet</Text>
                <Text style={styles.emptySub}>
                  Your Barangay Officials haven't published reward goals for this
                  category yet. Check back soon!
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredGoals}
                keyExtractor={(g) => g._id}
                renderItem={({ item }) => (
                  <RewardGoalCard
                    goal={item}
                    userPoints={userPoints}
                    onRedeem={handleRedeemGoal}
                    isRedeeming={claiming}
                  />
                )}
                contentContainerStyle={[
                  styles.list,
                  { paddingBottom: bottom + 24 },
                ]}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={refreshAll}
                    tintColor="#006A3B"
                  />
                }
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}

        {/* ── MODE 2: MY VOUCHERS (DIRECT & CLAIMED REWARDS) ── */}
        {modeTab === 'my_rewards' && (
          <View style={{ flex: 1 }}>
            {/* Stats bar */}
            <View style={styles.statsBar}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{rewards.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#006A3B' }]}>
                  {rewards.filter((r) => r.status === 'published').length}
                </Text>
                <Text style={styles.statLabel}>To Claim</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#3B82F6' }]}>
                  {rewards.filter((r) => r.status === 'claimed').length}
                </Text>
                <Text style={styles.statLabel}>Claimed</Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              {directTabs.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tab, activeTab === t.key && styles.tabActive]}
                  onPress={() => setActiveTab(t.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === t.key && styles.tabTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#006A3B" />
              </View>
            ) : filteredDirect.length === 0 ? (
              <View style={styles.center}>
                <MaterialIcons name="card-giftcard" size={64} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>
                  {activeTab === 'all'
                    ? 'No vouchers yet'
                    : activeTab === 'published'
                    ? 'Nothing to claim'
                    : 'No claimed vouchers'}
                </Text>
                <Text style={styles.emptySub}>
                  {activeTab === 'all'
                    ? 'Reach reward goals or earn honors from your barangay!'
                    : 'Check the Reward Goals tab to redeem points for prizes.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredDirect}
                keyExtractor={(r) => r._id}
                renderItem={({ item }) => (
                  <RewardCard
                    reward={item}
                    onClaim={handleClaim}
                    onViewCode={setClaimCodeReward}
                    onViewCertificate={setCertificateReward}
                  />
                )}
                contentContainerStyle={[
                  styles.list,
                  { paddingBottom: bottom + 24 },
                ]}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={refreshAll}
                    tintColor="#006A3B"
                  />
                }
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}
      </View>

      {claiming && (
        <View style={styles.claimingOverlay}>
          <ActivityIndicator size="large" color="#006A3B" />
          <Text style={styles.claimingText}>Processing redemption…</Text>
        </View>
      )}

      {claimCodeReward && (
        <ClaimCodeModal
          reward={claimCodeReward}
          onClose={() => setClaimCodeReward(null)}
        />
      )}
      {certificateReward && (
        <CertificateModal
          reward={certificateReward}
          onClose={() => setCertificateReward(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#006A3B' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#006A3B',
    borderBottomWidth: 1,
    borderBottomColor: '#00552F',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modeTabActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  modeTabTextActive: {
    color: '#006A3B',
    fontWeight: '800',
  },
  modeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  modeBadgeActive: {
    backgroundColor: '#006A3B',
  },
  modeBadgeInactive: {
    backgroundColor: '#CBD5E1',
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#475569',
  },
  modeBadgeTextActive: {
    color: '#FFF',
  },
  pointsBanner: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  pointsBannerLeft: {
    flex: 1,
    gap: 2,
  },
  pointsBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1F2937',
  },
  pointsUnit: {
    fontSize: 10,
    fontWeight: '900',
    color: '#D97706',
    letterSpacing: 1,
  },
  pointsSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  brgyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  brgyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006A3B',
  },
  catFilterRow: {
    marginVertical: 4,
  },
  catFilterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catPillActive: {
    backgroundColor: '#006A3B',
    borderColor: '#006A3B',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  catPillTextActive: {
    color: '#FFF',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 16,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '900', color: '#1F2937' },
  statLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#006A3B' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  tabTextActive: { color: '#FFF' },
  list: { padding: 16 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  claimingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  claimingText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});

