import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { NavigationContainer } from '@react-navigation/native';

import { useAuth } from '../services/AuthContext';
import AppNavigator from './AppNavigator';
import AuthNavigator from './AuthNavigator';

export default function RootNavigator() {
  const { loading, session, hasEnv } = useAuth();

  if (!hasEnv) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Missing Supabase Environment</Text>
        <Text style={styles.body}>Create a `.env` file from `.env.example` and restart Expo.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1f4d3d" size="large" />
      </View>
    );
  }

  return <NavigationContainer>{session ? <AppNavigator /> : <AuthNavigator />}</NavigationContainer>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f1e8',
    paddingHorizontal: 24
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121'
  },
  body: {
    marginTop: 10,
    color: '#404040',
    textAlign: 'center',
    lineHeight: 20
  }
});
