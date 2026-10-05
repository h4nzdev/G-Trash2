import React, { useState } from 'react';
import { ShieldCheck, X, FileText, CheckCircle2, Mail, Phone, Lock, ChevronRight } from 'lucide-react';

export const PRIVACY_POLICY_SECTIONS = [
  {
    title: '1. Purpose of G-TRASH',
    content: `G-TRASH (Geo-Tracked Responsible and Smart Handling) is a waste management and community reporting system designed to help improve garbage collection, monitoring, reporting, and communication between residents and authorized officials.

The system may provide features such as:
• Garbage collection schedules
• Garbage truck location tracking
• Community issue reporting
• Report status monitoring
• Notifications
• Collection activity monitoring
• Community points
• IoT-based environmental monitoring
• Administrative monitoring and management`,
  },
  {
    title: '2. Information We Collect',
    content: `G-TRASH collects only information that is necessary for providing and improving its services.

2.1 Information Collected from Residents:
When a resident creates and uses an account, G-TRASH may collect:
• Full name
• Email address
• Contact information
• Password or authentication credentials
• Barangay or general residential location
• Profile information
• User-generated reports
• Photos or other attachments submitted with reports
• GPS/location information when a feature requires location access
• Report history
• Collection-related activity
• Community points and related activities
• Notifications and system interactions

Residents may be asked to provide location access when using features that require their location. For example, location information may be used to help identify the area where a waste-related issue was reported.

2.2 Information Collected from Officials:
Authorized officials may provide or have associated with their account:
• Full name
• Official email address
• Contact information
• Position or role
• Assigned barangay or administrative area
• Account credentials
• System activity and administrative actions
• Reports viewed or managed
• Garbage collection schedules managed
• Truck monitoring activities
• Other information necessary for authorized system operations

Officials are provided access based on their assigned role and permissions.

2.3 Location Information:
G-TRASH may collect location information when required by system features:
• Garbage truck tracking
• Identifying the location of submitted reports
• Showing collection areas
• Supporting route and navigation features
• Improving garbage collection monitoring
• Providing location-based services

The system will only request location access when it is necessary for a specific feature. Users may disable location permissions through their device settings. However, some location-dependent features may not work correctly if permission is disabled.

2.4 Photos and Reports:
Residents may submit reports regarding garbage collection or waste-related problems. A report may contain description, location, date and time, photos or other attachments, report category, and status. Users should avoid including unnecessary personal or sensitive information about other individuals in submitted reports or photographs.

2.5 IoT and Environmental Data:
G-TRASH may collect environmental information from connected IoT devices, such as air-quality sensor readings (sensor readings, measurement values, device status, date/time, and monitoring location), primarily used for environmental monitoring and waste-management purposes.`,
  },
  {
    title: '3. How We Use Collected Information',
    content: `G-TRASH may use collected information for the following purposes:
• Creating and managing user accounts
• Providing system functionality
• Processing community reports
• Monitoring garbage collection activities
• Tracking authorized garbage collection vehicles
• Providing collection schedules
• Sending relevant notifications
• Managing community points
• Monitoring environmental conditions
• Improving system performance
• Maintaining system security
• Troubleshooting technical problems
• Preventing unauthorized access or misuse
• Generating system reports and statistics
• Evaluating and improving waste-management services

Information will not be collected for purposes unrelated to the operation of G-TRASH unless appropriate notice and consent are provided.`,
  },
  {
    title: '4. Privacy of Resident Reports',
    content: `Resident reports are submitted to authorized officials for review and appropriate action.

Information contained in a report may be visible to authorized officials when necessary to investigate, verify, or resolve the reported issue.

Residents should understand that information included in a report, including photographs, descriptions, and location information, may be accessed by authorized personnel responsible for managing the report.

Personal information will not intentionally be made publicly available through the system unless necessary for a legitimate system purpose and appropriately authorized.`,
  },
  {
    title: '5. Access to Information',
    content: `Access to G-TRASH information is based on user roles and system permissions.

Residents:
Residents may access information associated with their own account, including their profile, submitted reports, report status, community points, and relevant notifications.

Officials:
Authorized officials may access information necessary to perform their assigned responsibilities, including:
• Resident-submitted reports
• Report locations
• Garbage collection schedules
• Collection activities
• Garbage truck information
• Relevant system and environmental monitoring data

Officials should only access information necessary for their assigned responsibilities.`,
  },
  {
    title: '6. Data Security',
    content: `G-TRASH takes reasonable measures to protect collected information from unauthorized access, unauthorized disclosure, loss, misuse, modification, and destruction.

Security measures may include:
• Authentication & password protection
• Role-based access control and access restrictions
• Secure communication between application components
• Database access controls and system monitoring
• Regular maintenance and updates

However, no electronic system can guarantee absolute security. Users should also protect their account credentials and avoid sharing passwords.`,
  },
  {
    title: '7. Account Security',
    content: `Users are responsible for maintaining the confidentiality of their account credentials.

Users should:
• Use a secure password
• Avoid sharing their password
• Log out when using a shared device
• Immediately report suspicious account activity
• Avoid submitting unnecessary personal information

G-TRASH personnel will not request a user's password through unofficial communication channels.`,
  },
  {
    title: '8. Data Sharing and Disclosure',
    content: `G-TRASH does not intentionally sell users' personal information.

Information may be accessed or disclosed when necessary for:
• Providing G-TRASH services
• Processing resident reports
• Performing official waste-management responsibilities
• System administration & technical maintenance
• Security and fraud prevention
• Compliance with applicable laws and regulations
• Responding to valid legal requests

Information should only be shared with authorized individuals or organizations when there is a legitimate purpose for doing so.`,
  },
  {
    title: '9. Data Retention',
    content: `G-TRASH will retain information only for as long as reasonably necessary to:
• Provide system services
• Maintain system records
• Process reports
• Monitor collection activities
• Generate necessary operational records
• Meet applicable legal or institutional requirements

When information is no longer necessary, it may be deleted, anonymized, or securely disposed of in accordance with applicable policies.`,
  },
  {
    title: '10. User Rights',
    content: `Subject to applicable laws, policies, and system limitations, users may have rights regarding their personal information, including the right to:
• Be informed about the collection and use of their information
• Access their personal information
• Request correction of inaccurate information
• Request deletion of information where applicable
• Withdraw consent where applicable
• Object to certain forms of processing where applicable
• Raise concerns regarding the handling of their information`,
  },
  {
    title: '11. Children\'s Privacy',
    content: `G-TRASH is intended for users who are authorized to use the system.

The system should not intentionally collect personal information from children without appropriate authorization or consent from a parent, guardian, or authorized institution when required. If discovered, administrators will take reasonable steps to review and remove the information.`,
  },
  {
    title: '12. Cookies and Local Storage',
    content: `G-TRASH may use browser storage or similar technologies to support system functionality, including session maintenance, preference storage, authentication support, and system functionality enhancement. Only information necessary for the operation of the application will be stored.`,
  },
  {
    title: '13. Third-Party Services',
    content: `G-TRASH may use third-party technologies and services to support features such as maps and location services, routing, cloud hosting, authentication, notifications, database services, AI-assisted features, and IoT communication. Information is processed according to their respective policies, with sharing limited to what is strictly necessary.`,
  },
  {
    title: '14. AI-Assisted Features',
    content: `Some G-TRASH features may use artificial intelligence to assist with functions such as image analysis, classification, or other system-supported tasks. AI-assisted features support the system and do not replace the responsibility of authorized officials to conduct human verification.`,
  },
  {
    title: '15. Changes to This Privacy Policy',
    content: `G-TRASH may update this Privacy Policy when necessary to reflect changes to system functionality, data collection practices, security measures, or legal and institutional requirements. When significant changes are made, users will be informed through the application.`,
  },
  {
    title: '16. Contact and Privacy Concerns',
    content: `Users who have questions, concerns, or requests regarding their personal information may contact the authorized G-TRASH administrator:

Email: hanzhmagbal@gmail.com
Contact Number: 09927870100`,
  },
  {
    title: '17. User Acknowledgment',
    content: `By creating an account or using G-TRASH, the user acknowledges that they have read and understood this Privacy Policy.

The user understands that G-TRASH may collect and process information necessary to provide its features, including account information, reports, location information, system activity, and other information described in this Privacy Policy.`,
  },
];

