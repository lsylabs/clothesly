import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import * as AuthSession from 'expo-auth-session';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppButton from '../../components/ui/AppButton';
import AppTextInput from '../../components/ui/AppTextInput';
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

      <AppTextInput
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email"
        style={styles.input}
        value={email}
      />
      <AppTextInput
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        value={password}
      />

      <AppButton label="Create account" loading={loading} loadingLabel="Creating..." onPress={handleSignUp} style={styles.button} />

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
    backgroundColor: '#ffffff'
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
    marginBottom: 12
  },
  button: {
    marginTop: 4
  },
  link: {
    marginTop: 18,
    color: '#4f5058',
    textAlign: 'center'
  }
});
