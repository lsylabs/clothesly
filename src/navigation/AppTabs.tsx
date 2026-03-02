import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddActionSheet from '../components/AddActionSheet';
import HomeScreen from '../screens/tabs/HomeScreen';
import OutfitsScreen from '../screens/tabs/OutfitsScreen';
import ProfileScreen from '../screens/tabs/ProfileScreen';
import WardrobeScreen from '../screens/tabs/WardrobeScreen';
import type { AppStackParamList, AppTabsParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<AppTabsParamList>();

function CenterAddButton({ onPress, bottomInset }: { onPress: () => void; bottomInset: number }) {
  return (
    <Pressable onPress={onPress} style={[styles.centerButton, { marginBottom: bottomInset > 0 ? bottomInset + 4 : 18 }]}>
      <Text style={styles.centerButtonText}>+</Text>
    </Pressable>
  );
}

export default function AppTabs() {
  const [isSheetVisible, setSheetVisible] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tab.Navigator
        sceneContainerStyle={{
          paddingTop: insets.top
        }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#1f4d3d',
          tabBarInactiveTintColor: '#8a867f',
          tabBarStyle: {
            height: 56 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 8,
            backgroundColor: '#fffdf7'
          }
        }}
      >
        <Tab.Screen component={HomeScreen} name="Home" />
        <Tab.Screen component={WardrobeScreen} name="Wardrobe" />
        <Tab.Screen
          component={View}
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
              setSheetVisible(true);
            }
          }}
          name="Add"
          options={{
            tabBarLabel: '',
            tabBarIcon: () => null,
            tabBarButton: () => <CenterAddButton bottomInset={insets.bottom} onPress={() => setSheetVisible(true)} />
          }}
        />
        <Tab.Screen component={OutfitsScreen} name="Outfits" />
        <Tab.Screen component={ProfileScreen} name="Profile" />
      </Tab.Navigator>
      <AddActionSheet
        onAddItem={() => {
          setSheetVisible(false);
          navigation.navigate('AddItem');
        }}
        onClose={() => setSheetVisible(false)}
        onCreateCloset={() => {
          setSheetVisible(false);
          navigation.navigate('AddCloset');
        }}
        visible={isSheetVisible}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1f4d3d',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4
  },
  centerButtonText: {
    fontSize: 26,
    lineHeight: 28,
    color: '#ffffff',
    fontWeight: '700'
  }
});
