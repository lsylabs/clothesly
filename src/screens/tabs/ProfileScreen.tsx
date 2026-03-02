import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { hasSupabaseEnv } from '../../config/env';
import { useAuth } from '../../services/AuthContext';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.body}>Signed in as: {session?.user?.email ?? 'Unknown user'}</Text>
      {!hasSupabaseEnv ? <Text style={styles.warning}>Supabase env vars are missing. Set `.env` first.</Text> : null}
      <Pressable
        onPress={async () => {
          const { error } = await signOut().then(() => ({ error: null })).catch((e: Error) => ({ error: e }));
          if (error) {
            Alert.alert('Sign out failed', error.message);
          }
        }}
        style={styles.signOut}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecebed',
    padding: 20
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: '#16171a'
  },
  body: {
    marginTop: 14,
    color: '#45464c',
    fontSize: 16,
    lineHeight: 24,
    borderRadius: 20,
    padding: 18,
    backgroundColor: '#f0f0f1',
    borderWidth: 1,
    borderColor: '#e5e4e7'
  },
  warning: {
    marginTop: 10,
    color: '#9e4c4c'
  },
  signOut: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#141518'
  },
  signOutText: {
    color: '#fff',
    fontWeight: '600'
  }
});
