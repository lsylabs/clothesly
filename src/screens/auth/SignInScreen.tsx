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

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing details', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Sign in failed', error.message);
    }
  };

  const handleGoogleSignIn = async () => {
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
      Alert.alert('Google sign in failed', error.message);
      return;
    }

    if (!data?.url) {
      Alert.alert('Google sign in failed', 'No OAuth URL was returned.');
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      const codeMatch = result.url.match(/[?&]code=([^&]+)/);
      const authCode = codeMatch?.[1] ? decodeURIComponent(codeMatch[1]) : null;

      if (!authCode) {
        Alert.alert('Google sign in failed', 'No auth code returned from Google.');
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
      if (exchangeError) {
        Alert.alert('Google sign in failed', exchangeError.message);
      }
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Clothesly</Text>
        <Text style={styles.subtitle}>Sign in to your wardrobe</Text>
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

      <Pressable onPress={() => Alert.alert('Forgot password', 'Hook this to Supabase resetPasswordForEmail flow.')}>
        <Text style={styles.forgot}>Forgot password?</Text>
      </Pressable>

      <AppButton label="Sign In" loading={loading} loadingLabel="Signing in..." onPress={handleSignIn} style={styles.button} />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable onPress={handleGoogleSignIn} style={styles.googleButton}>
        <Image source={{ uri: 'https://www.google.com/favicon.ico' }} style={styles.googleIcon} />
        <Text style={styles.googleButtonText}>Continue with Google</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('SignUp')}>
        <Text style={styles.link}>
          <Text style={styles.linkMuted}>New here? </Text>
          <Text style={styles.linkStrong}>Create an account</Text>
        </Text>
      </Pressable>
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
  header: {
    marginTop: 72,
    marginBottom: 36
  },
  title: {
    fontSize: 50,
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
  forgot: {
    marginTop: 4,
    marginBottom: 18,
    alignSelf: 'flex-end',
    color: '#0A0A0A',
    fontSize: 16
  },
  button: {
    marginTop: 4,
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
    fontSize: 13,
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
    fontSize: 17,
    fontWeight: '600'
  },
  link: {
    marginTop: 26,
    textAlign: 'center'
  },
  linkMuted: {
    color: '#0A0A0A',
    fontSize: 17
  },
  linkStrong: {
    color: '#0A0A0A',
    fontSize: 17,
    fontWeight: '700'
  }
});
