import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import API_URL from '../config';

const SEVERITIES = [
  { value: 'low',      label: 'Low',      color: '#22c55e', bg: '#dcfce7' },
  { value: 'medium',   label: 'Medium',   color: '#f59e0b', bg: '#fef3c7' },
  { value: 'high',     label: 'High',     color: '#ef4444', bg: '#fee2e2' },
  { value: 'critical', label: 'Critical', color: '#7c3aed', bg: '#ede9fe' },
];

export default function BugReportScreen({ navigation }) {
  const { user } = useAuth();
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity]     = useState('medium');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title for the bug report.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe the issue.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          severity,
          platform: `Mobile (${Platform.OS})`,
          deviceInfo: `${Platform.OS} ${Platform.Version}`,
          reportedBy: user?.name || user?.email || 'Anonymous',
          status: 'open',
        }),
      });

      if (!res.ok) throw new Error('Server error');

      Alert.alert(
        'Report Submitted',
        'Thank you! Our team will review your bug report shortly.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1B1C1C" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report a Bug</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color="#006A3B" />
            <Text style={styles.infoText}>
              Help us improve G-TRASH by reporting bugs or issues you encounter.
            </Text>
          </View>

          {/* Title */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Bug Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Map not loading correctly"
              placeholderTextColor="#C4CEC7"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          {/* Severity */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Severity</Text>
            <View style={styles.severityRow}>
              {SEVERITIES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[
                    styles.severityBtn,
                    { borderColor: s.color },
                    severity === s.value && { backgroundColor: s.bg },
                  ]}
                  onPress={() => setSeverity(s.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.severityBtnText,
                      { color: severity === s.value ? s.color : '#7A8C7F' },
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe what happened, what you expected, and steps to reproduce…"
              placeholderTextColor="#C4CEC7"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          {/* Auto-filled info */}
          <View style={styles.autoInfoCard}>
            <Ionicons name="phone-portrait-outline" size={16} color="#7A8C7F" />
            <Text style={styles.autoInfoText}>
              Platform: Mobile ({Platform.OS}){'\n'}
              Reported by: {user?.name || user?.email || 'Anonymous'}
            </Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Submit Bug Report</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FBF9F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF4F0',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F6FAF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1B1C1C',
  },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#006A3B',
    lineHeight: 18,
  },

  fieldGroup: { gap: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7A8C7F',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDF4F0',
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    color: '#1B1C1C',
  },
  textArea: {
    height: 130,
    paddingTop: 14,
    paddingBottom: 14,
  },

  severityRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  severityBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EDF4F0',
    backgroundColor: '#fff',
  },
  severityBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7A8C7F',
  },

  autoInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F6FAF8',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EDF4F0',
  },
  autoInfoText: {
    fontSize: 12,
    color: '#7A8C7F',
    lineHeight: 18,
  },

  submitBtn: {
    backgroundColor: '#006A3B',
    borderRadius: 16,
    height: 54,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#006A3B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
