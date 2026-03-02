import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import * as AuthSession from 'expo-auth-session';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../services/supabase';
import type { AuthStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Missing details', 'Please enter both email and password.');
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
        emailRedirectTo
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

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>Start building your digital wardrobe</Text>

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

      <Pressable onPress={handleSignUp} style={[styles.button, loading && styles.disabled]}>
        <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create account'}</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('SignIn')}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    backgroundColor: '#f5f1e8'
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1d1d1d',
    marginBottom: 6
  },
  subtitle: {
    fontSize: 16,
    color: '#3e3e3e',
    marginBottom: 24
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d6d0c5'
  },
  button: {
    backgroundColor: '#1f4d3d',
    borderRadius: 10,
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
  link: {
    marginTop: 18,
    color: '#3f6659',
    textAlign: 'center'
  }
});
