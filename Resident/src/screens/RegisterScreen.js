import React, { useState, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  TouchableOpacity, Modal, FlatList, Alert, 
  KeyboardAvoidingView, Platform, Animated 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import colors from '../constants/colors';

const CEBU_BARANGAYS = [
  "Adlaon","Agsungot","Apas","Babag","Bacayan","Banilad","Basak Pardo",
  "Basak San Nicolas","Binaliw","Bonbon","Budla-an","Buhisan","Bulacao",
  "Buot-Taup","Busay","Calamba","Cambinocot","Capitol Site","Carreta",
  "Cogon Pardo","Cogon Ramos","Day-as","Duljo Fatima","Ermita",
  "Guadalupe","Guba","Hippodromo","Inayawan","IT Park","Kalubihan",
  "Kalunasan","Kamagayan","Kamputhaw","Kasambagan","Kinasang-an",
  "Labangon","Lahug","Lorega San Miguel","Lusaran","Luz","Mabini",
  "Mabolo","Malubog","Mambaling","Pahina Central","Pahina San Nicolas",
  "Pardo","Pari-an","Paril","Pasil","Pit-os","Poblacion Pardo",
  "Pulangbato","Pung-ol Sibugay","Punta Princesa","Quiot","Sambag I",
  "Sambag II","San Antonio","San Jose","San Nicolas Proper","San Roque",
  "Santa Cruz","Sapangdaku","Sawang Calero","Sinsin","Sirao",
  "Suba","Sudlon I","Sudlon II","T. Padilla","Tabunan","Tagbao",
  "Talamban","Taptap","Tejero","Tinago","Tisa","To-ong","Zapatera",
];

const STEPS = [
  { key: 'personal', label: 'personal_info', icon: 'person' },
  { key: 'address', label: 'address_details', icon: 'location-on' },
  { key: 'account', label: 'account_setup', icon: 'lock' },
];

export default function RegisterScreen({ navigation }) {
  const { t } = useTranslation();
  const { register, isLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [showBarangayModal, setShowBarangayModal] = useState(false);
  const [barangaySearch, setBarangaySearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '',
    barangay: '', street: '', houseNo: '',
    email: '', password: '', confirmPassword: '',
  });

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const animateProgress = (toStep) => {
    Animated.spring(progressAnim, {
      toValue: toStep,
      useNativeDriver: false,
      friction: 8,
    }).start();
  };

  const goNext = () => {
    if (currentStep === 0) {
      if (!form.firstName.trim() || !form.lastName.trim()) {
        Alert.alert(t('error'), 'Please fill in your first and last name.');
        return;
      }
    } else if (currentStep === 1) {
      if (!form.barangay) {
        Alert.alert(t('error'), 'Please select your barangay.');
        return;
      }
      if (!form.street.trim()) {
        Alert.alert(t('error'), 'Please enter your street address.');
        return;
      }
      if (!form.houseNo.trim()) {
        Alert.alert(t('error'), 'Please enter your house or unit number.');
        return;
      }
    }
    if (currentStep < STEPS.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      animateProgress(next);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      animateProgress(prev);
    } else {
      navigation.goBack();
    }
  };

  const handleRegister = async () => {
    if (!form.email.trim() || !form.password.trim()) {
      Alert.alert(t('error'), 'Please fill in email and password.');
      return;
    }
    if (form.password.length < 6) {
      Alert.alert(t('error'), 'Password must be at least 6 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      Alert.alert(t('error'), 'Passwords do not match.');
      return;
    }
    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        barangay: form.barangay,
        street: form.street.trim(),
        houseNo: form.houseNo.trim(),
      });
    } catch (error) {
      if (error.code === 'HOUSEHOLD_EXISTS') {
        Alert.alert(
          'Household Already Registered',
          `${error.message}\n\n${error.messageCebuano}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(t('error'), error.message || 'Please try again.');
      }
    }
  };

  const filteredBarangays = CEBU_BARANGAYS.filter(b =>
    b.toLowerCase().includes(barangaySearch.toLowerCase())
  );

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, STEPS.length - 1],
    outputRange: ['0%', '100%'],
  });

  // --- Render each step ---
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('personal_info')}</Text>
            <Text style={styles.stepSubtitle}>Tell us a bit about yourself</Text>

            <Text style={styles.label}>{t('first_name')} *</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="person-outline" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Juan" placeholderTextColor="#9CA3AF"
                value={form.firstName} onChangeText={v => updateForm('firstName', v)} />
            </View>

            <Text style={styles.label}>{t('last_name')} *</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="person-outline" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Dela Cruz" placeholderTextColor="#9CA3AF"
                value={form.lastName} onChangeText={v => updateForm('lastName', v)} />
            </View>

            <Text style={styles.label}>{t('phone')}</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="phone" size={20} color="#6B7280" style={styles.inputIcon} />
              <Text style={styles.prefixText}>+63</Text>
              <TextInput style={styles.input} placeholder="9XX XXX XXXX" placeholderTextColor="#9CA3AF"
                value={form.phone} onChangeText={v => updateForm('phone', v)}
                keyboardType="phone-pad" maxLength={10} />
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('address')}</Text>
            <Text style={styles.stepSubtitle}>Where in Cebu City do you live?</Text>

            {/* Permanence notice */}
            <View style={styles.addressNotice}>
              <MaterialIcons name="info-outline" size={16} color="#D97706" />
              <Text style={styles.addressNoticeText}>
                Your address is permanent after registration. One account is allowed per household. To update it, contact your Barangay Office.
              </Text>
            </View>

            <Text style={styles.label}>{t('barangay')} *</Text>
            <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowBarangayModal(true)}>
              <MaterialIcons name="location-city" size={20} color="#6B7280" style={styles.inputIcon} />
              <Text style={[styles.dropdownText, !form.barangay && { color: '#9CA3AF' }]}>
                {form.barangay || t('select_barangay')}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={24} color="#6B7280" />
            </TouchableOpacity>

            <Text style={styles.label}>{t('street')} *</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="signpost" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="e.g. Purok 5, Sanciangko St."
                placeholderTextColor="#9CA3AF" value={form.street}
                onChangeText={v => updateForm('street', v)} />
            </View>

            <Text style={styles.label}>{t('house_no')} *</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="home" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="e.g. Block 5, Lot 12 or Room 3"
                placeholderTextColor="#9CA3AF" value={form.houseNo}
                onChangeText={v => updateForm('houseNo', v)} />
            </View>

            {form.barangay ? (
              <View style={styles.selectedBadge}>
                <MaterialIcons name="check-circle" size={16} color={colors.primaryGreen} />
                <Text style={styles.selectedBadgeText}>
                  {t('barangay')} {form.barangay}, Cebu City
                </Text>
              </View>
            ) : null}
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('create_account')}</Text>
            <Text style={styles.stepSubtitle}>Set up your login credentials</Text>

            <Text style={styles.label}>{t('email')} *</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="email" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="juan@email.com" placeholderTextColor="#9CA3AF"
                value={form.email} onChangeText={v => updateForm('email', v)}
                autoCapitalize="none" keyboardType="email-address" />
            </View>

            <Text style={styles.label}>{t('password')} *</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock-outline" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Min. 8 characters" placeholderTextColor="#9CA3AF"
                value={form.password} onChangeText={v => updateForm('password', v)}
                secureTextEntry={!showPassword} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('confirm_password')} *</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Re-enter password" placeholderTextColor="#9CA3AF"
                value={form.confirmPassword} onChangeText={v => updateForm('confirmPassword', v)}
                secureTextEntry={!showConfirmPassword} />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Green Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('create_account')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Step Indicator */}
        <View style={styles.stepIndicatorContainer}>
          <View style={styles.progressBarBg}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
          </View>
          <View style={styles.stepsRow}>
            {STEPS.map((step, i) => {
              const isActive = i === currentStep;
              const isDone = i < currentStep;
              return (
                <View key={step.key} style={styles.stepItem}>
                  <View style={[
                    styles.stepCircle,
                    isActive && styles.stepCircleActive,
                    isDone && styles.stepCircleDone,
                  ]}>
                    {isDone ? (
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                    ) : (
                      <MaterialIcons name={step.icon} size={16}
                        color={isActive ? '#FFF' : '#9CA3AF'} />
                    )}
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    isActive && styles.stepLabelActive,
                    isDone && styles.stepLabelDone,
                  ]}>{t(step.label)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {renderStep()}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {currentStep > 0 && (
              <TouchableOpacity style={styles.prevButton} onPress={goBack}>
                <Ionicons name="arrow-back" size={18} color={colors.primaryGreen} />
                <Text style={styles.prevButtonText}>{t('back')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.nextButton, currentStep === 0 && { flex: 1 }]}
              onPress={currentStep === STEPS.length - 1 ? handleRegister : goNext}
            >
              <Text style={styles.nextButtonText}>
                {currentStep === STEPS.length - 1 ? t('create_account') : t('continue')}
              </Text>
              {currentStep < STEPS.length - 1 && (
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Barangay Picker Modal */}
        <Modal visible={showBarangayModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('select_barangay')}</Text>
                <TouchableOpacity onPress={() => { setShowBarangayModal(false); setBarangaySearch(''); }}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalSearch}>
                <Ionicons name="search" size={18} color="#9CA3AF" />
                <TextInput style={styles.modalSearchInput} placeholder={t('search_barangay')}
                  placeholderTextColor="#9CA3AF" value={barangaySearch}
                  onChangeText={setBarangaySearch} autoFocus />
              </View>

              <FlatList
                data={filteredBarangays}
                keyExtractor={item => item}
                showsVerticalScrollIndicator={false}
                style={styles.modalList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.modalItem, form.barangay === item && styles.modalItemActive]}
                    onPress={() => {
                      updateForm('barangay', item);
                      setShowBarangayModal(false);
                      setBarangaySearch('');
                    }}
                  >
                    <MaterialIcons name="location-on" size={18}
                      color={form.barangay === item ? colors.primaryGreen : '#9CA3AF'} />
                    <Text style={[styles.modalItemText, form.barangay === item && styles.modalItemTextActive]}>
                      {item}
                    </Text>
                    {form.barangay === item && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primaryGreen} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No barangay found for "{barangaySearch}"</Text>
                }
              />
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primaryGreen },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },

  // Step Indicator
  stepIndicatorContainer: { paddingHorizontal: 24, paddingBottom: 20 },
  progressBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginBottom: 16 },
  progressBarFill: { height: 4, backgroundColor: '#FFF', borderRadius: 2 },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stepItem: { alignItems: 'center', flex: 1 },
  stepCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  stepCircleActive: { backgroundColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  stepCircleDone: { backgroundColor: '#4CAF50' },
  stepLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  stepLabelActive: { color: '#FFF' },
  stepLabelDone: { color: 'rgba(255,255,255,0.8)' },

  // Form Card
  formCard: {
    flex: 1, backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 24, paddingTop: 28,
  },
  stepContent: {},
  stepTitle: { fontSize: 24, fontWeight: '700', color: '#1B1C1C', marginBottom: 4 },
  stepSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },

  // Labels
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginLeft: 4 },

  // Inputs
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6',
    borderRadius: 14, marginBottom: 18, paddingHorizontal: 16, height: 54,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1B1C1C' },
  eyeIcon: { padding: 8 },
  prefixText: { fontSize: 16, color: '#374151', fontWeight: '600', marginRight: 6 },

  // Dropdown
  dropdownButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6',
    borderRadius: 14, marginBottom: 18, paddingHorizontal: 16, height: 54,
  },
  dropdownText: { flex: 1, fontSize: 16, color: '#1B1C1C' },

  // Address notice
  addressNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  addressNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
    fontWeight: '500',
  },

  // Selected badge
  selectedBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, gap: 8, marginTop: 4,
  },
  selectedBadgeText: { fontSize: 13, color: colors.primaryGreen, fontWeight: '600' },

  // Password strength
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -8, marginBottom: 8, marginLeft: 4 },
  strengthDot: { width: 32, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
  strengthActive: { backgroundColor: colors.primaryGreen },
  strengthLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginLeft: 4 },

  // Action Buttons
  actionRow: {
    flexDirection: 'row', gap: 12, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  prevButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 54, paddingHorizontal: 24, borderRadius: 16,
    borderWidth: 2, borderColor: colors.primaryGreen,
  },
  prevButtonText: { fontSize: 16, fontWeight: '600', color: colors.primaryGreen },
  nextButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 16, backgroundColor: colors.primaryGreen,
    shadowColor: colors.primaryGreen, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  nextButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '75%', paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1B1C1C' },
  modalSearch: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6',
    marginHorizontal: 24, marginBottom: 12, borderRadius: 12,
    paddingHorizontal: 14, height: 46, gap: 10,
  },
  modalSearchInput: { flex: 1, fontSize: 15, color: '#1B1C1C' },
  modalList: { paddingHorizontal: 12 },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    paddingHorizontal: 14, borderRadius: 12, gap: 12,
  },
  modalItemActive: { backgroundColor: '#ECFDF5' },
  modalItemText: { flex: 1, fontSize: 15, color: '#374151' },
  modalItemTextActive: { color: colors.primaryGreen, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 14, paddingVertical: 32 },
});
