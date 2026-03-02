import { Alert, StyleSheet, Text, View } from 'react-native';

import AppButton from '../../components/ui/AppButton';
import InfoCard from '../../components/ui/InfoCard';
import PageTitle from '../../components/ui/PageTitle';
import { hasSupabaseEnv } from '../../config/env';
import { useAuth } from '../../services/AuthContext';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <PageTitle title="Profile" />
      <InfoCard style={styles.body}>
        <Text style={styles.bodyText}>Signed in as: {session?.user?.email ?? 'Unknown user'}</Text>
      </InfoCard>
      {!hasSupabaseEnv ? <Text style={styles.warning}>Supabase env vars are missing. Set `.env` first.</Text> : null}
      <AppButton
        label="Sign Out"
        onPress={async () => {
          const { error } = await signOut().then(() => ({ error: null })).catch((e: Error) => ({ error: e }));
          if (error) {
            Alert.alert('Sign out failed', error.message);
          }
        }}
        style={styles.signOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20
  },
  body: {
    marginTop: 14
  },
  bodyText: {
    color: '#45464c',
    fontSize: 16,
    lineHeight: 24
  },
  warning: {
    marginTop: 10,
    color: '#9e4c4c'
  },
  signOut: {
    marginTop: 16
  }
});
