import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddActionSheet from '../components/AddActionSheet';
import HomeScreen from '../screens/tabs/HomeScreen';
import OutfitsScreen from '../screens/tabs/OutfitsScreen';
import ProfileScreen from '../screens/tabs/ProfileScreen';
import WardrobeScreen from '../screens/tabs/WardrobeScreen';
import type { AppStackParamList, AppTabsParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<AppTabsParamList>();
const TAB_ICON_BY_ROUTE = {
  Home: 'home-outline',
  Wardrobe: 'shirt-outline',
  Outfits: 'sparkles-outline',
  Profile: 'person-outline'
} as const;

function CenterAddButton({ onPress, bottomInset }: { onPress: () => void; bottomInset: number }) {
  return (
    <Pressable onPress={onPress} style={[styles.centerButton, { marginBottom: bottomInset > 0 ? bottomInset + 2 : 14 }]}>
      <Ionicons color="#FAFAFA" name="add-outline" size={24} />
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
          paddingTop: insets.top,
          backgroundColor: '#FAFAFA'
        }}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#0A0A0A',
          tabBarInactiveTintColor: '#E0E0E0',
          tabBarIcon: ({ color, size }) => {
            if (route.name === 'Add') return null;
            const iconName = TAB_ICON_BY_ROUTE[route.name as keyof typeof TAB_ICON_BY_ROUTE] ?? 'ellipse-outline';
            return <Ionicons color={color} name={iconName} size={size} />;
          },
          tabBarLabelStyle: {
            fontSize: 14,
            fontWeight: '600',
            marginTop: -2
          },
          tabBarStyle: {
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: Math.max(insets.bottom, 8),
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: '#E8E8E8',
            borderRadius: 32,
            height: 72,
            paddingBottom: 9,
            paddingTop: 9,
            backgroundColor: '#FAFAFA',
            shadowColor: '#0A0A0A',
            shadowOffset: { width: 0, height: 18 },
            shadowOpacity: 0.18,
            shadowRadius: 28,
            elevation: 18
          }
        })}
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
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3
  }
});
