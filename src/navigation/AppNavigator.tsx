import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AddClosetScreen from '../screens/add/AddClosetScreen';
import AddItemScreen from '../screens/add/AddItemScreen';
import ItemDetailScreen from '../screens/items/ItemDetailScreen';
import type { AppStackParamList } from '../types/navigation';
import AppTabs from './AppTabs';

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen component={AppTabs} name="Tabs" options={{ headerShown: false }} />
      <Stack.Screen component={AddItemScreen} name="AddItem" options={{ presentation: 'modal', title: 'Add Item' }} />
      <Stack.Screen component={AddClosetScreen} name="AddCloset" options={{ presentation: 'modal', title: 'Create Closet' }} />
      <Stack.Screen component={ItemDetailScreen} name="ItemDetail" options={{ title: 'Item Details' }} />
    </Stack.Navigator>
  );
}
