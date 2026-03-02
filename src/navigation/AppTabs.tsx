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
    <Pressable onPress={onPress} style={[styles.centerButton, { marginBottom: bottomInset > 0 ? bottomInset + 2 : 14 }]}>
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
          tabBarActiveTintColor: '#17181b',
          tabBarInactiveTintColor: '#88878c',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginTop: -2
          },
          tabBarStyle: {
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: Math.max(insets.bottom, 8),
            borderTopWidth: 0,
            borderRadius: 32,
            height: 72,
            paddingBottom: 9,
            paddingTop: 9,
            backgroundColor: '#ffffff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.08,
            shadowRadius: 18,
            elevation: 10
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#141518',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3
  },
  centerButtonText: {
    fontSize: 24,
    lineHeight: 24,
    color: '#ffffff',
    fontWeight: '500'
  }
});
