import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const PRIVACY_POLICY_SECTIONS = [
  {
    title: '1. Purpose of G-TRASH',
    content: `G-TRASH (Geo-Tracked Responsible and Smart Handling) is a waste management and community reporting system designed to help improve garbage collection, monitoring, reporting, and communication between residents and authorized officials.\n\nThe system may provide features such as:\n• Garbage collection schedules\n• Garbage truck location tracking\n• Community issue reporting\n• Report status monitoring\n• Notifications\n• Collection activity monitoring\n• Community points\n• IoT-based environmental monitoring\n• Administrative monitoring and management`,
  },
  {
    title: '2. Information We Collect',
    content: `G-TRASH collects only information that is necessary for providing and improving its services.\n\n2.1 Information Collected from Residents:\nWhen a resident creates and uses an account, G-TRASH may collect:\n• Full name\n• Email address\n• Contact information\n• Password or authentication credentials\n• Barangay or general residential location\n• Profile information\n• User-generated reports\n• Photos or other attachments submitted with reports\n• GPS/location information when a feature requires location access\n• Report history\n• Collection-related activity\n• Community points and related activities\n• Notifications and system interactions\n\nResidents may be asked to provide location access when using features that require their location. For example, location information may be used to help identify the area where a waste-related issue was reported.\n\n2.2 Information Collected from Officials:\nAuthorized officials may provide or have associated with their account:\n• Full name\n• Official email address\n• Contact information\n• Position or role\n• Assigned barangay or administrative area\n• Account credentials\n• System activity and administrative actions\n• Reports viewed or managed\n• Garbage collection schedules managed\n• Truck monitoring activities\n• Other information necessary for authorized system operations\n\n2.3 Location Information:\nG-TRASH may collect location information when required by system features, including:\n• Garbage truck tracking\n• Identifying the location of submitted reports\n• Showing collection areas\n• Supporting route and navigation features\n• Improving garbage collection monitoring\n• Providing location-based services\n\nThe system will only request location access when it is necessary for a specific feature. Users may disable location permissions through device settings, though location-dependent features may be impacted.\n\n2.4 Photos and Reports:\nResidents may submit reports regarding garbage collection or waste-related problems. A report may contain description, location, date and time, photos or attachments, report category, and status. Users should avoid including unnecessary personal or sensitive information about other individuals in submitted reports or photographs.\n\n2.5 IoT and Environmental Data:\nG-TRASH may collect environmental information from connected IoT devices (sensor readings, measurement values, device status, date/time, and monitoring location), primarily used for environmental monitoring and waste management.`,
  },
  {
    title: '3. How We Use Collected Information',
    content: `G-TRASH may use collected information for the following purposes:\n• Creating and managing user accounts\n• Providing system functionality\n• Processing community reports\n• Monitoring garbage collection activities\n• Tracking authorized garbage collection vehicles\n• Providing collection schedules\n• Sending relevant notifications\n• Managing community points\n• Monitoring environmental conditions\n• Improving system performance\n• Maintaining system security\n• Troubleshooting technical problems\n• Preventing unauthorized access or misuse\n• Generating system reports and statistics\n• Evaluating and improving waste-management services\n\nInformation will not be collected for purposes unrelated to the operation of G-TRASH unless appropriate notice and consent are provided.`,
  },
  {
    title: '4. Privacy of Resident Reports',
    content: `Resident reports are submitted to authorized officials for review and appropriate action.\n\nInformation contained in a report may be visible to authorized officials when necessary to investigate, verify, or resolve the reported issue.\n\nResidents should understand that information included in a report, including photographs, descriptions, and location information, may be accessed by authorized personnel responsible for managing the report.\n\nPersonal information will not intentionally be made publicly available through the system unless necessary for a legitimate system purpose and appropriately authorized.`,
  },
  {
    title: '5. Access to Information',
    content: `Access to G-TRASH information is based on user roles and system permissions.\n\nResidents:\nResidents may access information associated with their own account, including:\n• Their profile\n• Their submitted reports\n• Their report status\n• Their community points\n• Their relevant notifications\n\nOfficials:\nAuthorized officials may access information necessary to perform their assigned responsibilities, including:\n• Resident-submitted reports\n• Report locations\n• Garbage collection schedules\n• Collection activities\n• Garbage truck information\n• Relevant system and environmental monitoring data\n\nOfficials should only access information necessary for their assigned responsibilities.`,
  },
  {
    title: '6. Data Security',
    content: `G-TRASH takes reasonable measures to protect collected information from unauthorized access, unauthorized disclosure, loss, misuse, modification, and destruction.\n\nSecurity measures may include:\n• Authentication\n• Password protection\n• Role-based access control\n• Access restrictions\n• Secure communication between application components\n• Database access controls\n• System monitoring\n• Regular maintenance and updates\n\nHowever, no electronic system can guarantee absolute security. Users should also protect their account credentials and avoid sharing passwords.`,
  },
  {
    title: '7. Account Security',
    content: `Users are responsible for maintaining the confidentiality of their account credentials.\n\nUsers should:\n• Use a secure password\n• Avoid sharing their password\n• Log out when using a shared device\n• Immediately report suspicious account activity\n• Avoid submitting unnecessary personal information\n\nG-TRASH personnel will not request a user's password through unofficial communication channels.`,
  },
  {
    title: '8. Data Sharing and Disclosure',
    content: `G-TRASH does not intentionally sell users' personal information.\n\nInformation may be accessed or disclosed when necessary for:\n• Providing G-TRASH services\n• Processing resident reports\n• Performing official waste-management responsibilities\n• System administration\n• Technical maintenance\n• Security and fraud prevention\n• Compliance with applicable laws and regulations\n• Responding to valid legal requests\n\nInformation should only be shared with authorized individuals or organizations when there is a legitimate purpose for doing so.`,
  },
  {
    title: '9. Data Retention',
    content: `G-TRASH will retain information only for as long as reasonably necessary to:\n• Provide system services\n• Maintain system records\n• Process reports\n• Monitor collection activities\n• Generate necessary operational records\n• Meet applicable legal or institutional requirements\n\nWhen information is no longer necessary, it may be deleted, anonymized, or securely disposed of in accordance with applicable policies.`,
  },
  {
    title: '10. User Rights',
    content: `Subject to applicable laws, policies, and system limitations, users may have rights regarding their personal information, including the right to:\n• Be informed about the collection and use of their information\n• Access their personal information\n• Request correction of inaccurate information\n• Request deletion of information where applicable\n• Withdraw consent where applicable\n• Object to certain forms of processing where applicable\n• Raise concerns regarding the handling of their information`,
  },
  {
    title: '11. Children\'s Privacy',
    content: `G-TRASH is intended for users who are authorized to use the system.\n\nThe system should not intentionally collect personal information from children without appropriate authorization or consent from a parent, guardian, or authorized institution when required.\n\nIf information belonging to a child is discovered to have been collected without appropriate authorization, the system administrator may take reasonable steps to review and remove the information when appropriate.`,
  },
  {
    title: '12. Cookies and Local Storage',
    content: `G-TRASH may use browser storage or similar technologies to support system functionality. These technologies may be used to maintain user sessions, remember preferences, support authentication, and improve functionality. Such technologies should only store information necessary for the operation of the application.`,
  },
  {
    title: '13. Third-Party Services',
    content: `G-TRASH may use third-party technologies and services to support features such as:\n• Maps and location services\n• Routing\n• Cloud hosting\n• Authentication\n• Notifications\n• Database services\n• AI-assisted features\n• IoT communication\n\nWhen third-party services are used, information may be processed by those services according to their respective privacy policies and terms. G-TRASH aims to limit information shared to what is necessary for the relevant feature.`,
  },
  {
    title: '14. AI-Assisted Features',
    content: `Some G-TRASH features may use artificial intelligence to assist with functions such as image analysis, classification, or other system-supported tasks.\n\nAI-assisted features are intended to support the system and do not replace the responsibility of authorized officials to review information when human verification is necessary.\n\nUsers should avoid submitting unnecessary personal or sensitive information to AI-assisted features.`,
  },
  {
    title: '15. Changes to This Privacy Policy',
    content: `G-TRASH may update this Privacy Policy when necessary to reflect changes to system functionality, data collection practices, security measures, or legal and institutional requirements.\n\nWhen significant changes are made, users should be appropriately informed through the application or other official communication channels. The updated Privacy Policy will indicate its effective date.`,
  },
  {
    title: '16. Contact and Privacy Concerns',
    content: `Users who have questions, concerns, or requests regarding their personal information may contact the authorized G-TRASH administrator or the organization responsible for operating the system.\n\nEmail: hanzhmagbal@gmail.com\nContact Number: 09927870100`,
  },
  {
    title: '17. User Acknowledgment',
    content: `By creating an account or using G-TRASH, the user acknowledges that they have read and understood this Privacy Policy.\n\nThe user understands that G-TRASH may collect and process information necessary to provide its features, including account information, reports, location information, system activity, and other information described in this Privacy Policy.\n\nWhere required, the system will request the user's consent before collecting or processing information that requires consent.`,
  },
];

