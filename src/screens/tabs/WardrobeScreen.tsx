import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../../services/AuthContext';
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
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={refreshing} tintColor="#17181b" />}
    >
      <Text style={styles.title}>Wardrobe</Text>

      <View style={styles.actions}>
        <Pressable onPress={() => navigation.navigate('AddItem')} style={styles.primaryAction}>
          <Text style={styles.primaryActionText}>Add Item</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('AddCloset')} style={styles.secondaryAction}>
          <Text style={styles.secondaryActionText}>Create Closet</Text>
        </Pressable>
      </View>

      <View style={styles.segment}>
        <Pressable onPress={() => setViewMode('closets')} style={[styles.segmentButton, viewMode === 'closets' && styles.segmentButtonActive]}>
          <Text style={[styles.segmentText, viewMode === 'closets' && styles.segmentTextActive]}>By Closet</Text>
        </Pressable>
        <Pressable onPress={() => setViewMode('all')} style={[styles.segmentButton, viewMode === 'all' && styles.segmentButtonActive]}>
          <Text style={[styles.segmentText, viewMode === 'all' && styles.segmentTextActive]}>All Items</Text>
        </Pressable>
      </View>

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
            items.map((item) => <ItemCard item={item} key={item.id} onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })} />)
          ) : (
            <Text style={styles.empty}>No items yet.</Text>
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
              </View>
              <Text style={styles.sectionTitle}>Items in Selected Closet ({selectedClosetItems.length})</Text>
              {selectedClosetItems.length ? (
                selectedClosetItems.map((item) => (
                  <ItemCard item={item} key={item.id} onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })} />
                ))
              ) : (
                <Text style={styles.empty}>No items in this closet yet.</Text>
              )}
            </>
          ) : (
            <Text style={styles.empty}>No closets yet. Create your first closet.</Text>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function ItemCard({ item, onPress }: { item: ItemRow; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.itemCard}>
      <Text style={styles.itemTitle}>{item.name}</Text>
      <Text style={styles.itemMeta}>Type: {item.clothing_type || 'N/A'}</Text>
      <Text style={styles.itemMeta}>Color: {item.color || 'N/A'}</Text>
      <Text style={styles.itemMeta}>Brand: {item.brand || 'N/A'}</Text>
      <Text style={styles.itemMeta}>Price: {item.price_amount ? `${item.price_currency || 'USD'} ${item.price_amount}` : 'N/A'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ecebed',
    padding: 16,
    gap: 12
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: '#16171a'
  },
  actions: {
    flexDirection: 'row',
    gap: 12
  },
  primaryAction: {
    flex: 1,
    backgroundColor: '#141518',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 13
  },
  primaryActionText: {
    color: '#fff',
    fontWeight: '700'
  },
  secondaryAction: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#c7c6ca',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#efeff0'
  },
  secondaryActionText: {
    color: '#26272b',
    fontWeight: '700'
  },
  segment: {
    backgroundColor: '#e4e4e6',
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
    backgroundColor: '#f2f2f3'
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
    backgroundColor: '#f0f0f1',
    borderWidth: 1,
    borderColor: '#e5e4e7',
    padding: 14
  },
  closetCardSelected: {
    backgroundColor: '#d8d8df',
    borderColor: '#cac9cf'
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
  itemCard: {
    borderRadius: 16,
    backgroundColor: '#f0f0f1',
    borderWidth: 1,
    borderColor: '#e5e4e7',
    padding: 14,
    gap: 4
  },
  itemTitle: {
    fontWeight: '700',
    fontSize: 18,
    color: '#1a1b1f'
  },
  itemMeta: {
    color: '#6a6a72'
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
