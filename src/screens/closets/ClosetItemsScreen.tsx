import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import ItemCollectionView from '../../components/ItemCollectionView';
import { useAuth } from '../../services/AuthContext';
import { getCachedSignedImageUrl, getCachedSignedImageUrlSync } from '../../services/imageCacheService';
import { fetchWardrobeData, getWardrobeDataCache } from '../../services/wardrobeDataService';
import type { Database } from '../../types/database';
import type { AppStackParamList } from '../../types/navigation';

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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl onRefresh={async () => {
        setRefreshing(true);
        await loadData({ blocking: false });
        setRefreshing(false);
      }} refreshing={refreshing} tintColor="#17181b" />}
    >
      {loading && !hasLoadedOnce ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#17181b" />
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
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16
  },
  syncingText: {
    color: '#6a6a72',
    fontWeight: '500'
  },
  errorText: {
    color: '#a04f4f',
    fontWeight: '600'
  }
});