export default function PrivacyPolicyModal({ isOpen, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredSections = PRIVACY_POLICY_SECTIONS.filter(
    (sec) =>
      sec.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sec.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-overlay-fade">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-slide-x">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Official Policy
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  R.A. 10173 • Data Privacy Act
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 leading-snug">
                G-TRASH Privacy Policy
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white">
          <input
            type="text"
            placeholder="Search policy sections (e.g. 'location', 'reports', 'security')..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 placeholder-slate-400"
          />
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm text-slate-600 leading-relaxed">
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs text-slate-700 leading-relaxed">
            <p className="font-semibold text-emerald-900 mb-1">Scope & Applicability</p>
            G-TRASH (Geo-Tracked Responsible and Smart Handling) respects the privacy of its users and is committed to protecting the personal information collected through the system. This Privacy Policy explains how G-TRASH collects, uses, stores, protects, and manages information from <strong className="text-emerald-900">residents, barangay/city officials, and authorized system personnel</strong>.
          </div>

          {filteredSections.map((sec, i) => (
            <div key={i} className="pb-5 border-b border-slate-100 last:border-0">
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                {sec.title}
              </h3>
              <div className="text-xs text-slate-600 whitespace-pre-line pl-4">
                {sec.content}
              </div>
            </div>
          ))}

          {filteredSections.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-xs">
              No sections matching "{searchTerm}".
            </div>
          )}

          {/* Official Contact Box */}
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-bold text-slate-800">Data Protection & Inquiries</p>
              <p className="text-slate-500">Contact authorized G-TRASH system administrators</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                <Mail className="w-3.5 h-3.5" /> hanzhmagbal@gmail.com
              </div>
              <div className="flex items-center gap-1.5 text-emerald-800 font-medium">
                <Phone className="w-3.5 h-3.5" /> 09927870100
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Applies to Residents & Barangay/City Officials</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-sm"
          >
            I Understand & Close
          </button>
        </div>
      </div>
    </div>
  );
}
