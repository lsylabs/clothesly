import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ItemCollectionView from '../../components/ItemCollectionView';
import { useAuth } from '../../services/AuthContext';
import { deleteCloset } from '../../services/closetService';
import { getCachedSignedImageUrl, getCachedSignedImageUrlSync } from '../../services/imageCacheService';
import { fetchWardrobeData, getWardrobeDataCache, refreshWardrobeData } from '../../services/wardrobeDataService';
import type { Database } from '../../types/database';
import type { AppStackParamList } from '../../types/navigation';
import { withRetry } from '../../utils/retry';

type Props = NativeStackScreenProps<AppStackParamList, 'ClosetItems'>;
type ItemRow = Database['public']['Tables']['clothing_items']['Row'];
type MappingRow = Database['public']['Tables']['clothing_item_closets']['Row'];
const REFRESH_STALE_MS = 30_000;

export default function ClosetItemsScreen({ navigation, route }: Props) {
  const { closetId, closetName } = route.params;
  const { session } = useAuth();
  const userId = session?.user.id;

  const [items, setItems] = useState<ItemRow[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [itemImageUrls, setItemImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const [isActionSheetVisible, setActionSheetVisible] = useState(false);
  const [deletingCloset, setDeletingCloset] = useState(false);
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(22)).current;

  useEffect(() => {
    if (!isActionSheetVisible) return;
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(22);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [backdropOpacity, isActionSheetVisible, sheetTranslateY]);

  const applyData = useCallback((data: { items: ItemRow[]; mappings: MappingRow[]; loadedAt: number }) => {
    setItems(data.items);
    setMappings(data.mappings);
    setLastLoadedAt(data.loadedAt);
    setHasLoadedOnce(true);
  }, []);

  const loadData = useCallback(
    async (options?: { blocking?: boolean }) => {
      const blocking = Boolean(options?.blocking);
      if (blocking) setLoading(true);
      setErrorText(null);
      try {
        if (!userId) {
          setItems([]);
          setMappings([]);
          setHasLoadedOnce(true);
          return;
        }
        const data = await fetchWardrobeData(userId);
        applyData(data);
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        if (blocking) setLoading(false);
      }
    },
    [applyData, userId]
  );

  const hydrateFromCache = useCallback(() => {
    if (!userId) return false;
    const cached = getWardrobeDataCache(userId);
    if (!cached) return false;
    applyData(cached);
    return true;
  }, [applyData, userId]);

  useEffect(() => {
    if (!hasLoadedOnce) {
      hydrateFromCache();
    }
  }, [hasLoadedOnce, hydrateFromCache]);

  useFocusEffect(
    useCallback(() => {
      const hydrated = hydrateFromCache();
      const shouldRefresh = !lastLoadedAt || Date.now() - lastLoadedAt > REFRESH_STALE_MS;
      if (shouldRefresh) {
        void loadData({ blocking: !hasLoadedOnce && !hydrated });
      }
    }, [hasLoadedOnce, hydrateFromCache, lastLoadedAt, loadData])
  );

  const closetItems = useMemo(() => {
    const itemIds = new Set(mappings.filter((entry) => entry.closet_id === closetId).map((entry) => entry.item_id));
    return items.filter((item) => itemIds.has(item.id));
  }, [closetId, items, mappings]);

  useEffect(() => {
    let active = true;

    const loadImageUrls = async () => {
      if (!closetItems.length) {
        if (active) setItemImageUrls({});
        return;
      }

      const immediateFromCache = closetItems.reduce<Record<string, string>>((acc, item) => {
        const cached = getCachedSignedImageUrlSync('items', item.primary_image_path);
        if (cached) acc[item.id] = cached;
        return acc;
      }, {});
      if (active && Object.keys(immediateFromCache).length) {
        setItemImageUrls((current) => ({ ...current, ...immediateFromCache }));
      }

      const entries = await Promise.all(
        closetItems.map(async (item) => {
          try {
            const url = await getCachedSignedImageUrl('items', item.primary_image_path);
            return [item.id, url ?? ''] as const;
          } catch {
            return [item.id, ''] as const;
          }
        })
      );

      if (!active) return;
      setItemImageUrls(
        entries.reduce<Record<string, string>>((acc, [id, url]) => {
          if (url) acc[id] = url;
          return acc;
        }, { ...immediateFromCache })
      );
    };

    void loadImageUrls();
    return () => {
      active = false;
    };
  }, [closetItems]);

  const handleDeleteCloset = useCallback(async () => {
    if (deletingCloset) return;
    setDeletingCloset(true);
    setActionSheetVisible(false);
    try {
      await withRetry(() => deleteCloset(closetId));
      if (userId) {
        await refreshWardrobeData(userId).catch(() => undefined);
      }
      Alert.alert('Closet deleted', 'The closet was deleted.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Delete failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setDeletingCloset(false);
    }
  }, [closetId, deletingCloset, navigation, userId]);

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl onRefresh={async () => {
          setRefreshing(true);
          await loadData({ blocking: false });
          setRefreshing(false);
        }} refreshing={refreshing} tintColor="#0A0A0A" />}
      >
        <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <Pressable hitSlop={8} onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons color="#0A0A0A" name="chevron-back" size={24} />
          </Pressable>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {closetName}
          </Text>
          <Pressable hitSlop={8} onPress={() => setActionSheetVisible(true)} style={styles.headerButton}>
            <Ionicons color="#0A0A0A" name="ellipsis-horizontal" size={22} />
          </Pressable>
        </View>

        {loading && !hasLoadedOnce ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#0A0A0A" />
          </View>
        ) : null}
        {loading && hasLoadedOnce ? <Text style={styles.syncingText}>Syncing items...</Text> : null}
        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <ItemCollectionView
          imageUrls={itemImageUrls}
          items={closetItems}
          onPressAdd={() => navigation.navigate('AddItem')}
          onPressItem={(itemId) => navigation.navigate('ItemDetail', { itemId })}
          title={`${closetName} (${closetItems.length})`}
        />
      </ScrollView>

      <Modal animationType="none" transparent visible={isActionSheetVisible}>
        <Animated.View style={[styles.sheetBackdrop, { opacity: backdropOpacity }]}>
          <Pressable onPress={() => setActionSheetVisible(false)} style={StyleSheet.absoluteFillObject} />
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom + 12, 34) },
              { transform: [{ translateY: sheetTranslateY }] }
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Closet Actions</Text>
              <Pressable hitSlop={8} onPress={() => setActionSheetVisible(false)} style={styles.sheetCloseButton}>
                <Ionicons color="#0A0A0A" name="close-outline" size={22} />
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                setActionSheetVisible(false);
                Alert.alert('Coming soon', 'Edit Closet settings will be available soon.');
              }}
              style={styles.sheetAction}
            >
              <Ionicons color="#0A0A0A" name="pencil-outline" size={20} />
              <Text style={styles.sheetActionText}>Edit Closet</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setActionSheetVisible(false);
                Alert.alert('Coming soon', 'Custom item ordering will be available soon.');
              }}
              style={styles.sheetAction}
            >
              <Ionicons color="#0A0A0A" name="swap-vertical-outline" size={20} />
              <Text style={styles.sheetActionText}>Edit Item Order</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setActionSheetVisible(false);
                Alert.alert('Coming soon', 'Selection tools will be available soon.');
              }}
              style={styles.sheetAction}
            >
              <Ionicons color="#0A0A0A" name="checkmark-circle-outline" size={20} />
              <Text style={styles.sheetActionText}>Select</Text>
            </Pressable>
            <Pressable
              disabled={deletingCloset}
              onPress={() =>
                Alert.alert(
                  'Delete closet?',
                  'This will remove the closet and detach all items from it.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => void handleDeleteCloset() }
                  ]
                )
              }
              style={[styles.sheetAction, deletingCloset && styles.disabled]}
            >
              <Ionicons color="#DC2626" name="trash-outline" size={20} />
              <Text style={styles.sheetActionDangerText}>{deletingCloset ? 'Deleting...' : 'Delete Closet'}</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAFAFA',
    padding: 16,
    gap: 12
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8
  },
  headerButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
    width: 28
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '700',
    color: '#0A0A0A',
    letterSpacing: -0.7,
    marginHorizontal: 10
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16
  },
  syncingText: {
    color: '#0A0A0A',
    fontWeight: '500'
  },
  errorText: {
    color: '#DC2626',
    fontWeight: '600'
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.38)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: '#FAFAFA',
    paddingTop: 20,
    paddingHorizontal: 18,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 10
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A0A0A'
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  sheetCloseButton: {
    paddingHorizontal: 2,
    paddingVertical: 2
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 2
  },
  sheetActionText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '600'
  },
  sheetActionDangerText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600'
  },
  disabled: {
    opacity: 0.6
  }
});
