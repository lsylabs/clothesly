import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ItemCollectionView from '../../components/ItemCollectionView';
import PageTitle from '../../components/ui/PageTitle';
import { useAuth } from '../../services/AuthContext';
import { getCachedSignedImageUrl, getCachedSignedImageUrlSync } from '../../services/imageCacheService';
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
  const [errorText, setErrorText] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const [itemImageUrls, setItemImageUrls] = useState<Record<string, string>>({});
  const [closetCoverUrls, setClosetCoverUrls] = useState<Record<string, string>>({});

  const applyWardrobeData = useCallback(
    (data: { closets: ClosetRow[]; items: ItemRow[]; mappings: MappingRow[]; loadedAt: number }) => {
      setClosets(data.closets);
      setItems(data.items);
      setMappings(data.mappings);
      setLastLoadedAt(data.loadedAt);
      setHasLoadedOnce(true);
    },
    []
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

      const immediateFromCache = items.reduce<Record<string, string>>((acc, item) => {
        const cached = getCachedSignedImageUrlSync('items', item.primary_image_path);
        if (cached) acc[item.id] = cached;
        return acc;
      }, {});
      if (active && Object.keys(immediateFromCache).length) {
        setItemImageUrls((current) => ({ ...current, ...immediateFromCache }));
      }

      const entries = await Promise.all(
        items.map(async (item) => {
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
  }, [items]);

  useEffect(() => {
    let active = true;

    const loadClosetCoverUrls = async () => {
      if (!closets.length) {
        if (active) setClosetCoverUrls({});
        return;
      }

      const immediateFromCache = closets.reduce<Record<string, string>>((acc, closet) => {
        if (!closet.cover_image_path) return acc;
        const cached = getCachedSignedImageUrlSync('closets', closet.cover_image_path);
        if (cached) acc[closet.id] = cached;
        return acc;
      }, {});
      if (active && Object.keys(immediateFromCache).length) {
        setClosetCoverUrls((current) => ({ ...current, ...immediateFromCache }));
      }

      const entries = await Promise.all(
        closets.map(async (closet) => {
          if (!closet.cover_image_path) return [closet.id, ''] as const;
          try {
            const url = await getCachedSignedImageUrl('closets', closet.cover_image_path);
            return [closet.id, url ?? ''] as const;
          } catch {
            return [closet.id, ''] as const;
          }
        })
      );

      if (!active) return;
      setClosetCoverUrls(
        entries.reduce<Record<string, string>>((acc, [id, url]) => {
          if (url) acc[id] = url;
          return acc;
        }, { ...immediateFromCache })
      );
    };

    void loadClosetCoverUrls();
    return () => {
      active = false;
    };
  }, [closets]);

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

  const closetItemIdsByCloset = useMemo(() => {
    const rank = new Map(items.map((item, index) => [item.id, index]));
    const grouped: Record<string, string[]> = {};
    mappings.forEach((mapping) => {
      if (!grouped[mapping.closet_id]) grouped[mapping.closet_id] = [];
      grouped[mapping.closet_id].push(mapping.item_id);
    });

    Object.keys(grouped).forEach((closetId) => {
      grouped[closetId] = grouped[closetId]
        .filter((itemId, idx, arr) => arr.indexOf(itemId) === idx)
        .sort((a, b) => (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER));
    });

    return grouped;
  }, [items, mappings]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <PageTitle title="Wardrobe" />

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
            <ItemCollectionView
              imageUrls={itemImageUrls}
              items={items}
              onPressAdd={() => navigation.navigate('AddItem')}
              onPressItem={(itemId) => navigation.navigate('ItemDetail', { itemId })}
              title={`All Items (${items.length})`}
            />
          </>
        ) : null}

        {viewMode === 'closets' ? (
          <>
            <Text style={styles.sectionTitle}>Closets ({closets.length})</Text>
            {closets.length ? (
              <>
                <View style={styles.closetGrid}>
                <ClosetGrid
                  closetCoverUrls={closetCoverUrls}
                  closetItemIdsByCloset={closetItemIdsByCloset}
                  closets={closets}
                  itemImageUrls={itemImageUrls}
                  onPressAdd={() => navigation.navigate('AddCloset')}
                  onPressCloset={(closetId, closetName) => navigation.navigate('ClosetItems', { closetId, closetName })}
                />
              </View>
              </>
            ) : (
              <View style={styles.closetGrid}>
                <ClosetGrid
                  closetCoverUrls={{}}
                  closetItemIdsByCloset={{}}
                  closets={[]}
                  itemImageUrls={itemImageUrls}
                  onPressAdd={() => navigation.navigate('AddCloset')}
                  onPressCloset={() => undefined}
                />
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ClosetGrid({
  closets,
  onPressCloset,
  onPressAdd,
  closetCoverUrls,
  closetItemIdsByCloset,
  itemImageUrls
}: {
  closets: ClosetRow[];
  onPressCloset: (closetId: string, closetName: string) => void;
  onPressAdd: () => void;
  closetCoverUrls: Record<string, string>;
  closetItemIdsByCloset: Record<string, string[]>;
  itemImageUrls: Record<string, string>;
}) {
  return (
    <>
      {closets.map((closet) => {
        const coverUrl = closetCoverUrls[closet.id] ?? '';
        const previewIds = (closetItemIdsByCloset[closet.id] ?? []).slice(0, 4);

        return (
          <Pressable key={closet.id} onPress={() => onPressCloset(closet.id, closet.name)} style={styles.closetTile}>
            {coverUrl ? (
              <Image resizeMode="cover" source={{ uri: coverUrl }} style={styles.closetImage} />
            ) : (
              <ClosetFallbackCollage itemIds={previewIds} itemImageUrls={itemImageUrls} />
            )}
            <Text numberOfLines={1} style={styles.closetName}>
              {closet.name}
            </Text>
          </Pressable>
        );
      })}

      <Pressable onPress={onPressAdd} style={styles.closetTile}>
        <View style={[styles.closetImage, styles.addTile]}>
          <Text style={styles.addTileIcon}>+</Text>
        </View>
        <Text numberOfLines={1} style={styles.addTileLabel}>
          Create Closet
        </Text>
      </Pressable>
    </>
  );
}

function ClosetFallbackCollage({
  itemIds,
  itemImageUrls
}: {
  itemIds: string[];
  itemImageUrls: Record<string, string>;
}) {
  const tl = itemIds[0] ? itemImageUrls[itemIds[0]] : '';
  const tr = itemIds[1] ? itemImageUrls[itemIds[1]] : '';
  const bl = itemIds[2] ? itemImageUrls[itemIds[2]] : '';
  const br = itemIds[3] ? itemImageUrls[itemIds[3]] : '';

  return (
    <View style={[styles.closetImage, styles.collageWrap]}>
      <View style={styles.collageColumn}>
        <CollageCell url={tl} />
        <CollageCell url={bl} />
      </View>
      <View style={styles.collageColumn}>
        <CollageCell url={tr} />
        <CollageCell url={br} />
      </View>
    </View>
  );
}

function CollageCell({ url }: { url: string }) {
  return (
    <View style={styles.collageCell}>
      {url ? <Image resizeMode="cover" source={{ uri: url }} style={styles.collageCellImage} /> : null}
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
    gap: 12
  },
  closetTile: {
    width: '48%',
    gap: 8
  },
  closetImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6e8ec',
    backgroundColor: '#f6f7f9'
  },
  closetName: {
    fontWeight: '700',
    color: '#1a1b1f',
    fontSize: 16
  },
  collageWrap: {
    flexDirection: 'row',
    gap: 4,
    padding: 4
  },
  collageColumn: {
    flex: 1,
    gap: 4
  },
  collageCell: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#eceef2'
  },
  collageCellImage: {
    width: '100%',
    height: '100%'
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
