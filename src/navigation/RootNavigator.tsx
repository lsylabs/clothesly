import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { DefaultTheme, NavigationContainer } from '@react-navigation/native';

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
        <ActivityIndicator color="#0A0A0A" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: '#FAFAFA'
        }
      }}
    >
      {session ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 24
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0A0A0A'
  },
  body: {
    marginTop: 10,
    color: '#0A0A0A',
    textAlign: 'center',
    lineHeight: 20
  }
});
