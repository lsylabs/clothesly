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
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { color: '#17181b', fontWeight: '700' },
        headerTintColor: '#17181b',
        contentStyle: { backgroundColor: '#ffffff' }
      }}
    >
      <Stack.Screen component={AppTabs} name="Tabs" options={{ headerShown: false }} />
      <Stack.Screen component={AddItemScreen} name="AddItem" options={{ presentation: 'modal', title: 'Add Item' }} />
      <Stack.Screen component={AddClosetScreen} name="AddCloset" options={{ presentation: 'modal', title: 'Create Closet' }} />
      <Stack.Screen component={ItemDetailScreen} name="ItemDetail" options={{ title: 'Item Details' }} />
      <Stack.Screen component={ClosetItemsScreen} name="ClosetItems" options={({ route }) => ({ title: route.params.closetName })} />
    </Stack.Navigator>
  );
}
