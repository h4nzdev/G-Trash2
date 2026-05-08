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
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import colors from '../constants/colors';

import API_URL from '../config';
const BACKEND_URL = API_URL;

const BARANGAYS = ['Lahug', 'Apas', 'Mabolo', 'IT Park', 'Ayala', 'Banilad', 'Talamban', 'Ermita', 'Sto. Niño', 'Carbon Market', 'Colon'];

// Placeholder for Map (since react-native-maps might not be installed yet)
const MapPlaceholder = ({ location, onSelectLocation }) => (
  <View style={styles.mapPlaceholder}>
    <MaterialIcons name="map" size={40} color="#9CA3AF" />
    <Text style={styles.mapPlaceholderText}>
      {location ? `Location pinned ✓` : 'Tap to pin your current location'}
    </Text>
    <TouchableOpacity
      style={styles.selectLocationBtn}
      onPress={onSelectLocation}
    >
      <Text style={styles.selectLocationBtnText}>{location ? 'Re-pin Location' : 'Pin Location'}</Text>
    </TouchableOpacity>
  </View>
);

export default function ReportIssueScreen({ navigation }) {
  const [image, setImage] = useState(null);
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [barangay, setBarangay] = useState('Lahug');
  const [category, setCategory] = useState('Illegal Dumping');
  const [location, setLocation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    'Illegal Dumping',
    'Overflowing Bin',
    'Uncollected Waste',
    'Hazardous Waste',
    'Other'
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
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
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
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSelectLocation = () => {
    // Uses a fixed Cebu centre; swap for real GPS via expo-location if needed
    setLocation({ latitude: 10.3157, longitude: 123.8854 });
    Alert.alert('Location Pinned', 'Your location has been set.');
  };

  const handleSubmit = () => {
    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please describe the issue.');
      return;
    }
    if (!locationText.trim() && !barangay) {
      Alert.alert('Missing Location', 'Please enter a location or street address.');
      return;
    }

    setIsSubmitting(true);

    const payload = JSON.stringify({
      category,
      description: description.trim(),
      location: locationText.trim(),
      barangay,
      lat: location?.latitude,
      lng: location?.longitude,
      reportedBy: 'Resident',
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BACKEND_URL}/api/reports`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 8000;

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
          <Text style={styles.headerTitle}>Report Trash Issue</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Photo Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photo of the Issue</Text>
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
                  <Text style={styles.photoBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
                  <MaterialIcons name="photo-library" size={32} color={colors.primaryGreen} />
                  <Text style={styles.photoBtnText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Details Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
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
            <Text style={styles.sectionTitle}>Barangay</Text>
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
            <Text style={styles.sectionTitle}>Pin Location (Optional)</Text>
            <MapPlaceholder location={location} onSelectLocation={handleSelectLocation} />
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
                <Text style={styles.submitBtnText}>Submit Report</Text>
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
  mapPlaceholder: {
    height: 180,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mapPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  selectLocationBtn: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryGreen,
  },
  selectLocationBtnText: {
    color: colors.primaryGreen,
    fontWeight: '600',
    fontSize: 14,
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
