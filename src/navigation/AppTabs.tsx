import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddActionSheet from '../components/AddActionSheet';
import { withScreenFadeTransition } from '../components/ui/ScreenFadeTransition';
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
const HomeWithTransition = withScreenFadeTransition(HomeScreen);
const WardrobeWithTransition = withScreenFadeTransition(WardrobeScreen);
const OutfitsWithTransition = withScreenFadeTransition(OutfitsScreen);
const ProfileWithTransition = withScreenFadeTransition(ProfileScreen);

function CenterAddButton({
  isOpen,
  onPress,
  bottomInset
}: {
  isOpen: boolean;
  onPress: () => void;
  bottomInset: number;
}) {
  const rotationProgress = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotationProgress, {
      toValue: isOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [isOpen, rotationProgress]);

  const rotate = rotationProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg']
  });

  return (
    <Pressable onPress={onPress} style={[styles.centerButton, { marginBottom: bottomInset > 0 ? bottomInset + 2 : 14 }]}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons color="#FAFAFA" name="add-outline" size={24} />
      </Animated.View>
    </Pressable>
  );
}

export default function AppTabs() {
  const [isSheetVisible, setSheetVisible] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();

  const toggleSheet = () => {
    setSheetVisible((currentValue) => !currentValue);
  };

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
        <Tab.Screen component={HomeWithTransition} name="Home" />
        <Tab.Screen component={WardrobeWithTransition} name="Wardrobe" />
        <Tab.Screen
          component={View}
          listeners={{
            tabPress: (event) => {
              event.preventDefault();
              toggleSheet();
            }
          }}
          name="Add"
          options={{
            tabBarLabel: '',
            tabBarIcon: () => null,
            tabBarButton: () => (
              <CenterAddButton bottomInset={insets.bottom} isOpen={isSheetVisible} onPress={toggleSheet} />
            )
          }}
        />
        <Tab.Screen component={OutfitsWithTransition} name="Outfits" />
        <Tab.Screen component={ProfileWithTransition} name="Profile" />
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
