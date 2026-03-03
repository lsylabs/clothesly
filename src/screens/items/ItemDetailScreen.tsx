import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MetadataOptionSelector from '../../components/MetadataOptionSelector';
import AppButton from '../../components/ui/AppButton';
import SectionHeader from '../../components/ui/SectionHeader';
import {
  DEFAULT_ITEM_METADATA_OPTIONS,
  EMPTY_ITEM_METADATA_OPTIONS,
  mergeMetadataOptions,
  parseCommaValues,
  toggleMetadataOption
} from '../../features/items/metadataOptions';
import { listClosets } from '../../services/closetService';
import { useAuth } from '../../services/AuthContext';
import { clearCachedItemDetail, getCachedItemDetail, getCachedItemDetailSync, setCachedItemDetail } from '../../services/itemDetailCacheService';
import { getCachedSignedImageUrl } from '../../services/imageCacheService';
import { createItemMetadataOption, listItemMetadataOptions, type ItemMetadataCategory } from '../../services/itemMetadataOptionService';
import { deleteItem, deleteItemViaBackend, getItem, listItemClosetMappings, listItemImages, updateItemCategories } from '../../services/itemService';
import { refreshWardrobeData } from '../../services/wardrobeDataService';
import type { Database } from '../../types/database';
import type { AppStackParamList } from '../../types/navigation';
import { withRetry } from '../../utils/retry';

type Props = NativeStackScreenProps<AppStackParamList, 'ItemDetail'>;
type ItemRow = Database['public']['Tables']['clothing_items']['Row'];
type ItemImageRow = Database['public']['Tables']['clothing_item_images']['Row'];
type ClosetRow = Database['public']['Tables']['closets']['Row'];
type MappingRow = Database['public']['Tables']['clothing_item_closets']['Row'];

