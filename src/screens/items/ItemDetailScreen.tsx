import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { listClosets } from '../../services/closetService';
import { useAuth } from '../../services/AuthContext';
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

const parseCommaValues = (value: string | null) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const DEFAULT_OPTIONS: Record<ItemMetadataCategory, string[]> = {
  brand: ['Nike', 'Adidas', 'Uniqlo', 'Zara', "Levi's", 'H&M', 'Patagonia', 'Lululemon', 'The North Face', 'Gap'],
  clothing_type: ['T-Shirt', 'Shirt', 'Sweater', 'Hoodie', 'Jacket', 'Coat', 'Jeans', 'Pants', 'Skirt', 'Dress', 'Shorts'],
  color: ['Black', 'White', 'Gray', 'Navy', 'Blue', 'Green', 'Red', 'Pink', 'Purple', 'Brown', 'Beige', 'Yellow'],
  material: ['Cotton', 'Denim', 'Wool', 'Linen', 'Silk', 'Polyester', 'Nylon', 'Leather', 'Cashmere', 'Rayon'],
  season: ['Spring', 'Summer', 'Fall', 'Winter']
};

const EMPTY_CUSTOM_OPTIONS: Record<ItemMetadataCategory, string[]> = {
  brand: [],
  clothing_type: [],
  color: [],
  material: [],
  season: []
};

const mergeOptions = (defaultOptions: string[], customOptions: string[]) => {
  const seen = new Set(defaultOptions.map((option) => option.toLowerCase()));
  const merged = [...defaultOptions];
  for (const option of customOptions) {
    const normalized = option.toLowerCase();
    if (seen.has(normalized)) continue;
    merged.push(option);
    seen.add(normalized);
  }
  return merged;
};

const toggleOption = (current: string[], value: string) =>
  current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];

