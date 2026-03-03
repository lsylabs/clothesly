import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AddClosetScreen from '../screens/add/AddClosetScreen';
import AddItemScreen from '../screens/add/AddItemScreen';
import ClosetItemsScreen from '../screens/closets/ClosetItemsScreen';
import ItemDetailScreen from '../screens/items/ItemDetailScreen';
import type { AppStackParamList } from '../types/navigation';
import AppTabs from './AppTabs';

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#FAFAFA' },
        headerTitleStyle: { color: '#0A0A0A', fontWeight: '700', fontSize: 18 },
        headerTintColor: '#0A0A0A',
        contentStyle: { backgroundColor: '#FAFAFA' },
        headerBackTitleVisible: false,
        headerShadowVisible: false,
        animation: 'fade_from_bottom',
        animationDuration: 170
      }}
    >
      <Stack.Screen component={AppTabs} name="Tabs" options={{ headerShown: false }} />
      <Stack.Screen
        component={AddItemScreen}
        name="AddItem"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          animationDuration: 220,
          headerShown: false
        }}
      />
      <Stack.Screen
        component={AddClosetScreen}
        name="AddCloset"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          animationDuration: 220,
          headerShown: false
        }}
      />
      <Stack.Screen
        component={ItemDetailScreen}
        name="ItemDetail"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 220
        }}
      />
      <Stack.Screen
        component={ClosetItemsScreen}
        name="ClosetItems"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 220
        }}
      />
    </Stack.Navigator>
  );
}
