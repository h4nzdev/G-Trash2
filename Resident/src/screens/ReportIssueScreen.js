import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import colors from '../constants/colors';

import API_URL from '../config';
const BACKEND_URL = API_URL;

const BARANGAYS = ['Lahug', 'Apas', 'Mabolo', 'IT Park', 'Ayala', 'Banilad', 'Talamban', 'Ermita', 'Sto. Niño', 'Carbon Market', 'Colon'];


const MapPickerHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { height:100%; width:100%; background:#f3f4f6; }
    .center-crosshair {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -100%);
      z-index: 1000; pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="center-crosshair">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#006A3B" stroke="white" stroke-width="2"/>
    </svg>
  </div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([10.3157, 123.8854], 14);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18, attribution: ''
    }).addTo(map);
    
    // Send location whenever map stops moving
    map.on('moveend', function() {
      var center = map.getCenter();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        lat: center.lat,
        lng: center.lng
      }));
    });

    // Initial send
    setTimeout(function() {
      var center = map.getCenter();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        lat: center.lat,
        lng: center.lng
      }));
    }, 500);
  </script>
</body>
</html>
`;

import { useTranslation } from 'react-i18next';

const InteractiveMapPicker = ({ onLocationSelect }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.mapContainer}>
      <WebView
        originWhitelist={['*']}
        source={{ html: MapPickerHTML }}
        style={{ flex: 1 }}
        onMessage={(event) => {
          try {
            const coord = JSON.parse(event.nativeEvent.data);
            onLocationSelect(coord);
          } catch (e) { }
        }}
        scrollEnabled={false}
      />
      <View style={styles.mapOverlay}>
        <Text style={styles.mapOverlayText}>{t('move_map_pin')}</Text>
      </View>
    </View>
  );
};

export default function ReportIssueScreen({ navigation }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [barangay, setBarangay] = useState(user?.barangay || 'Lahug');
  const [category, setCategory] = useState('Illegal Dumping');
  const [location, setLocation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    t('cat_illegal'),
    t('cat_overflow'),
    t('cat_uncollected'),
    t('cat_hazardous'),
    t('cat_other')
  ];

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your gallery to pick an image.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need access to your camera to take a photo.');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSelectLocation = () => {
    // Uses a fixed Cebu centre; swap for real GPS via expo-location if needed
    setLocation({ latitude: 10.3157, longitude: 123.8854 });
    Alert.alert('Location Pinned', 'Your location has been set.');
  };

  const uploadImage = async (base64Data) => {
    const res = await fetch(`${BACKEND_URL}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: base64Data }),
    });
    if (!res.ok) throw new Error('Image upload failed');
    const json = await res.json();
    return json.url;
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please describe the issue.');
      return;
    }
    if (!locationText.trim() && !barangay) {
      Alert.alert('Missing Location', 'Please enter a location or street address.');
      return;
    }

    setIsSubmitting(true);
    try {
      let reportImage = null;
      if (imageBase64) {
        reportImage = await uploadImage(imageBase64);
      }

      const payload = JSON.stringify({
        category,
        description: description.trim(),
        location: locationText.trim(),
        barangay,
        lat: location?.latitude,
        lng: location?.longitude,
        userId: user?.id,
        reportedBy: user?.name || 'Resident',
        reportImage,
      });

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BACKEND_URL}/api/reports`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 30000;

      xhr.onload = () => {
        setIsSubmitting(false);
        if (xhr.status === 201) {
          Alert.alert(
            'Report Submitted ✅',
            'Your report has been sent to the officials and will be reviewed shortly.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          setDescription('');
          setLocationText('');
          setImage(null);
          setImageBase64(null);
          setLocation(null);
        } else {
          Alert.alert('Error', `Server responded with ${xhr.status}`);
        }
      };
      xhr.onerror = () => {
        setIsSubmitting(false);
        Alert.alert('Network Error', `Could not reach the server at ${BACKEND_URL}`);
      };
      xhr.ontimeout = () => {
        setIsSubmitting(false);
        Alert.alert('Timeout', 'The server took too long to respond.');
      };
      xhr.send(payload);
    } catch (err) {
      setIsSubmitting(false);
      Alert.alert('Upload Error', err.message || 'Failed to upload image');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#1B1C1C" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('report_issue')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Photo Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('photo_issue')}</Text>
            {image ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: image }} style={styles.previewImage} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImage(null)}>
                  <MaterialIcons name="cancel" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoOptions}>
                <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                  <MaterialIcons name="photo-camera" size={32} color={colors.primaryGreen} />
                  <Text style={styles.photoBtnText}>{t('take_photo')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
                  <MaterialIcons name="photo-library" size={32} color={colors.primaryGreen} />
                  <Text style={styles.photoBtnText}>{t('gallery')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Details Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('category')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryList}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    category === cat && styles.categoryChipActive
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[
                    styles.categoryText,
                    category === cat && styles.categoryTextActive
                  ]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Barangay Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('barangay')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryList}>
              {BARANGAYS.map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[styles.categoryChip, barangay === b && styles.categoryChipActive]}
                  onPress={() => setBarangay(b)}
                >
                  <Text style={[styles.categoryText, barangay === b && styles.categoryTextActive]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Street / Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Street / Landmark</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="e.g., Carbon Market, near Gate 2"
              value={locationText}
              onChangeText={setLocationText}
              style={{ ...styles.descriptionInput, height: 50 }}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Describe the issue in detail..."
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />
          </View>

          {/* Location Pin (optional GPS) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pin Location</Text>
            <InteractiveMapPicker onLocationSelect={(coords) => setLocation({ latitude: coords.lat, longitude: coords.lng })} />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="send" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>{t('submit_report')}</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FBF9F8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1B1C1C',
  },
  backButton: {
    padding: 8,
  },
  scrollContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1B1C1C',
    marginBottom: 12,
  },
  photoOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  photoBtn: {
    flex: 1,
    height: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  photoBtnText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  categoryList: {
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.primaryGreen,
    borderColor: colors.primaryGreen,
  },
  categoryText: {
    fontSize: 14,
    color: '#6B7280',
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  descriptionInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    height: 120,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 16,
    color: '#1B1C1C',
  },
  mapContainer: {
    height: 250,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mapOverlayText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryGreen,
  },
  submitBtn: {
    backgroundColor: colors.primaryGreen,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 8,
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 16,
  },
});