export default function ItemDetailScreen({ navigation, route }: Props) {
  const { itemId } = route.params;
  const { session } = useAuth();
  const userId = session?.user.id;

  const [item, setItem] = useState<ItemRow | null>(null);
  const [extraImages, setExtraImages] = useState<ItemImageRow[]>([]);
  const [selectedClosetNames, setSelectedClosetNames] = useState<string[]>([]);
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [customOptions, setCustomOptions] = useState<Record<ItemMetadataCategory, string[]>>(EMPTY_CUSTOM_OPTIONS);
  const [loading, setLoading] = useState(true);
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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const brandOptions = useMemo(() => mergeOptions(DEFAULT_OPTIONS.brand, customOptions.brand), [customOptions.brand]);
  const typeOptions = useMemo(() => mergeOptions(DEFAULT_OPTIONS.clothing_type, customOptions.clothing_type), [customOptions.clothing_type]);
  const colorOptions = useMemo(() => mergeOptions(DEFAULT_OPTIONS.color, customOptions.color), [customOptions.color]);
  const materialOptions = useMemo(() => mergeOptions(DEFAULT_OPTIONS.material, customOptions.material), [customOptions.material]);
  const seasonOptions = useMemo(() => mergeOptions(DEFAULT_OPTIONS.season, customOptions.season), [customOptions.season]);

  const handleAddCustomOption = async (category: ItemMetadataCategory, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!userId) {
      throw new Error('You need to sign in again before adding a custom option.');
    }

    const existing = [...DEFAULT_OPTIONS[category], ...customOptions[category]];
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
      Alert.alert('Item deleted', 'This item was removed from your wardrobe.');
      navigation.goBack();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Could not delete item.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#17181b" />
        </View>
      ) : null}

      {!loading && !item ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>Item not found.</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.secondarySingle}>
            <Text style={styles.secondaryText}>Go Back</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && item ? (
        <>
          <Text style={styles.sectionTitle}>Main Image</Text>
          {primaryImageUrl ? (
            <Image resizeMode="cover" source={{ uri: primaryImageUrl }} style={styles.mainImage} />
          ) : (
            <View style={styles.input}>
              <Text style={styles.valueMuted}>No image available</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Metadata</Text>
          <ReadonlyField label="Item Name" value={item.name} />
          <OptionSelector
            disabled={savingCategories}
            label="Brand"
            onAddCustomOption={async (value) => handleAddCustomOption('brand', value)}
            onToggle={(value) => setSelectedBrands((current) => toggleOption(current, value))}
            options={brandOptions}
            selected={selectedBrands}
          />
          <OptionSelector
            disabled={savingCategories}
            label="Clothing Type"
            onAddCustomOption={async (value) => handleAddCustomOption('clothing_type', value)}
            onToggle={(value) => setSelectedTypes((current) => toggleOption(current, value))}
            options={typeOptions}
            selected={selectedTypes}
          />
          <OptionSelector
            disabled={savingCategories}
            label="Color"
            onAddCustomOption={async (value) => handleAddCustomOption('color', value)}
            onToggle={(value) => setSelectedColors((current) => toggleOption(current, value))}
            options={colorOptions}
            selected={selectedColors}
          />
          <ReadonlyField
            label="Price"
            value={item.price_amount ? `${item.price_currency || 'USD'} ${item.price_amount}` : 'N/A'}
          />
          <OptionSelector
            disabled={savingCategories}
            label="Materials"
            onAddCustomOption={async (value) => handleAddCustomOption('material', value)}
            onToggle={(value) => setSelectedMaterials((current) => toggleOption(current, value))}
            options={materialOptions}
            selected={selectedMaterials}
          />
          <OptionSelector
            disabled={savingCategories}
            label="Seasons"
            onAddCustomOption={async (value) => handleAddCustomOption('season', value)}
            onToggle={(value) => setSelectedSeasons((current) => toggleOption(current, value))}
            options={seasonOptions}
            selected={selectedSeasons}
          />
          <Pressable
            disabled={savingCategories}
            onPress={handleSaveCategoryChanges}
            style={[styles.primary, savingCategories && styles.disabled]}
          >
            <Text style={styles.primaryText}>{savingCategories ? 'Saving...' : 'Save Category Changes'}</Text>
          </Pressable>
          <ReadonlyField
            label="Custom Fields"
            value={item.custom_fields ? JSON.stringify(item.custom_fields, null, 2) : 'N/A'}
            multiline
          />

          <Text style={styles.sectionTitle}>Closets</Text>
          <OptionChips label="Selected Closets" values={selectedClosetNames} />

          <Text style={styles.sectionTitle}>Extra Outfit Photos</Text>
          <ReadonlyField label="Count" value={`${extraImages.length}`} />

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          <Pressable
            disabled={deleting}
            onPress={() =>
              Alert.alert('Delete item?', 'This will delete the item and its stored photos.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => void handleDeleteItem() }
              ])
            }
            style={[styles.danger, deleting && styles.disabled]}
          >
            <Text style={styles.dangerText}>{deleting ? 'Deleting...' : 'Delete Item'}</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
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

function OptionSelector({
  label,
  options,
  selected,
  onToggle,
  onAddCustomOption,
  disabled = false
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onAddCustomOption: (value: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customOptionText, setCustomOptionText] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);

  return (
    <View style={styles.optionGroup}>
      <View style={styles.optionHeader}>
        <Text style={styles.optionLabel}>{label}</Text>
        <Pressable
          disabled={disabled || savingCustom}
          onPress={() => {
            setIsAddingCustom((current) => !current);
            setCustomOptionText('');
          }}
          style={[styles.addOptionButton, (disabled || savingCustom) && styles.disabled]}
        >
          <Text style={styles.addOptionButtonText}>+ Add</Text>
        </Pressable>
      </View>
      {isAddingCustom ? (
        <View style={styles.addOptionRow}>
          <TextInput
            editable={!disabled && !savingCustom}
            onChangeText={setCustomOptionText}
            placeholder={`Custom ${label.toLowerCase()}`}
            style={[styles.input, styles.addOptionInput]}
            value={customOptionText}
          />
          <Pressable
            disabled={disabled || savingCustom}
            onPress={async () => {
              const trimmed = customOptionText.trim();
              if (!trimmed) return;
              setSavingCustom(true);
              try {
                await onAddCustomOption(trimmed);
                onToggle(trimmed);
                setCustomOptionText('');
                setIsAddingCustom(false);
              } catch (error) {
                Alert.alert('Could not add option', error instanceof Error ? error.message : 'Unknown error');
              } finally {
                setSavingCustom(false);
              }
            }}
            style={[styles.addOptionAction, styles.addOptionConfirm, (disabled || savingCustom) && styles.disabled]}
          >
            <Text style={styles.addOptionActionText}>Add</Text>
          </Pressable>
          <Pressable
            disabled={disabled || savingCustom}
            onPress={() => {
              setCustomOptionText('');
              setIsAddingCustom(false);
            }}
            style={[styles.addOptionAction, (disabled || savingCustom) && styles.disabled]}
          >
            <Text style={styles.addOptionActionText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.optionList}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <Pressable
              key={`${label}:${option}`}
              disabled={disabled}
              onPress={() => onToggle(option)}
              style={[styles.chip, isSelected && styles.chipSelected, disabled && styles.disabled]}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#ffffff',
    gap: 12
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '700',
    color: '#17181b'
  },
  optionGroup: {
    gap: 8
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e1f23'
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  addOptionButton: {
    borderWidth: 1.5,
    borderColor: '#d9dce3',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#ffffff'
  },
  addOptionButtonText: {
    color: '#232429',
    fontWeight: '600'
  },
  addOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  addOptionInput: {
    flex: 1
  },
  addOptionAction: {
    borderWidth: 1,
    borderColor: '#d9dce3',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#ffffff'
  },
  addOptionConfirm: {
    borderColor: '#9f9ea4'
  },
  addOptionActionText: {
    color: '#292a30',
    fontWeight: '600'
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    borderWidth: 1.5,
    borderColor: '#d9dce3',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff'
  },
  chipSelected: {
    backgroundColor: '#d9d8de',
    borderColor: '#bab9c0'
  },
  chipText: {
    color: '#2d2e33',
    fontWeight: '500'
  },
  chipTextSelected: {
    color: '#111216'
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#d9dce3',
    borderRadius: 14,
    backgroundColor: '#ffffff',
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
    backgroundColor: '#dbdbe0'
  },
  valueText: {
    color: '#2d2e33'
  },
  valueMuted: {
    color: '#6f7077'
  },
  secondarySingle: {
    borderWidth: 2,
    borderColor: '#d9dce3',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff'
  },
  secondaryText: {
    color: '#222327',
    fontWeight: '600'
  },
  errorCard: {
    borderWidth: 1.5,
    borderColor: '#e3d1d1',
    borderRadius: 14,
    backgroundColor: '#f2e6e6',
    padding: 12,
    gap: 8
  },
  errorText: {
    color: '#a04f4f',
    fontWeight: '600'
  },
  danger: {
    marginTop: 12,
    backgroundColor: '#141518',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14
  },
  dangerText: {
    color: '#fff',
    fontWeight: '700'
  },
  primary: {
    marginTop: 2,
    backgroundColor: '#141518',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 12
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700'
  },
  disabled: {
    opacity: 0.65
  }
});
