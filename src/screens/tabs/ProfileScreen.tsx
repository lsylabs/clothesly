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
    backgroundColor: '#f5f1e8',
    padding: 20,
    justifyContent: 'center'
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222'
  },
  body: {
    marginTop: 10,
    color: '#444',
    fontSize: 15,
    lineHeight: 22
  },
  warning: {
    marginTop: 10,
    color: '#7f2a2a'
  },
  signOut: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#1f4d3d'
  },
  signOutText: {
    color: '#fff',
    fontWeight: '600'
  }
});