export default function ItemDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { itemId } = route.params;
  const { session } = useAuth();
  const userId = session?.user.id;
  const initialCache = getCachedItemDetailSync(itemId);

  const [item, setItem] = useState<ItemRow | null>(initialCache?.item ?? null);
  const [extraImages, setExtraImages] = useState<ItemImageRow[]>(initialCache?.extraImages ?? []);
  const [selectedClosetNames, setSelectedClosetNames] = useState<string[]>(initialCache?.selectedClosetNames ?? []);
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(initialCache?.primaryImageUrl ?? null);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(parseCommaValues(initialCache?.item?.brand ?? null));
  const [selectedTypes, setSelectedTypes] = useState<string[]>(parseCommaValues(initialCache?.item?.clothing_type ?? null));
  const [selectedColors, setSelectedColors] = useState<string[]>(parseCommaValues(initialCache?.item?.color ?? null));
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(initialCache?.item?.material ?? []);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>(initialCache?.item?.season ?? []);
  const [customOptions, setCustomOptions] = useState<Record<ItemMetadataCategory, string[]>>(EMPTY_ITEM_METADATA_OPTIONS);
  const [loading, setLoading] = useState(!initialCache);
  const [deleting, setDeleting] = useState(false);
  const [savingCategories, setSavingCategories] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const [itemRow, imageRows, closetRows, mappingRows, metadataOptions] = await Promise.all([
        withRetry(() => getItem(itemId)),
        withRetry(() => listItemImages(itemId)),
        withRetry(() => listClosets()),
        withRetry(() => listItemClosetMappings()),
        withRetry(() => listItemMetadataOptions())
      ]);

      setItem(itemRow);
      setExtraImages(imageRows);
      setSelectedBrands(parseCommaValues(itemRow.brand));
      setSelectedTypes(parseCommaValues(itemRow.clothing_type));
      setSelectedColors(parseCommaValues(itemRow.color));
      setSelectedMaterials(itemRow.material ?? []);
      setSelectedSeasons(itemRow.season ?? []);
      const signedUrl = await withRetry(() => getCachedSignedImageUrl('items', itemRow.primary_image_path));
      setPrimaryImageUrl(signedUrl);

      const grouped: Record<ItemMetadataCategory, string[]> = {
        brand: [],
        clothing_type: [],
        color: [],
        material: [],
        season: []
      };
      metadataOptions.forEach((row) => {
        grouped[row.category].push(row.label);
      });
      setCustomOptions(grouped);

      const closetLookup = new Map(closetRows.map((closet: ClosetRow) => [closet.id, closet.name]));
      const names = mappingRows
        .filter((mapping: MappingRow) => mapping.item_id === itemId)
        .map((mapping: MappingRow) => closetLookup.get(mapping.closet_id))
        .filter((name): name is string => Boolean(name));
      setSelectedClosetNames(names);

      await setCachedItemDetail(itemId, {
        item: itemRow,
        extraImages: imageRows,
        selectedClosetNames: names,
        primaryImageUrl: signedUrl,
        cachedAt: Date.now()
      });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Could not load item details.');
      setItem(null);
      setExtraImages([]);
      setSelectedClosetNames([]);
      setPrimaryImageUrl(null);
      setSelectedBrands([]);
      setSelectedTypes([]);
      setSelectedColors([]);
      setSelectedMaterials([]);
      setSelectedSeasons([]);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    let active = true;
    if (item) return () => {
      active = false;
    };

    void getCachedItemDetail(itemId).then((cached) => {
      if (!active || !cached) return;
      setItem(cached.item);
      setExtraImages(cached.extraImages);
      setSelectedClosetNames(cached.selectedClosetNames);
      setPrimaryImageUrl(cached.primaryImageUrl);
      setSelectedBrands(parseCommaValues(cached.item.brand));
      setSelectedTypes(parseCommaValues(cached.item.clothing_type));
      setSelectedColors(parseCommaValues(cached.item.color));
      setSelectedMaterials(cached.item.material ?? []);
      setSelectedSeasons(cached.item.season ?? []);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [item, itemId]);

  useFocusEffect(
    useCallback(() => {
      if (!item) {
        void loadData();
      }
    }, [item, loadData])
  );

  const brandOptions = useMemo(
    () => mergeMetadataOptions(DEFAULT_ITEM_METADATA_OPTIONS.brand, customOptions.brand),
    [customOptions.brand]
  );
  const typeOptions = useMemo(
    () => mergeMetadataOptions(DEFAULT_ITEM_METADATA_OPTIONS.clothing_type, customOptions.clothing_type),
    [customOptions.clothing_type]
  );
  const colorOptions = useMemo(
    () => mergeMetadataOptions(DEFAULT_ITEM_METADATA_OPTIONS.color, customOptions.color),
    [customOptions.color]
  );
  const materialOptions = useMemo(
    () => mergeMetadataOptions(DEFAULT_ITEM_METADATA_OPTIONS.material, customOptions.material),
    [customOptions.material]
  );
  const seasonOptions = useMemo(
    () => mergeMetadataOptions(DEFAULT_ITEM_METADATA_OPTIONS.season, customOptions.season),
    [customOptions.season]
  );

  const handleAddCustomOption = async (category: ItemMetadataCategory, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!userId) {
      throw new Error('You need to sign in again before adding a custom option.');
    }

    const existing = [...DEFAULT_ITEM_METADATA_OPTIONS[category], ...customOptions[category]];
    if (existing.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) return;

    await withRetry(() =>
      createItemMetadataOption({
        userId,
        category,
        label: trimmed
      })
    );

    setCustomOptions((current) => ({
      ...current,
      [category]: [...current[category], trimmed].sort((a, b) => a.localeCompare(b))
    }));
  };

  const handleSaveCategoryChanges = async () => {
    if (!item) return;
    setSavingCategories(true);
    setErrorText(null);
    try {
      const updated = await withRetry(() =>
        updateItemCategories({
          itemId: item.id,
          brand: selectedBrands.join(', '),
          clothingType: selectedTypes.join(', '),
          color: selectedColors.join(', '),
          material: selectedMaterials,
          season: selectedSeasons
        })
      );
      setItem(updated);
      await setCachedItemDetail(item.id, {
        item: updated,
        extraImages,
        selectedClosetNames,
        primaryImageUrl,
        cachedAt: Date.now()
      });
      if (session?.user.id) {
        await refreshWardrobeData(session.user.id).catch(() => undefined);
      }
      Alert.alert('Saved', 'Category changes were updated.');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Could not save changes.');
    } finally {
      setSavingCategories(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!item) return;

    setDeleting(true);
    setErrorText(null);
    try {
      const accessToken = session?.access_token;
      if (accessToken) {
        await withRetry(() => deleteItemViaBackend({ itemId: item.id, accessToken }));
      } else {
        // Fallback if auth context is stale; DB cascade will still remove related rows.
        await withRetry(() => deleteItem(item.id));
      }
      if (session?.user.id) {
        await refreshWardrobeData(session.user.id).catch(() => undefined);
      }
      await clearCachedItemDetail(item.id).catch(() => undefined);
      Alert.alert('Item deleted', 'This item was removed from your wardrobe.');
      navigation.goBack();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Could not delete item.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable hitSlop={8} onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons color="#0A0A0A" name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Item Details</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.container}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0A0A0A" />
        </View>
      ) : null}

      {!loading && !item ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Item not found.</Text>
          <AppButton label="Go Back" onPress={() => navigation.goBack()} style={styles.secondarySingle} variant="secondary" />
        </View>
      ) : null}

      {!loading && item ? (
        <>
          <SectionHeader title="Main Image" />
          {primaryImageUrl ? (
            <Image resizeMode="cover" source={{ uri: primaryImageUrl }} style={styles.mainImage} />
          ) : (
            <View style={styles.input}>
              <Text style={styles.valueMuted}>No image available</Text>
            </View>
          )}

          <SectionHeader title="Metadata" />
          <ReadonlyField label="Item Name" value={item.name} />
          <MetadataOptionSelector
            disabled={savingCategories}
            label="Brand"
            onAddCustomOption={async (value) => handleAddCustomOption('brand', value)}
            onToggle={(value) => setSelectedBrands((current) => toggleMetadataOption(current, value))}
            options={brandOptions}
            selected={selectedBrands}
          />
          <MetadataOptionSelector
            disabled={savingCategories}
            label="Clothing Type"
            onAddCustomOption={async (value) => handleAddCustomOption('clothing_type', value)}
            onToggle={(value) => setSelectedTypes((current) => toggleMetadataOption(current, value))}
            options={typeOptions}
            selected={selectedTypes}
          />
          <MetadataOptionSelector
            disabled={savingCategories}
            label="Color"
            onAddCustomOption={async (value) => handleAddCustomOption('color', value)}
            onToggle={(value) => setSelectedColors((current) => toggleMetadataOption(current, value))}
            options={colorOptions}
            selected={selectedColors}
          />
          <ReadonlyField
            label="Price"
            value={item.price_amount ? `${item.price_currency || 'USD'} ${item.price_amount}` : 'N/A'}
          />
          <MetadataOptionSelector
            disabled={savingCategories}
            label="Materials"
            onAddCustomOption={async (value) => handleAddCustomOption('material', value)}
            onToggle={(value) => setSelectedMaterials((current) => toggleMetadataOption(current, value))}
            options={materialOptions}
            selected={selectedMaterials}
          />
          <MetadataOptionSelector
            disabled={savingCategories}
            label="Seasons"
            onAddCustomOption={async (value) => handleAddCustomOption('season', value)}
            onToggle={(value) => setSelectedSeasons((current) => toggleMetadataOption(current, value))}
            options={seasonOptions}
            selected={selectedSeasons}
          />
          <AppButton
            label="Save Category Changes"
            loading={savingCategories}
            loadingLabel="Saving..."
            onPress={handleSaveCategoryChanges}
            style={styles.primary}
          />
          <ReadonlyField
            label="Custom Fields"
            value={item.custom_fields ? JSON.stringify(item.custom_fields, null, 2) : 'N/A'}
            multiline
          />

          <SectionHeader title="Closets" />
          <OptionChips label="Selected Closets" values={selectedClosetNames} />

          <SectionHeader title="Extra Outfit Photos" />
          <ReadonlyField label="Count" value={`${extraImages.length}`} />

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          <AppButton
            disabled={deleting}
            label={deleting ? 'Deleting...' : 'Delete Item'}
            onPress={() =>
              Alert.alert('Delete item?', 'This will delete the item and its stored photos.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => void handleDeleteItem() }
              ])
            }
            style={styles.danger}
            variant="danger"
          />
        </>
      ) : null}
      </ScrollView>
    </View>
  );
}

function ReadonlyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={[styles.input, multiline && styles.textArea]}>
        <Text style={styles.valueText}>{value}</Text>
      </View>
    </View>
  );
}

function OptionChips({ label, values }: { label: string; values: string[] }) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.optionLabel}>{label}</Text>
      {values.length ? (
        <View style={styles.optionList}>
          {values.map((value) => (
            <View key={`${label}:${value}`} style={[styles.chip, styles.chipSelected]}>
              <Text style={[styles.chipText, styles.chipTextSelected]}>{value}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.input}>
          <Text style={styles.valueMuted}>None selected</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAFA'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 8
  },
  headerButton: {
    paddingHorizontal: 2,
    paddingVertical: 2
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0A0A0A',
    letterSpacing: -0.7
  },
  headerSpacer: {
    width: 28
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 22,
    backgroundColor: '#FAFAFA',
    gap: 12
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16
  },
  optionGroup: {
    gap: 8
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A0A0A'
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA'
  },
  chipSelected: {
    backgroundColor: '#E0E0E0',
    borderColor: '#E0E0E0'
  },
  chipText: {
    color: '#0A0A0A',
    fontWeight: '500'
  },
  chipTextSelected: {
    color: '#0A0A0A'
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  textArea: {
    minHeight: 90
  },
  mainImage: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 18,
    backgroundColor: '#E8E8E8'
  },
  valueText: {
    color: '#0A0A0A'
  },
  valueMuted: {
    color: '#0A0A0A'
  },
  secondarySingle: {
    alignSelf: 'flex-start'
  },
  errorCard: {
    borderWidth: 1.5,
    borderColor: '#DC2626',
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    padding: 12,
    gap: 8
  },
  errorText: {
    color: '#DC2626',
    fontWeight: '600'
  },
  danger: {
    marginTop: 12
  },
  primary: {
    marginTop: 2
  }
});
