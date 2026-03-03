import '@testing-library/jest-native/extend-expect';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'clothesly://auth/callback')
}));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(async () => ({ type: 'dismiss' }))
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children
  };
});