export default function PrivacyPolicyModal({ visible, onClose, onAgree, showAgreement = false }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.fullScreenContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.headerTitleWrap}>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Ionicons name="shield-checkmark" size={12} color="#006A3B" />
                <Text style={styles.badgeText}>Official Policy</Text>
              </View>
              <Text style={styles.badgeSub}>R.A. 10173 Compliant</Text>
            </View>
            <Text style={styles.modalTitle}>G-TRASH Privacy Policy</Text>
            <Text style={styles.modalSubtitle}>
              Geo-Tracked Responsible and Smart Handling
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color="#1E293B" />
          </TouchableOpacity>
        </View>

          {/* Scrollable Document Content */}
          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
            <View style={styles.introCard}>
              <Text style={styles.introText}>
                G-TRASH respects the privacy of its users and is committed to protecting the personal information collected through the system. This Privacy Policy explains how G-TRASH collects, uses, stores, protects, and manages information from <Text style={styles.boldText}>residents, barangay/city officials, and authorized system personnel</Text>.
              </Text>
            </View>

            {PRIVACY_POLICY_SECTIONS.map((sec, i) => (
              <View key={i} style={styles.sectionCard}>
                <Text style={styles.sectionHeading}>{sec.title}</Text>
                <Text style={styles.sectionBody}>{sec.content}</Text>
              </View>
            ))}

            <View style={styles.contactCard}>
              <Text style={styles.contactTitle}>Official Inquiries</Text>
              <Text style={styles.contactDetail}>✉️ Email: hanzhmagbal@gmail.com</Text>
              <Text style={styles.contactDetail}>📞 Contact: 09927870100</Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            {showAgreement ? (
              <View style={styles.agreementWrap}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setAgreed(!agreed)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkboxSquare, agreed && styles.checkboxSquareActive]}>
                    {agreed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.checkboxText}>
                    I have read, understood, and agree to the G-TRASH Privacy Policy.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, !agreed && styles.primaryBtnDisabled]}
                  onPress={() => {
                    if (onAgree) onAgree();
                    onClose();
                  }}
                  disabled={!agreed}
                >
                  <Text style={styles.primaryBtnText}>Accept Policy & Continue</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
                <Text style={styles.primaryBtnText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#006A3B',
  },
  badgeSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
  },
  introCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  introText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionCard: {
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  contactCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 8,
  },
  contactTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#006A3B',
    marginBottom: 4,
  },
  contactDetail: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
    marginTop: 2,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  agreementWrap: {
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  checkboxSquareActive: {
    backgroundColor: '#006A3B',
    borderColor: '#006A3B',
  },
  checkboxText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  primaryBtn: {
    backgroundColor: '#006A3B',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
