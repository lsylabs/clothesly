import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppButton from '../../components/ui/AppButton';
import AppTextInput from '../../components/ui/AppTextInput';
import { hasSupabaseEnv } from '../../config/env';
import { supabase } from '../../services/supabase';
import type { AuthStackParamList } from '../../types/navigation';

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSignUp = async () => {
    if (!fullName.trim() || !email || !password || !confirmPassword) {
      Alert.alert('Missing details', 'Please complete full name, email, and both password fields.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Password and confirm password must match.');
      return;
    }

    const emailRedirectTo = AuthSession.makeRedirectUri({
      scheme: 'clothesly',
      path: 'auth/callback'
    });

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: fullName.trim()
        }
      }
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }

    Alert.alert('Account created', 'Check your email for a confirmation link if required.');
    navigation.navigate('SignIn');
  };

  const handleGoogleSignUp = async () => {
    if (!hasSupabaseEnv) {
      Alert.alert('Missing env', 'Set Supabase env vars before using OAuth.');
      return;
    }

    const redirectTo = AuthSession.makeRedirectUri({ scheme: 'clothesly' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true
      }
    });

    if (error) {
      Alert.alert('Google sign up failed', error.message);
      return;
    }

    if (!data?.url) {
      Alert.alert('Google sign up failed', 'No OAuth URL was returned.');
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      const codeMatch = result.url.match(/[?&]code=([^&]+)/);
      const authCode = codeMatch?.[1] ? decodeURIComponent(codeMatch[1]) : null;

      if (!authCode) {
        Alert.alert('Google sign up failed', 'No auth code returned from Google.');
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
      if (exchangeError) {
        Alert.alert('Google sign up failed', exchangeError.message);
      }
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <Pressable onPress={() => navigation.navigate('SignIn')} style={styles.backRow}>
        <Ionicons color="#0A0A0A" name="arrow-back" size={24} />
        <Text style={styles.backText}>Back to sign in</Text>
      </Pressable>
      <View style={styles.header}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Start your fashion journey</Text>
      </View>

      <View style={styles.field}>
        <Ionicons color="#0A0A0A" name="person-outline" size={20} />
        <AppTextInput onChangeText={setFullName} placeholder="Full Name" style={styles.input} value={fullName} />
      </View>
      <View style={styles.field}>
        <Ionicons color="#0A0A0A" name="mail-outline" size={20} />
        <AppTextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          style={styles.input}
          value={email}
        />
      </View>
      <View style={styles.field}>
        <Ionicons color="#0A0A0A" name="lock-closed-outline" size={20} />
        <AppTextInput
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry={!showPassword}
          style={styles.input}
          value={password}
        />
        <Pressable hitSlop={8} onPress={() => setShowPassword((current) => !current)}>
          <Ionicons color="#0A0A0A" name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} />
        </Pressable>
      </View>
      <View style={styles.field}>
        <Ionicons color="#0A0A0A" name="lock-closed-outline" size={20} />
        <AppTextInput
          onChangeText={setConfirmPassword}
          placeholder="Confirm Password"
          secureTextEntry={!showConfirmPassword}
          style={styles.input}
          value={confirmPassword}
        />
        <Pressable hitSlop={8} onPress={() => setShowConfirmPassword((current) => !current)}>
          <Ionicons color="#0A0A0A" name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={22} />
        </Pressable>
      </View>

      <AppButton label="Create account" loading={loading} loadingLabel="Creating..." onPress={handleSignUp} style={styles.button} />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR SIGN UP WITH</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable onPress={handleGoogleSignUp} style={styles.googleButton}>
        <Image source={{ uri: 'https://www.google.com/favicon.ico' }} style={styles.googleIcon} />
        <Text style={styles.googleButtonText}>Continue with Google</Text>
      </Pressable>

      <Text style={styles.disclaimer}>- by creating an account, you agree to our terms of service and privacy policy</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
    backgroundColor: '#FAFAFA'
  },
  backRow: {
    marginTop: 22,
    marginBottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  backText: {
    color: '#0A0A0A',
    fontSize: 18,
    fontWeight: '500'
  },
  header: {
    marginBottom: 32
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: '#0A0A0A',
    letterSpacing: -1,
    marginBottom: 10,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 18,
    color: '#0A0A0A',
    textAlign: 'center'
  },
  field: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 14,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  input: {
    flex: 1,
    marginLeft: 10,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingVertical: 0
  },
  button: {
    marginTop: 8,
    borderRadius: 18
  },
  dividerRow: {
    marginTop: 20,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0'
  },
  dividerText: {
    color: '#0A0A0A',
    fontSize: 14,
    letterSpacing: 1.4,
    fontWeight: '500'
  },
  googleButton: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FAFAFA'
  },
  googleIcon: {
    width: 20,
    height: 20
  },
  googleButtonText: {
    color: '#0A0A0A',
    fontSize: 18,
    fontWeight: '600'
  },
  disclaimer: {
    marginTop: 18,
    color: '#0A0A0A',
    fontSize: 14,
    lineHeight: 20
  }
});
