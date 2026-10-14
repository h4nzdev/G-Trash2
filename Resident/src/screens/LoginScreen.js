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
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import colors from '../constants/colors';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';

export default function LoginScreen({ navigation }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const { login, verify2FA, isLoading } = useAuth();
  const [twoFactorData, setTwoFactorData] = useState(null);
  const [otpCode, setOtpCode] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('error'), 'Please fill in all fields');
      return;
    }

    try {
      const res = await login(email, password);
      if (res?.requires2FA) {
        setTwoFactorData(res);
      }
    } catch (error) {
      Alert.alert('Login Failed', error.message || 'Please check your credentials and try again.');
    }
  };

  const handleVerify2FA = async () => {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert('Error', 'Please enter a 6-digit code');
      return;
    }
    try {
      await verify2FA(twoFactorData.tempToken, otpCode);
    } catch (error) {
      Alert.alert('Verification Failed', error.message || 'Invalid authenticator code.');
    }
  };

  if (twoFactorData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <Image
            source={{ uri: twoFactorData.qrCode }}
            style={{ width: 220, height: 220, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 28 }}
            resizeMode="contain"
          />

          <TextInput
            value={otpCode}
            onChangeText={(t) => setOtpCode(t.replace(/\D/g, ''))}
            placeholder="000000"
            placeholderTextColor="#9CA3AF"
            maxLength={6}
            keyboardType="number-pad"
            autoFocus
            style={{
              width: '100%',
              textAlign: 'center',
              fontSize: 32,
              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              letterSpacing: 12,
              paddingVertical: 14,
              borderWidth: 2,
              borderColor: otpCode.length === 6 ? colors.primaryGreen : '#D1D5DB',
              borderRadius: 14,
              marginBottom: 20,
              color: '#1B1C1C',
            }}
          />

          <TouchableOpacity
            style={{
              width: '100%',
              backgroundColor: colors.primaryGreen,
              height: 54,
              borderRadius: 16,
              justifyContent: 'center',
              alignItems: 'center',
              opacity: isLoading || otpCode.length !== 6 ? 0.5 : 1,
            }}
            onPress={handleVerify2FA}
            disabled={isLoading || otpCode.length !== 6}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>Verify</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setTwoFactorData(null); setOtpCode(''); }}
            style={{ marginTop: 24 }}
          >
            <Text style={{ color: '#9CA3AF', fontSize: 14, textDecorationLine: 'underline' }}>Back to login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.content}>
              {/* Logo/Brand Section */}
              <View style={styles.header}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              {/* Form Section */}
              <View style={styles.form}>
                <Text style={styles.welcomeText}>{t('welcome')}</Text>
                <Text style={styles.instructionText}>Login to your resident account</Text>

                <View style={styles.inputContainer}>
                  <MaterialIcons name="email" size={20} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t('email')}
                    placeholderTextColor="#9CA3AF"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <MaterialIcons name="lock" size={20} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t('password')}
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.forgotPassword}>
                  <Text style={styles.forgotPasswordText}>{t('forgot_password')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.loginButtonText}>{t('sign_in')}</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>{t('dont_have_account')} </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                    <Text style={styles.signupText}>{t('sign_up')}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.privacyLink}
                  onPress={() => setShowPrivacyModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="shield-checkmark-outline" size={14} color="#6B7280" />
                  <Text style={styles.privacyLinkText}>G-TRASH Privacy Policy</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>

      <PrivacyPolicyModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  logo: {
    width: 220,
    height: 100,
    marginBottom: 4,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 40,
    flex: 1,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1B1C1C',
    marginBottom: 6,
  },
  instructionText: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 54,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1B1C1C',
  },
  eyeIcon: {
    padding: 8,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: colors.primaryGreen,
    fontWeight: '600',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: colors.primaryGreen,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primaryGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#6B7280',
    fontSize: 15,
  },
  signupText: {
    color: colors.primaryGreen,
    fontSize: 15,
    fontWeight: '700',
  },
  privacyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 20,
    paddingVertical: 6,
  },
  privacyLinkText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
