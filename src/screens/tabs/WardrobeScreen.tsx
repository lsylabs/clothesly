import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../../services/AuthContext';
import { createSignedImageUrl } from '../../services/mediaService';
import { fetchWardrobeData, getWardrobeDataCache } from '../../services/wardrobeDataService';
import type { Database } from '../../types/database';
import type { AppStackParamList } from '../../types/navigation';

type ViewMode = 'closets' | 'all';
type ClosetRow = Database['public']['Tables']['closets']['Row'];
type ItemRow = Database['public']['Tables']['clothing_items']['Row'];
type MappingRow = Database['public']['Tables']['clothing_item_closets']['Row'];
const REFRESH_STALE_MS = 30_000;

export default function WardrobeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [viewMode, setViewMode] = useState<ViewMode>('closets');
  const [loading, setLoading] = useState(false);
  const [closets, setClosets] = useState<ClosetRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [selectedClosetId, setSelectedClosetId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const [itemImageUrls, setItemImageUrls] = useState<Record<string, string>>({});

  const applyWardrobeData = useCallback(
    (data: { closets: ClosetRow[]; items: ItemRow[]; mappings: MappingRow[]; loadedAt: number }) => {
      setClosets(data.closets);
      setItems(data.items);
      setMappings(data.mappings);
      if (data.closets.length && !selectedClosetId) {
        setSelectedClosetId(data.closets[0].id);
      }
      if (!data.closets.length) {
        setSelectedClosetId(null);
      }
      setLastLoadedAt(data.loadedAt);
      setHasLoadedOnce(true);
    },
    [selectedClosetId]
  );

  const loadData = useCallback(async (options?: { blocking?: boolean }) => {
    const blocking = Boolean(options?.blocking);
    if (blocking) setLoading(true);
    setErrorText(null);
    try {
      if (!userId) {
        setClosets([]);
        setItems([]);
        setMappings([]);
        setSelectedClosetId(null);
        setLastLoadedAt(null);
        setHasLoadedOnce(true);
        return;
      }
      const data = await fetchWardrobeData(userId);
      applyWardrobeData(data);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      if (blocking) setLoading(false);
    }
  }, [applyWardrobeData, userId]);

  const hydrateFromCache = useCallback(() => {
    if (!userId) return false;
    const cached = getWardrobeDataCache(userId);
    if (!cached) return false;
    applyWardrobeData(cached);
    return true;
  }, [applyWardrobeData, userId]);

  useEffect(() => {
    if (!hasLoadedOnce) {
      hydrateFromCache();
    }
  }, [hasLoadedOnce, hydrateFromCache]);

  useEffect(() => {
    let active = true;

    const loadImageUrls = async () => {
      if (!items.length) {
        if (active) setItemImageUrls({});
        return;
      }

      const entries = await Promise.all(
        items.map(async (item) => {
          try {
            const url = await createSignedImageUrl('items', item.primary_image_path);
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
        }, {})
      );
    };

    void loadImageUrls();
    return () => {
      active = false;
    };
  }, [items]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData({ blocking: false });
    setRefreshing(false);
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      const hydrated = hydrateFromCache();
      const shouldRefresh = !lastLoadedAt || Date.now() - lastLoadedAt > REFRESH_STALE_MS;
      if (shouldRefresh) {
        void loadData({ blocking: !hasLoadedOnce && !hydrated });
      }
    }, [hasLoadedOnce, hydrateFromCache, lastLoadedAt, loadData])
  );

  const selectedClosetItems = useMemo(() => {
    if (!selectedClosetId) return [];
    const itemIds = new Set(mappings.filter((entry) => entry.closet_id === selectedClosetId).map((entry) => entry.item_id));
    return items.filter((item) => itemIds.has(item.id));
  }, [items, mappings, selectedClosetId]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Wardrobe</Text>

        <View style={styles.segment}>
          <Pressable onPress={() => setViewMode('closets')} style={[styles.segmentButton, viewMode === 'closets' && styles.segmentButtonActive]}>
            <Text style={[styles.segmentText, viewMode === 'closets' && styles.segmentTextActive]}>By Closet</Text>
          </Pressable>
          <Pressable onPress={() => setViewMode('all')} style={[styles.segmentButton, viewMode === 'all' && styles.segmentButtonActive]}>
            <Text style={[styles.segmentText, viewMode === 'all' && styles.segmentTextActive]}>All Items</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={refreshing} tintColor="#17181b" />}
      >
        {loading && !hasLoadedOnce ? (
          <View style={styles.centered}>
            <ActivityIndicator color="#17181b" />
          </View>
        ) : null}
        {loading && hasLoadedOnce ? <Text style={styles.syncingText}>Syncing wardrobe...</Text> : null}

        {errorText ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{errorText}</Text>
            <Pressable onPress={() => void loadData({ blocking: !hasLoadedOnce })} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {viewMode === 'all' ? (
          <>
            <Text style={styles.sectionTitle}>All Items ({items.length})</Text>
            {items.length ? (
              <ItemGrid
                imageUrls={itemImageUrls}
                items={items}
                onPressItem={(itemId) => navigation.navigate('ItemDetail', { itemId })}
                onPressAdd={() => navigation.navigate('AddItem')}
              />
            ) : (
              <ItemGrid imageUrls={itemImageUrls} items={[]} onPressAdd={() => navigation.navigate('AddItem')} onPressItem={() => undefined} />
            )}
          </>
        ) : null}

        {viewMode === 'closets' ? (
          <>
            <Text style={styles.sectionTitle}>Closets ({closets.length})</Text>
            {closets.length ? (
              <>
                <View style={styles.closetGrid}>
                  {closets.map((closet) => {
                    const count = mappings.filter((entry) => entry.closet_id === closet.id).length;
                    const selected = selectedClosetId === closet.id;
                    return (
                      <Pressable
                        key={closet.id}
                        onPress={() => setSelectedClosetId(closet.id)}
                        style={[styles.closetCard, selected && styles.closetCardSelected]}
                      >
                        <Text style={[styles.closetName, selected && styles.closetNameSelected]}>{closet.name}</Text>
                        <Text style={[styles.closetCount, selected && styles.closetNameSelected]}>{count} item(s)</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable onPress={() => navigation.navigate('AddCloset')} style={[styles.closetCard, styles.addTile]}>
                    <Text style={styles.addTileIcon}>+</Text>
                    <Text style={styles.addTileLabel}>Create Closet</Text>
                  </Pressable>
                </View>
                <Text style={styles.sectionTitle}>Items in Selected Closet ({selectedClosetItems.length})</Text>
                {selectedClosetItems.length ? (
                  <ItemGrid
                    imageUrls={itemImageUrls}
                    items={selectedClosetItems}
                    onPressItem={(itemId) => navigation.navigate('ItemDetail', { itemId })}
                    onPressAdd={() => navigation.navigate('AddItem')}
                  />
                ) : (
                  <ItemGrid
                    imageUrls={itemImageUrls}
                    items={[]}
                    onPressAdd={() => navigation.navigate('AddItem')}
                    onPressItem={() => undefined}
                  />
                )}
              </>
            ) : (
              <View style={styles.closetGrid}>
                <Pressable onPress={() => navigation.navigate('AddCloset')} style={[styles.closetCard, styles.addTile]}>
                  <Text style={styles.addTileIcon}>+</Text>
                  <Text style={styles.addTileLabel}>Create Closet</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ItemGrid({
  items,
  imageUrls,
  onPressItem,
  onPressAdd
}: {
  items: ItemRow[];
  imageUrls: Record<string, string>;
  onPressItem: (itemId: string) => void;
  onPressAdd: () => void;
}) {
  return (
    <View style={styles.itemGrid}>
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => onPressItem(item.id)} style={styles.itemTile}>
          {imageUrls[item.id] ? (
            <Image resizeMode="cover" source={{ uri: imageUrls[item.id] }} style={styles.itemImage} />
          ) : (
            <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
              <Text style={styles.itemImagePlaceholderText}>No image</Text>
            </View>
          )}
          <Text numberOfLines={1} style={styles.itemTitle}>
            {item.name}
          </Text>
        </Pressable>
      ))}
      <Pressable onPress={onPressAdd} style={[styles.itemTile, styles.addTile]}>
        <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
          <Text style={styles.addTileIcon}>+</Text>
        </View>
        <Text numberOfLines={1} style={styles.addTileLabel}>
          Add Item
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 12
  },
  container: {
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: '#16171a'
  },
  segment: {
    backgroundColor: '#f7f8fa',
    borderRadius: 20,
    padding: 5,
    flexDirection: 'row'
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 8
  },
  segmentButtonActive: {
    backgroundColor: '#ffffff'
  },
  segmentText: {
    color: '#6a6a71',
    fontWeight: '600'
  },
  segmentTextActive: {
    color: '#18191d'
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
  sectionTitle: {
    marginTop: 8,
    fontSize: 21,
    fontWeight: '700',
    color: '#18191c'
  },
  closetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  closetCard: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6e8ec',
    padding: 14
  },
  closetCardSelected: {
    backgroundColor: '#ffffff',
    borderColor: '#d9dce3'
  },
  closetName: {
    fontWeight: '700',
    color: '#1a1b1f'
  },
  closetNameSelected: {
    color: '#111216'
  },
  closetCount: {
    marginTop: 4,
    color: '#6d6d74'
  },
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  itemTile: {
    width: '48%',
    gap: 8
  },
  itemImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: '#f6f7f9'
  },
  itemImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  itemImagePlaceholderText: {
    color: '#7a7b82',
    fontWeight: '500'
  },
  addTile: {
    borderStyle: 'dashed',
    borderColor: '#d9dce3',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  addTileIcon: {
    fontSize: 30,
    lineHeight: 30,
    color: '#5b5c64',
    fontWeight: '300'
  },
  addTileLabel: {
    marginTop: 6,
    color: '#5b5c64',
    fontWeight: '600'
  },
  itemTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#1a1b1f'
  },
  empty: {
    color: '#6f7077'
  },
  errorText: {
    color: '#a04f4f',
    fontWeight: '600'
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3d1d1',
    backgroundColor: '#f2e6e6',
    padding: 12,
    gap: 8
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#141518',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700'
  }
});
