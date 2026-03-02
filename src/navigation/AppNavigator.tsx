import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';

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
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { color: '#17181b', fontWeight: '700' },
        headerTintColor: '#17181b',
        contentStyle: { backgroundColor: '#ffffff' },
        headerBackTitleVisible: false
      }}
    >
      <Stack.Screen component={AppTabs} name="Tabs" options={{ headerShown: false }} />
      <Stack.Screen component={AddItemScreen} name="AddItem" options={{ presentation: 'modal', title: 'Add Item', headerBackVisible: false }} />
      <Stack.Screen
        component={AddClosetScreen}
        name="AddCloset"
        options={({ navigation }) => ({
          presentation: 'modal',
          title: 'Create Closet',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable hitSlop={8} onPress={() => navigation.goBack()} style={{ paddingHorizontal: 4, paddingVertical: 2 }}>
              <Ionicons color="#232429" name="close" size={22} />
            </Pressable>
          )
        })}
      />
      <Stack.Screen
        component={ItemDetailScreen}
        name="ItemDetail"
        options={({ navigation }) => ({
          title: 'Item Details',
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable hitSlop={8} onPress={() => navigation.goBack()} style={{ paddingHorizontal: 2, paddingVertical: 2 }}>
              <Ionicons color="#232429" name="chevron-back" size={24} />
            </Pressable>
          )
        })}
      />
      <Stack.Screen
        component={ClosetItemsScreen}
        name="ClosetItems"
        options={({ navigation, route }) => ({
          title: route.params.closetName,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable hitSlop={8} onPress={() => navigation.goBack()} style={{ paddingHorizontal: 2, paddingVertical: 2 }}>
              <Ionicons color="#232429" name="chevron-back" size={24} />
            </Pressable>
          )
        })}
      />
    </Stack.Navigator>
  );
}
