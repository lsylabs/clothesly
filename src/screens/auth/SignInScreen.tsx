import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { hasSupabaseEnv } from '../../config/env';
import { supabase } from '../../services/supabase';
import type { AuthStackParamList } from '../../types/navigation';

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
      const tokenHash = result.url.match(/access_token=([^&]+)/)?.[1];
      const refreshToken = result.url.match(/refresh_token=([^&]+)/)?.[1];
      if (tokenHash && refreshToken) {
        await supabase.auth.setSession({
          access_token: decodeURIComponent(tokenHash),
          refresh_token: decodeURIComponent(refreshToken)
        });
      }
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <Text style={styles.title}>Clothesly</Text>
      <Text style={styles.subtitle}>Sign in to your wardrobe</Text>

      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email"
        style={styles.input}
        value={email}
      />
      <TextInput
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        value={password}
      />

      <Pressable onPress={handleSignIn} style={[styles.button, loading && styles.disabled]}>
        <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
      </Pressable>

      <Pressable onPress={handleGoogleSignIn} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Continue with Google</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('SignUp')}>
        <Text style={styles.link}>New here? Create an account</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    backgroundColor: '#ecebed'
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#16171a',
    letterSpacing: -0.8,
    marginBottom: 6
  },
  subtitle: {
    fontSize: 16,
    color: '#55565d',
    marginBottom: 24
  },
  input: {
    backgroundColor: '#f0f0f1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#c8c7cb'
  },
  button: {
    backgroundColor: '#141518',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4
  },
  disabled: {
    opacity: 0.6
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600'
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#c8c7cb',
    backgroundColor: '#f0f0f1',
    marginTop: 12
  },
  secondaryButtonText: {
    color: '#222327',
    fontWeight: '600'
  },
  link: {
    marginTop: 18,
    color: '#4f5058',
    textAlign: 'center'
  }
});
