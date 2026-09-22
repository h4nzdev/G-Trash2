import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import colors, { softShadow } from '../constants/colors';

export default function LoginScreen() {
  const [truckCode, setTruckCode] = useState('');
  const { login, isLoading } = useAuth();

  const handleLogin = async () => {
    const cleanCode = truckCode.trim().replace(/^GT-?/i, '').toUpperCase();
    if (!cleanCode) {
      Alert.alert('Required', 'Please enter your Truck Code.');
      return;
    }
    const fullTruckId = `GT-${cleanCode}`;
    try {
      await login(fullTruckId);
    } catch (error) {
      Alert.alert('Access Denied', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          {/* Logo/Brand Section */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>Collector Portal</Text>
          </View>

          {/* Form Section */}
          <View style={styles.form}>
            <Text style={styles.welcomeText}>Collector Login</Text>
            <Text style={styles.instructionText}>Enter the Truck code provided by your supervisor</Text>

            <View style={styles.inputContainer}>
              <MaterialIcons name="badge" size={20} color="#6B7280" style={styles.inputIcon} />
              <Text style={styles.prefixText}>GT-</Text>
              <TextInput
                style={styles.input}
                placeholder="QSO"
                placeholderTextColor="#9CA3AF"
                value={truckCode}
                onChangeText={(val) => {
                  const cleaned = val.replace(/^GT-?/i, '').toUpperCase();
                  setTruckCode(cleaned);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.loginButton, (isLoading || !truckCode.trim()) && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading || !truckCode.trim()}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>Start Shift</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Contact your barangay official if you don't have an ID</Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primaryGreen,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  logo: {
    width: 240,
    height: 120,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#CCE1D8',
    marginTop: 4,
  },
  form: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 60,
    flex: 1,
    ...softShadow,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: 2,
    letterSpacing: 0.5,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  eyeIcon: {
    padding: 8,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 32,
  },
  forgotPasswordText: {
    color: colors.primaryGreen,
    fontWeight: '600',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: colors.primaryGreen,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...softShadow,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontStyle: 'italic',
  },
});
