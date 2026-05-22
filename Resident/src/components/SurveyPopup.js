import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_URL from '../config';

const COOLDOWN_KEY = 'gtrash_survey_dismissed_at';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const QUESTION = {
  id: 'gamification_motivation',
  text: 'What motivated you to do this today?',
};

const OPTIONS = [
  'I want my barangay to win',
  'I want to earn points',
  'I just want to keep my area clean',
  'Other',
];

export async function canShowSurvey() {
  try {
    const raw = await AsyncStorage.getItem(COOLDOWN_KEY);
    if (!raw) return true;
    return Date.now() - parseInt(raw, 10) > COOLDOWN_MS;
  } catch {
    return true;
  }
}

export async function markSurveyDismissed() {
  try {
    await AsyncStorage.setItem(COOLDOWN_KEY, String(Date.now()));
  } catch {}
}

export default function SurveyPopup({ visible, context, residentId, barangay, onDismiss }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/survey/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residentId,
          barangay,
          questionId: QUESTION.id,
          question: QUESTION.text,
          answer: selected,
          context,
        }),
      });
    } catch {}
    setLoading(false);
    setSubmitted(true);
    await markSurveyDismissed();
    setTimeout(() => {
      setSelected(null);
      setSubmitted(false);
      onDismiss();
    }, 1800);
  };

  const handleSkip = async () => {
    await markSurveyDismissed();
    setSelected(null);
    setSubmitted(false);
    onDismiss();
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={handleSkip}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleSkip}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => {}}>
          {submitted ? (
            <View style={styles.thankYou}>
              <Text style={styles.thankYouEmoji}>🙏</Text>
              <Text style={styles.thankYouTitle}>Thank you!</Text>
              <Text style={styles.thankYouSub}>Your feedback helps us improve G-TRASH.</Text>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.headerEmoji}>💬</Text>
                <Text style={styles.headerTitle}>Quick Question</Text>
              </View>
              <Text style={styles.question}>{QUESTION.text}</Text>
              <View style={styles.options}>
                {OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.option, selected === opt && styles.optionSelected]}
                    onPress={() => setSelected(opt)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.radio, selected === opt && styles.radioSelected]} />
                    <Text style={[styles.optionText, selected === opt && styles.optionTextSelected]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSubmit, (!selected || loading) && styles.btnDisabled]}
                  onPress={handleSubmit}
                  disabled={!selected || loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnSubmitText}>Submit</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnSkip]} onPress={handleSkip}>
                  <Text style={styles.btnSkipText}>Skip</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  headerEmoji: { fontSize: 18 },
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  question: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 16,
    lineHeight: 22,
  },
  options: { gap: 8, marginBottom: 20 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  optionSelected: {
    borderColor: '#006A3B',
    backgroundColor: '#F0FDF4',
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#9CA3AF',
  },
  radioSelected: {
    borderColor: '#006A3B',
    backgroundColor: '#006A3B',
  },
  optionText: { fontSize: 13, color: '#374151', fontWeight: '500', flex: 1 },
  optionTextSelected: { color: '#065F46', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSubmit: { backgroundColor: '#006A3B' },
  btnDisabled: { backgroundColor: '#9CA3AF' },
  btnSubmitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnSkip: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  btnSkipText: { color: '#6B7280', fontWeight: '600', fontSize: 14 },
  thankYou: { alignItems: 'center', paddingVertical: 24 },
  thankYouEmoji: { fontSize: 44, marginBottom: 12 },
  thankYouTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 6 },
  thankYouSub: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});
