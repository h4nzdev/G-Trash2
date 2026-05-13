import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const resources = {
  en: {
    translation: {
      // Common
      welcome: "Welcome to G-TRASH",
      login: "Login",
      register: "Register",
      logout: "Logout",
      cancel: "Cancel",
      success: "Success",
      error: "Error",
      save: "Save",
      search: "Search",
      loading: "Loading...",
      see_all: "See All",
      
      // Home
      good_morning: "Good Morning",
      good_afternoon: "Good Afternoon",
      good_evening: "Good Evening",
      trucks_active_one: "{{count}} truck active in your area.",
      trucks_active_other: "{{count}} trucks active in your area.",
      no_trucks_active: "No trucks currently active in your area.",
      air_quality: "Current Air Quality",
      upcoming_collection: "Upcoming Collection",
      prepare_bin: "Prepare My Bin",
      track_live: "Track Live Arrival",
      no_activity: "No Activity",
      truck_status: "Garbage Truck Status",
      live: "Live",
      offline: "Offline",
      zone: "Zone",
      very_close: "Very Close!",
      approaching: "Approaching",
      nearby: "Nearby",
      passed: "Passed",
      area: "Area",
      active_in_area: "Active in your area",
      move_map_pin: "Move map to pin location",
      report_issue: "Report Trash Issue",
      photo_issue: "Photo of the Issue",
      take_photo: "Take Photo",
      gallery: "Gallery",
      category: "Category",
      submit_report: "Submit Report",
      cat_illegal: "Illegal Dumping",
      cat_overflow: "Overflowing Bin",
      cat_uncollected: "Uncollected Waste",
      cat_hazardous: "Hazardous Waste",
      cat_other: "Other",
      
      // Tarsi
      tarsi_bin_ready: "🌟 Great job! Your bin is ready. You and {{count}} other neighbors on your street are all set for collection. I'll keep a sharp eye on the truck for you!",
      tarsi_urgent: "🚨 URGENT: The collection truck is literally right there! Get your bins out to the curb immediately if you haven't already!",
      tarsi_approaching: "🚚 Heads up! A truck is about {{dist}}m away (approx. {{mins}} mins). It's the perfect time to double-check your waste sorting!",
      tarsi_active: "✨ Good news! There are {{count}} trucks active in the city right now. Stay tuned, I'll let you know the moment one enters your zone.",
      tarsi_scheduled: "📅 Don't forget! You have a collection scheduled for today on the \"{{route}}\" route. Make sure your bins are ready by 7:30 AM!",
      tarsi_morning: "☕ Good morning! No collection trucks are out yet. Did you know that rinsing your plastic containers helps the recycling process? Try it today!",
      tarsi_evening: "🌙 Collection for today has likely ended. Make sure to check your schedule for tomorrow and keep our streets clean!",
      tarsi_idle: "🌱 Everything looks quiet on the trash front. Remember: reducing waste starts with better sorting. Have a great day!",
      
      // Checklist
      checklist_title: "Pre-Collection Checklist",
      checklist_subtitle: "Complete these to ensure your waste is collected properly.",
      checklist_item1: "Sort general waste into black bag",
      checklist_item2: "Sort recyclables (plastic, paper, cans)",
      checklist_item3: "Rinse food containers before placing",
      checklist_item4: "Tie all bags securely",
      checklist_item5: "Place bin at curb by 7:30 AM",
      confirm_ready: "Confirm I'm Ready",
      items_left: "{{count}} items left",
      all_set: "All items checked!",

      // Profile
      profile: "My Profile",
      notifications: "Notifications",
      segregation_guide: "Segregation Guide",
      edit_profile: "Edit Profile",
      language: "Language",
      total_reports: "Total Reports",
      resolved: "Resolved",
      pending: "Pending",
      community_impact: "Community Impact",
      impact_message_active: "{{count}} issue resolved in your area. Keep it up!",
      impact_message_plural: "{{count}} issues resolved in your area. Keep it up!",
      impact_message_empty: "Start reporting garbage issues to help keep Cebu clean.",
      
      // Auth
      email: "Email Address",
      password: "Password",
      forgot_password: "Forgot Password?",
      dont_have_account: "Don't have an account?",
      already_have_account: "Already have an account?",
      sign_up: "Sign Up",
      sign_in: "Sign In",
      full_name: "Full Name",
      phone: "Phone Number",
      barangay: "Barangay",
      create_account: "Create Account",
    }
  },
  ceb: {
    translation: {
      // Common
      welcome: "Maayong pag-abot sa G-TRASH",
      login: "Sulod",
      register: "Rehistro",
      logout: "Gawas",
      cancel: "I-kanselar",
      success: "Nagmalampuson",
      error: "Sipyat",
      save: "I-save",
      search: "Pangitaa",
      loading: "Nagkarga...",
      see_all: "Tan-awa Tanan",

      // Home
      good_morning: "Maayong Buntag",
      good_afternoon: "Maayong Hapon",
      good_evening: "Maayong Gabii",
      trucks_active_one: "{{count}} ka trak ang aktibo sa imong lugar.",
      trucks_active_other: "{{count}} ka mga trak ang aktibo sa imong lugar.",
      no_trucks_active: "Wala'y mga trak nga aktibo sa pagkakaron.",
      air_quality: "Kalidad sa Hangin",
      upcoming_collection: "Umaabot nga Koleksyon",
      prepare_bin: "Andama ang Akong Basurahan",
      track_live: "I-track ang Pag-abot",
      no_activity: "Walay Kalihokan",
      truck_status: "Status sa Trak sa Basura",
      live: "Live",
      offline: "Offline",
      zone: "Sona",
      very_close: "Duol Na Kaayo!",
      approaching: "Paduol Na",
      nearby: "Duol Ra",
      passed: "Niagi Na",
      area: "Lugar",
      active_in_area: "Aktibo sa imong lugar",
      move_map_pin: "Ibalhin ang mapa sa pin nga lokasyon",
      report_issue: "Pag-report sa Problema sa Basura",
      photo_issue: "Litrato sa Problema",
      take_photo: "Pagkuha og Litrato",
      gallery: "Galerya",
      category: "Kategorya",
      submit_report: "I-submit ang Report",
      cat_illegal: "Iligal nga Paglabay",
      cat_overflow: "Nag-awas nga Basurahan",
      cat_uncollected: "Wala nakuha nga Basura",
      cat_hazardous: "Delikado nga Basura",
      cat_other: "Uban pa",

      // Tarsi
      tarsi_bin_ready: "🌟 Maayong trabaho! Andam na ang imong basurahan. Ikaw ug ang {{count}} pa nimo ka mga silingan andam na para sa koleksyon. Bantayan nako ang trak para nimo!",
      tarsi_urgent: "🚨 IMPORTANTE: Ang trak sa basura naa na gyud diha! Ipagawas dayon ang inyong mga basurahan sa daplin sa dalan!",
      tarsi_approaching: "🚚 Heads up! Ang trak mga {{dist}}m na lang ang kalay-on (mga {{mins}} ka minuto). Maayo kini nga panahon sa pagsusi pag-ayo sa inyong pagbahin sa basura!",
      tarsi_active: "✨ Maayong balita! Adunay {{count}} ka mga trak nga aktibo sa siyudad karon. Magpabilin nga tuned, ipahibalo nako kanimo kung mosulod na kini sa imong sona.",
      tarsi_scheduled: "📅 Ayaw kalimot! Adunay ka koleksyon nga gieskedyul karon sa rota nga \"{{route}}\". Siguroha nga andam na ang imong mga basurahan sa alas 7:30 sa buntag!",
      tarsi_morning: "☕ Maayong buntag! Wala pa'y mga trak sa koleksyon nga nanggawas. Nahibal-an ba nimo nga ang paghugas sa imong mga plastik nga sudlanan makatabang sa proseso sa pag-recycle? Sulayi kini karon!",
      tarsi_evening: "🌙 Ang koleksyon para karon lagmit nahuman na. Siguroha nga susihon ang imong eskedyul para ugma ug huptan nga limpyo ang atong mga dalan!",
      tarsi_idle: "🌱 Morag hilom ang tanan sa basura. Hinumdomi: ang pagpakunhod sa basura magsugod sa mas maayong pagbahin-bahin. Maayong adlaw!",

      // Checklist
      checklist_title: "Checklist sa dili pa Kolektahon",
      checklist_subtitle: "Kompletoha kini aron masiguro nga ang imong basura makolekta sa hustong paagi.",
      checklist_item1: "Ibulag ang kinatibuk-ang basura sa itom nga plastik",
      checklist_item2: "Ibulag ang mga ma-recycle (plastik, papel, lata)",
      checklist_item3: "Hugasi ang mga sudlanan sa pagkaon sa dili pa ibutang",
      checklist_item4: "Ihigot og maayo ang tanang plastik",
      checklist_item5: "Ibutang ang basurahan sa daplin sa dalan sa dili pa ang 7:30 AM",
      confirm_ready: "Kumpirmaha nga Andam Na Ko",
      items_left: "{{count}} ka butang ang nahabilin",
      all_set: "Nahuman na tanan!",

      // Profile
      profile: "Akong Profile",
      notifications: "Pahibalo",
      segregation_guide: "Giya sa Pagbahin",
      edit_profile: "Usba ang Profile",
      language: "Pinulongan",
      total_reports: "Tanan nga Report",
      resolved: "Nasulbad",
      pending: "Nagpaabut",
      community_impact: "Epekto sa Komunidad",
      impact_message_active: "{{count}} ka problema ang nasulbad sa imong lugar. Padayon!",
      impact_message_plural: "{{count}} ka mga problema ang nasulbad sa imong lugar. Padayon!",
      impact_message_empty: "Sugdi ang pag-report sa mga problema sa basura aron makatabang sa paglimpyo sa Sugbo.",

      // Auth
      email: "Email Address",
      password: "Password",
      forgot_password: "Nakalimot sa Password?",
      dont_have_account: "Wala pa'y akaunt?",
      already_have_account: "Naa na'y akaunt?",
      sign_up: "Pag-rehistro",
      sign_in: "Sulod",
      full_name: "Tibuok Ngalan",
      phone: "Numero sa Telepono",
      barangay: "Barangay",
      create_account: "Paghimo og Akaunt",
    }
  }
};

const LANGUAGE_DETECTOR = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    try {
      const language = await AsyncStorage.getItem('user-language');
      if (language) {
        return callback(language);
      }
      callback('en');
    } catch (error) {
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language) => {
    try {
      await AsyncStorage.setItem('user-language', language);
    } catch (error) {}
  },
};

i18n
  .use(LANGUAGE_DETECTOR)
  .use(initReactI18next)
  .init({
    resources,
    compatibilityJSON: 'v3',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
