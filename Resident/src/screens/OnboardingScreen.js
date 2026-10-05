import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import API_URL from '../config';

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

const POPULAR_BARANGAYS = [
  "Lahug", "Guadalupe", "Mabolo", "Talamban", "Banilad", "Tisa", "Kasambagan", "Basak Pardo"
];

const USAGE_PURPOSES = [
  {
    id: 'household',
    title: 'Household Waste Tracking',
    description: 'Track collection trucks & get pickup alerts for my home.',
    icon: 'home-outline',
    badge: 'Popular',
  },
  {
    id: 'reporting',
    title: 'Community Issue Reporting',
    description: 'Report uncollected waste, dumps & overflowing bins.',
    icon: 'megaphone-outline',
    badge: 'Civic',
  },
  {
    id: 'rewards',
    title: 'Eco Rewards & Clean Air',
    description: 'Earn points for waste segregation & environmental health.',
    icon: 'trophy-outline',
    badge: 'Rewards',
  },
  {
    id: 'commercial',
    title: 'Commercial & Property',
    description: 'Stay compliant with business waste pickup schedules.',
    icon: 'business-outline',
    badge: 'Business',
  },
];

const TABS = [
  { id: 'welcome', label: 'Welcome', icon: 'sparkles' },
  { id: 'purpose', label: 'Area & Purpose', icon: 'location' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
  { id: 'privacy', label: 'Privacy & Terms', icon: 'shield-checkmark' },
];

export default function OnboardingScreen({ onFinish, navigation }) {
  const { height } = useWindowDimensions();
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedBarangay, setSelectedBarangay] = useState('Lahug');
  const [barangaySearch, setBarangaySearch] = useState('');
  const [showBarangayModal, setShowBarangayModal] = useState(false);
  const [selectedPurposes, setSelectedPurposes] = useState(['household']);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Notification state
  const [notifGranted, setNotifGranted] = useState(false);
  const [isRequestingNotif, setIsRequestingNotif] = useState(false);

  // Terms state
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeDataConsent, setAgreeDataConsent] = useState(true);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      if (status === 'granted') setNotifGranted(true);
    }).catch(() => {});
  }, []);

  const handleFinish = async () => {
    if (!agreeTerms) {
      Alert.alert(
        'Terms Required',
        'Please check the box to agree to the Terms of Service & Privacy Policy to proceed.'
      );
      return;
    }

    setIsFinishing(true);
    try {
      await AsyncStorage.setItem('@HasSeenTour', 'true');
      await AsyncStorage.setItem('@UserSelectedArea', selectedBarangay);
      await AsyncStorage.setItem('@UserUsagePurpose', JSON.stringify(selectedPurposes));
      await AsyncStorage.setItem('@NotificationsEnabled', notifGranted ? 'true' : 'false');
      await AsyncStorage.setItem('@TermsAccepted', 'true');
      await AsyncStorage.setItem('@TermsAcceptedDate', new Date().toISOString());

      // Sync onboarding quick setup survey response to backend
      fetch(`${API_URL}/api/survey/quick-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barangay: selectedBarangay,
          purposes: selectedPurposes,
          notificationsEnabled: notifGranted,
          termsAccepted: agreeTerms,
          platform: Platform.OS,
        }),
      }).catch((e) => console.log('Quick setup sync notice:', e.message));

      if (onFinish) {
        onFinish();
      } else if (navigation) {
        navigation.goBack();
      }
    } catch (err) {
      console.warn('Failed to save onboarding preferences', err);
      if (onFinish) onFinish();
    } finally {
      setIsFinishing(false);
    }
  };

  const handleNext = () => {
    if (currentTab === 1 && !selectedBarangay) {
      Alert.alert('Area Selection', 'Please select your barangay or area to continue.');
      return;
    }
    if (currentTab < TABS.length - 1) {
      setCurrentTab(currentTab + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentTab > 0) {
      setCurrentTab(currentTab - 1);
    }
  };

  const togglePurpose = (id) => {
    setSelectedPurposes((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((p) => p !== id) : prev) : [...prev, id]
    );
  };

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Location permission is required to detect your barangay.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geo) {
        const candidateNames = [geo.district, geo.subregion, geo.street, geo.name].filter(Boolean);
        const matched = CEBU_BARANGAYS.find((b) =>
          candidateNames.some((c) => c.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(c.toLowerCase()))
        );
        if (matched) {
          setSelectedBarangay(matched);
          Alert.alert('Location Detected', `Detected Barangay ${matched}.`);
        } else {
          Alert.alert('Notice', 'Could not precisely match a Cebu City barangay. Please choose from the list.');
        }
      }
    } catch (e) {
      Alert.alert('Notice', 'Could not detect location. Please select your barangay manually.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleEnableNotification = async () => {
    setIsRequestingNotif(true);
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'G-TRASH Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#006A3B',
        });
      }

      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        setNotifGranted(true);
        await AsyncStorage.setItem('@NotificationsEnabled', 'true');
        Alert.alert('Notifications Enabled', 'You will receive timely truck arrival notices and collection updates!');
      } else {
        setNotifGranted(false);
        Alert.alert(
          'Notifications',
          'Notification permission was not granted. You can still enable it later in settings.'
        );
      }
    } catch (err) {
      console.warn('Error enabling notifications', err);
    } finally {
      setIsRequestingNotif(false);
    }
  };

  const filteredBarangays = CEBU_BARANGAYS.filter((b) =>
    b.toLowerCase().includes(barangaySearch.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="trash-bin" size={15} color="#006A3B" />
            </View>
            <Text style={styles.brandTitle}>G-TRASH</Text>
            <View style={styles.brandTag}>
              <Text style={styles.brandTagText}>CEBU CITY</Text>
            </View>
          </View>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>Step {currentTab + 1} of {TABS.length}</Text>
          </View>
        </View>

        {/* 4-Segment Progress Bar */}
        <View style={styles.segmentedProgress}>
          {TABS.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.progressSegment,
                idx <= currentTab ? styles.progressSegmentActive : styles.progressSegmentInactive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* ── Tab Content Area ── */}
      <View style={styles.contentContainer}>
        {/* TAB 1: WELCOME */}
        {currentTab === 0 && (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            <View style={styles.welcomeHeroCard}>
              <Image
                source={require('../../assets/welcome.png')}
                style={[styles.welcomeImage, { height: Math.min(height * 0.22, 170) }]}
                resizeMode="contain"
              />
            </View>

            <View style={styles.textCenter}>
              <View style={styles.inlinePill}>
                <Text style={styles.inlinePillText}>🌱 Official Waste App</Text>
              </View>
              <Text style={styles.mainTitle}>Welcome to G-Trash</Text>
              <Text style={styles.mainSubtitle}>
                Your smart community companion for real-time garbage truck tracking, waste management, and neighborhood cleanliness.
              </Text>
            </View>

            {/* Feature Highlights */}
            <View style={styles.featureGrid}>
              <View style={styles.featureCard}>
                <View style={[styles.featureIcon, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="bus" size={18} color="#059669" />
                </View>
                <View style={styles.featureBody}>
                  <Text style={styles.featureTitle}>Real-Time Truck Tracking</Text>
                  <Text style={styles.featureDesc}>
                    Live GPS map of garbage trucks arriving in your barangay.
                  </Text>
                </View>
              </View>

              <View style={styles.featureCard}>
                <View style={[styles.featureIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="camera" size={18} color="#2563EB" />
                </View>
                <View style={styles.featureBody}>
                  <Text style={styles.featureTitle}>Fast Incident Reporting</Text>
                  <Text style={styles.featureDesc}>
                    Report overflowing bins and uncollected garbage with photo evidence.
                  </Text>
                </View>
              </View>

              <View style={styles.featureCard}>
                <View style={[styles.featureIcon, { backgroundColor: '#FFFBEB' }]}>
                  <Ionicons name="ribbon" size={18} color="#D97706" />
                </View>
                <View style={styles.featureBody}>
                  <Text style={styles.featureTitle}>Points & Eco-Rewards</Text>
                  <Text style={styles.featureDesc}>
                    Earn barangay leaderboard points for responsible segregation.
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        )}

        {/* TAB 2: AREA & PURPOSE */}
        {currentTab === 1 && (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.screenHeading}>What is your Area & Purpose?</Text>
              <Text style={styles.screenSubheading}>
                We customize truck arrival times and waste alerts for your neighborhood.
              </Text>
            </View>

            {/* Area Selection Section */}
            <View style={styles.cardBox}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.labelWithIcon}>
                  <Ionicons name="location-sharp" size={16} color="#006A3B" />
                  <Text style={styles.cardBoxTitle}>Select Your Cebu Barangay</Text>
                </View>
                <TouchableOpacity
                  style={styles.detectBtn}
                  onPress={handleDetectLocation}
                  disabled={isDetectingLocation}
                  activeOpacity={0.8}
                >
                  {isDetectingLocation ? (
                    <ActivityIndicator size="small" color="#006A3B" />
                  ) : (
                    <>
                      <Ionicons name="navigate" size={12} color="#006A3B" />
                      <Text style={styles.detectBtnText}>Auto-Detect</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Main Selector Button */}
              <TouchableOpacity
                style={styles.barangaySelectorBtn}
                onPress={() => setShowBarangayModal(true)}
                activeOpacity={0.8}
              >
                <View style={styles.selectedAreaInfo}>
                  <Text style={styles.areaPreLabel}>Selected Barangay</Text>
                  <Text style={styles.selectedAreaText}>
                    Barangay {selectedBarangay || 'Choose Barangay'}
                  </Text>
                </View>
                <View style={styles.changeBadge}>
                  <Text style={styles.changeBadgeText}>Change</Text>
                  <Ionicons name="chevron-down" size={14} color="#006A3B" />
                </View>
              </TouchableOpacity>

              {/* Quick Pick Chips */}
              <Text style={styles.quickChipsTitle}>Quick Select:</Text>
              <View style={styles.chipsContainer}>
                {POPULAR_BARANGAYS.map((b) => {
                  const isSel = selectedBarangay === b;
                  return (
                    <TouchableOpacity
                      key={b}
                      style={[styles.chipItem, isSel && styles.chipItemActive]}
                      onPress={() => setSelectedBarangay(b)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, isSel && styles.chipTextActive]}>
                        {b}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Purpose Selection Section */}
            <View style={[styles.cardBox, { marginTop: 12 }]}>
              <View style={styles.labelWithIcon}>
                <Ionicons name="flag-outline" size={16} color="#006A3B" />
                <Text style={styles.cardBoxTitle}>Primary Purpose on G-Trash</Text>
              </View>
              <Text style={styles.cardBoxSubtitle}>
                Select all that apply to personalize your home screen:
              </Text>

              <View style={styles.purposeList}>
                {USAGE_PURPOSES.map((item) => {
                  const isChecked = selectedPurposes.includes(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.purposeCard, isChecked && styles.purposeCardActive]}
                      onPress={() => togglePurpose(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.purposeIconWrap, isChecked && styles.purposeIconWrapActive]}>
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={isChecked ? '#006A3B' : '#64748B'}
                        />
                      </View>
                      <View style={styles.purposeInfo}>
                        <View style={styles.purposeTitleRow}>
                          <Text style={[styles.purposeTitle, isChecked && styles.purposeTitleActive]}>
                            {item.title}
                          </Text>
                          <View style={styles.purposeBadge}>
                            <Text style={styles.purposeBadgeText}>{item.badge}</Text>
                          </View>
                        </View>
                        <Text style={styles.purposeDesc}>{item.description}</Text>
                      </View>
                      <View style={[styles.purposeCheckbox, isChecked && styles.purposeCheckboxActive]}>
                        {isChecked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        )}

        {/* TAB 3: ENABLE NOTIFICATIONS */}
        {currentTab === 2 && (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            <View style={styles.notifHeroCard}>
              <View style={[styles.notifIconCircle, notifGranted && styles.notifIconCircleGranted]}>
                <Ionicons
                  name={notifGranted ? 'checkmark-circle' : 'notifications'}
                  size={42}
                  color={notifGranted ? '#059669' : '#006A3B'}
                />
              </View>
              <View style={styles.notifStatusPill}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: notifGranted ? '#10B981' : '#F59E0B' },
                  ]}
                />
                <Text style={styles.notifStatusText}>
                  {notifGranted ? 'Notifications Activated' : 'Action Recommended'}
                </Text>
              </View>
            </View>

            <View style={styles.textCenter}>
              <Text style={styles.mainTitle}>Never Miss a Collection</Text>
              <Text style={styles.mainSubtitle}>
                Garbage trucks operate on strict routes. Push notifications give you 15-minute advance notice when the truck approaches your street.
              </Text>
            </View>

            {/* Notification Reasons */}
            <View style={styles.notifBenefitsCard}>
              <View style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" style={styles.benefitCheck} />
                <View style={styles.benefitTextWrap}>
                  <Text style={styles.benefitHead}>Truck Proximity Alerts</Text>
                  <Text style={styles.benefitSub}>
                    Advance chime when the collection truck is within 500 meters.
                  </Text>
                </View>
              </View>

              <View style={styles.benefitDivider} />

              <View style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" style={styles.benefitCheck} />
                <View style={styles.benefitTextWrap}>
                  <Text style={styles.benefitHead}>Report Status Updates</Text>
                  <Text style={styles.benefitSub}>
                    Instant alerts when officials review and resolve your reports.
                  </Text>
                </View>
              </View>

              <View style={styles.benefitDivider} />

              <View style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" style={styles.benefitCheck} />
                <View style={styles.benefitTextWrap}>
                  <Text style={styles.benefitHead}>Emergency & Weather Advisories</Text>
                  <Text style={styles.benefitSub}>
                    Notices on typhoons, schedule shifts, or road blockages.
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.notifActionSection}>
              <TouchableOpacity
                style={[styles.primaryActionBtn, notifGranted && styles.notifGrantedBtn]}
                onPress={handleEnableNotification}
                disabled={isRequestingNotif || notifGranted}
                activeOpacity={0.85}
              >
                {isRequestingNotif ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name={notifGranted ? 'checkmark-circle' : 'notifications-outline'}
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.primaryActionBtnText}>
                      {notifGranted ? 'Notifications Enabled ✓' : 'Enable Push Notifications'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {!notifGranted && (
                <TouchableOpacity
                  style={styles.maybeLaterBtn}
                  onPress={() => setCurrentTab(3)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.maybeLaterText}>Skip for now, I'll enable later</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        )}

        {/* TAB 4: PRIVACY POLICY & TERMS ACCEPTANCE */}
        {currentTab === 3 && (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.complianceBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#006A3B" />
                <Text style={styles.complianceBadgeText}>
                  Republic Act No. 10173 • Data Privacy Act
                </Text>
              </View>
              <Text style={styles.screenHeading}>Privacy Policy & Terms</Text>
              <Text style={styles.screenSubheading}>
                We prioritize user privacy. Your data is handled strictly to coordinate waste collection and public hygiene.
              </Text>
            </View>

            {/* Compact Policy Highlights Card */}
            <View style={styles.policyCard}>
              <View style={styles.policyPoint}>
                <Ionicons name="location-outline" size={18} color="#006A3B" style={styles.policyIcon} />
                <View style={styles.policyTextWrap}>
                  <Text style={styles.policyTitle}>Location Privacy</Text>
                  <Text style={styles.policyDesc}>
                    GPS is used strictly for live truck route tracking and report verification. Never sold or shared.
                  </Text>
                </View>
              </View>

              <View style={styles.policyDivider} />

              <View style={styles.policyPoint}>
                <Ionicons name="file-tray-full-outline" size={18} color="#006A3B" style={styles.policyIcon} />
                <View style={styles.policyTextWrap}>
                  <Text style={styles.policyTitle}>Civic Incident Reports</Text>
                  <Text style={styles.policyDesc}>
                    Waste reports and photos are transmitted only to Barangay Officials & City DPS for cleanup.
                  </Text>
                </View>
              </View>

              <View style={styles.policyDivider} />

              <View style={styles.policyPoint}>
                <Ionicons name="lock-closed-outline" size={18} color="#006A3B" style={styles.policyIcon} />
                <View style={styles.policyTextWrap}>
                  <Text style={styles.policyTitle}>No Commercial Data Selling</Text>
                  <Text style={styles.policyDesc}>
                    We will never sell or monetize your contact or personal data to advertisers.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.viewFullPolicyBtn}
                onPress={() => setShowPolicyModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.viewFullPolicyText}>Read Full Legal Terms & Policy</Text>
                <Ionicons name="open-outline" size={13} color="#006A3B" />
              </TouchableOpacity>
            </View>

            {/* Explicit Agreements Checkboxes */}
            <View style={styles.agreementsBox}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAgreeTerms(!agreeTerms)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkboxSquare, agreeTerms && styles.checkboxSquareActive]}>
                  {agreeTerms && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.checkboxLabel}>
                  I have read and agree to the{' '}
                  <Text style={styles.linkText} onPress={() => setShowPolicyModal(true)}>
                    Terms of Service
                  </Text>{' '}
                  and{' '}
                  <Text style={styles.linkText} onPress={() => setShowPolicyModal(true)}>
                    Privacy Policy
                  </Text>
                  . <Text style={styles.requiredAsterisk}>*</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setAgreeDataConsent(!agreeDataConsent)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkboxSquare, agreeDataConsent && styles.checkboxSquareActive]}>
                  {agreeDataConsent && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.checkboxLabel}>
                  I consent to the collection of route usage and reporting data to improve city waste operations.
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>

      {/* ── Fixed Bottom Footer Controls ── */}
      <View style={styles.footer}>
        {currentTab > 0 ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={17} color="#475569" />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.footerEmptySpace} />
        )}

        {currentTab < TABS.length - 1 ? (
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>Continue</Text>
            <Ionicons name="chevron-forward" size={17} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.finishBtn,
              !agreeTerms && styles.finishBtnDisabled,
            ]}
            onPress={handleFinish}
            disabled={!agreeTerms || isFinishing}
            activeOpacity={0.85}
          >
            {isFinishing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={17} color="#FFFFFF" />
                <Text style={styles.finishBtnText}>Accept & Enter G-Trash</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Barangay Picker Modal ── */}
      <Modal visible={showBarangayModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>Select Your Barangay</Text>
                <Text style={styles.modalHeaderSubtitle}>80 Barangays in Cebu City</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowBarangayModal(false)}
              >
                <Ionicons name="close" size={20} color="#1E293B" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBarWrap}>
              <Ionicons name="search" size={17} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search barangay (e.g. Lahug, Tisa)..."
                placeholderTextColor="#94A3B8"
                value={barangaySearch}
                onChangeText={setBarangaySearch}
                autoCorrect={false}
              />
              {barangaySearch.length > 0 && (
                <TouchableOpacity onPress={() => setBarangaySearch('')}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.barangayListScroll} showsVerticalScrollIndicator={false}>
              {filteredBarangays.map((b) => {
                const isSelected = selectedBarangay === b;
                return (
                  <TouchableOpacity
                    key={b}
                    style={[styles.barangayPickItem, isSelected && styles.barangayPickItemActive]}
                    onPress={() => {
                      setSelectedBarangay(b);
                      setShowBarangayModal(false);
                      setBarangaySearch('');
                    }}
                  >
                    <Text
                      style={[styles.barangayPickText, isSelected && styles.barangayPickTextActive]}
                    >
                      Barangay {b}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color="#006A3B" />}
                  </TouchableOpacity>
                );
              })}
              {filteredBarangays.length === 0 && (
                <View style={styles.emptySearchWrap}>
                  <Text style={styles.emptySearchText}>No barangay found matching "{barangaySearch}"</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Official G-TRASH Privacy Policy Modal ── */}
      <PrivacyPolicyModal
        visible={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
        onAgree={() => setAgreeTerms(true)}
        showAgreement={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  brandTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  brandTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  stepBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  segmentedProgress: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressSegmentActive: {
    backgroundColor: '#006A3B',
  },
  progressSegmentInactive: {
    backgroundColor: '#E2E8F0',
  },
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 70,
  },

  // ── Tab 1: Welcome ──
  welcomeHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 12,
  },
  welcomeImage: {
    width: '100%',
  },
  textCenter: {
    alignItems: 'center',
    marginBottom: 16,
  },
  inlinePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 6,
  },
  inlinePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  mainTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  mainSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  featureGrid: {
    gap: 8,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureBody: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 1,
  },
  featureDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },

  // ── Tab 2: Area & Purpose ──
  sectionHeader: {
    marginBottom: 12,
  },
  screenHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  screenSubheading: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardBoxSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  detectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  detectBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#006A3B',
  },
  barangaySelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#006A3B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  selectedAreaInfo: {
    flex: 1,
  },
  areaPreLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#047857',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedAreaText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  changeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006A3B',
  },
  quickChipsTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chipItem: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipItemActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#006A3B',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#006A3B',
    fontWeight: '700',
  },
  purposeList: {
    gap: 7,
  },
  purposeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  purposeCardActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  purposeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purposeIconWrapActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  purposeInfo: {
    flex: 1,
  },
  purposeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  purposeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  purposeTitleActive: {
    color: '#006A3B',
  },
  purposeBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  purposeBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#475569',
  },
  purposeDesc: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 14,
  },
  purposeCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purposeCheckboxActive: {
    backgroundColor: '#006A3B',
    borderColor: '#006A3B',
  },

  // ── Tab 3: Notifications ──
  notifHeroCard: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  notifIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#BBF7D0',
    marginBottom: 8,
  },
  notifIconCircleGranted: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  notifStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  notifStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  notifBenefitsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  benefitCheck: {
    marginTop: 1,
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitHead: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 1,
  },
  benefitSub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  benefitDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  notifActionSection: {
    gap: 8,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#006A3B',
    paddingVertical: 13,
    borderRadius: 12,
  },
  notifGrantedBtn: {
    backgroundColor: '#059669',
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  maybeLaterBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  maybeLaterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textDecorationLine: 'underline',
  },

  // ── Tab 4: Privacy & Terms ──
  complianceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 6,
  },
  complianceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  policyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  policyPoint: {
    flexDirection: 'row',
    gap: 10,
  },
  policyIcon: {
    marginTop: 1,
  },
  policyTextWrap: {
    flex: 1,
  },
  policyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  policyDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  policyDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  viewFullPolicyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  viewFullPolicyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006A3B',
  },
  agreementsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxSquareActive: {
    backgroundColor: '#006A3B',
    borderColor: '#006A3B',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
  },
  linkText: {
    color: '#006A3B',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  requiredAsterisk: {
    color: '#EF4444',
    fontWeight: '700',
  },

  // ── Fixed Bottom Footer Controls ──
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerEmptySpace: {
    width: 70,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#006A3B',
    paddingVertical: 12,
    borderRadius: 10,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  finishBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#006A3B',
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#006A3B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  finishBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  finishBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Modals ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalHeaderSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  barangayListScroll: {
    maxHeight: 340,
  },
  barangayPickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  barangayPickItemActive: {
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
  },
  barangayPickText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  barangayPickTextActive: {
    color: '#006A3B',
    fontWeight: '700',
  },
  emptySearchWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  legalScroll: {
    maxHeight: 360,
    paddingRight: 4,
  },
  legalSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 10,
    marginBottom: 3,
  },
  legalParagraph: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 6,
  },
  legalModalFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  legalAgreeBtn: {
    backgroundColor: '#006A3B',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  legalAgreeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
