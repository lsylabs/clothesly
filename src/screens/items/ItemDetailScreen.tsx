import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MetadataOptionSelector from '../../components/MetadataOptionSelector';
import AppButton from '../../components/ui/AppButton';
import AppTextInput from '../../components/ui/AppTextInput';
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
import {
  deleteItem,
  deleteItemViaBackend,
  getItem,
  listItemClosetMappings,
  listItemImages,
  replaceItemClosetMappings,
  updateItemCategories
} from '../../services/itemService';
import { refreshWardrobeData } from '../../services/wardrobeDataService';
import type { Database, Json } from '../../types/database';
import type { AppStackParamList } from '../../types/navigation';
import { withRetry } from '../../utils/retry';
import { validateCurrency, validateItemName, validatePrice } from '../../utils/validation';

type Props = NativeStackScreenProps<AppStackParamList, 'ItemDetail'>;
type ItemRow = Database['public']['Tables']['clothing_items']['Row'];
type ItemImageRow = Database['public']['Tables']['clothing_item_images']['Row'];
type ClosetRow = Database['public']['Tables']['closets']['Row'];
type MappingRow = Database['public']['Tables']['clothing_item_closets']['Row'];

function sameValues(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

function extractNotes(customFields: Json | null): string {
  if (!customFields || Array.isArray(customFields) || typeof customFields !== 'object') return '';
  const maybeNotes = (customFields as { notes?: unknown }).notes;
  return typeof maybeNotes === 'string' ? maybeNotes : '';
}

export default function ItemDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { itemId } = route.params;
  const { session } = useAuth();
  const userId = session?.user.id;
  const initialCache = getCachedItemDetailSync(itemId);

  const [item, setItem] = useState<ItemRow | null>(initialCache?.item ?? null);
  const [extraImages, setExtraImages] = useState<ItemImageRow[]>(initialCache?.extraImages ?? []);
  const [allClosets, setAllClosets] = useState<ClosetRow[]>([]);
  const [selectedClosetIds, setSelectedClosetIds] = useState<string[]>([]);
  const [savedClosetIds, setSavedClosetIds] = useState<string[]>([]);
  const [cachedSelectedClosetNames, setCachedSelectedClosetNames] = useState<string[]>(initialCache?.selectedClosetNames ?? []);
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(initialCache?.primaryImageUrl ?? null);
  const [carouselImageUrls, setCarouselImageUrls] = useState<string[]>(initialCache?.primaryImageUrl ? [initialCache.primaryImageUrl] : []);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(parseCommaValues(initialCache?.item?.brand ?? null));
  const [selectedTypes, setSelectedTypes] = useState<string[]>(parseCommaValues(initialCache?.item?.clothing_type ?? null));
  const [selectedColors, setSelectedColors] = useState<string[]>(parseCommaValues(initialCache?.item?.color ?? null));
  const [itemName, setItemName] = useState<string>(initialCache?.item?.name ?? '');
  const [priceAmount, setPriceAmount] = useState<string>(initialCache?.item?.price_amount ?? '');
  const [priceCurrency, setPriceCurrency] = useState<string>(initialCache?.item?.price_currency ?? 'USD');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(initialCache?.item?.material ?? []);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>(initialCache?.item?.season ?? []);
  const [notes, setNotes] = useState<string>(extractNotes(initialCache?.item?.custom_fields ?? null));
  const [isClosetPickerVisible, setClosetPickerVisible] = useState(false);
  const [closetSearch, setClosetSearch] = useState('');
  const [customOptions, setCustomOptions] = useState<Record<ItemMetadataCategory, string[]>>(EMPTY_ITEM_METADATA_OPTIONS);
  const [loading, setLoading] = useState(!initialCache);
  const [deleting, setDeleting] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const hasItemRef = useRef(Boolean(initialCache?.item));
  const hasPendingChangesRef = useRef(false);
  const swipeSaveTriggeredRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    hasItemRef.current = Boolean(item);
  }, [item]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async (options?: { blocking?: boolean }) => {
    const blocking = Boolean(options?.blocking);
    if (blocking) setLoading(true);
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
      setItemName(itemRow.name ?? '');
      setPriceAmount(itemRow.price_amount ?? '');
      setPriceCurrency(itemRow.price_currency ?? 'USD');
      setSelectedMaterials(itemRow.material ?? []);
      setSelectedSeasons(itemRow.season ?? []);
      setNotes(extractNotes(itemRow.custom_fields));
      const signedUrl = await withRetry(() => getCachedSignedImageUrl('items', itemRow.primary_image_path));
      setPrimaryImageUrl(signedUrl);
      const extraUrls = (
        await Promise.all(
          imageRows.map(async (imageRow) => {
            try {
              return await withRetry(() => getCachedSignedImageUrl('items', imageRow.image_path));
            } catch {
              return null;
            }
          })
        )
      ).filter((entry): entry is string => Boolean(entry));
      const nextCarouselUrls = [signedUrl, ...extraUrls].filter((entry): entry is string => Boolean(entry));
      setCarouselImageUrls(nextCarouselUrls);
      setCarouselIndex(0);
      setAllClosets(closetRows);

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
      setCachedSelectedClosetNames(names);
      const nextSelectedClosetIds = mappingRows
          .filter((mapping: MappingRow) => mapping.item_id === itemId && closetLookup.has(mapping.closet_id))
          .map((mapping: MappingRow) => mapping.closet_id)
          .filter((value, index, self) => self.indexOf(value) === index);
      setSelectedClosetIds(nextSelectedClosetIds);
      setSavedClosetIds(nextSelectedClosetIds);

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
      setAllClosets([]);
      setSelectedClosetIds([]);
      setSavedClosetIds([]);
      setCachedSelectedClosetNames([]);
      setPrimaryImageUrl(null);
      setCarouselImageUrls([]);
      setCarouselIndex(0);
      setSelectedBrands([]);
      setSelectedTypes([]);
      setSelectedColors([]);
      setItemName('');
      setPriceAmount('');
      setPriceCurrency('USD');
      setSelectedMaterials([]);
      setSelectedSeasons([]);
      setNotes('');
    } finally {
      if (blocking) setLoading(false);
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
      setCachedSelectedClosetNames(cached.selectedClosetNames);
      setPrimaryImageUrl(cached.primaryImageUrl);
      setCarouselImageUrls(cached.primaryImageUrl ? [cached.primaryImageUrl] : []);
      setCarouselIndex(0);
      setSelectedBrands(parseCommaValues(cached.item.brand));
      setSelectedTypes(parseCommaValues(cached.item.clothing_type));
      setSelectedColors(parseCommaValues(cached.item.color));
      setItemName(cached.item.name ?? '');
      setPriceAmount(cached.item.price_amount ?? '');
      setPriceCurrency(cached.item.price_currency ?? 'USD');
      setSelectedMaterials(cached.item.material ?? []);
      setSelectedSeasons(cached.item.season ?? []);
      setNotes(extractNotes(cached.item.custom_fields));
      setSavedClosetIds([]);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [item, itemId]);

  useFocusEffect(
    useCallback(() => {
      // Refresh supporting data on focus without creating a re-fetch loop while editing.
      void loadData({ blocking: !hasItemRef.current });
    }, [loadData])
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
  const selectedClosetNames = useMemo(() => {
    if (allClosets.length) {
      const lookup = new Map(allClosets.map((closet) => [closet.id, closet.name]));
      return selectedClosetIds.map((id) => lookup.get(id)).filter((name): name is string => Boolean(name));
    }
    return cachedSelectedClosetNames;
  }, [allClosets, cachedSelectedClosetNames, selectedClosetIds]);
  const filteredClosets = useMemo(() => {
    const query = closetSearch.trim().toLowerCase();
    if (!query) return allClosets;
    return allClosets.filter((closet) => closet.name.toLowerCase().includes(query));
  }, [allClosets, closetSearch]);
  const hasPendingChanges = useMemo(() => {
    if (!item) return false;
    return !(
      itemName.trim() === item.name.trim() &&
      sameValues(selectedBrands, parseCommaValues(item.brand)) &&
      sameValues(selectedTypes, parseCommaValues(item.clothing_type)) &&
      sameValues(selectedColors, parseCommaValues(item.color)) &&
      priceAmount.trim() === (item.price_amount ?? '').trim() &&
      priceCurrency.trim().toUpperCase() === (item.price_currency ?? 'USD').trim().toUpperCase() &&
      sameValues(selectedMaterials, item.material ?? []) &&
      sameValues(selectedSeasons, item.season ?? []) &&
      notes.trim() === extractNotes(item.custom_fields).trim() &&
      sameValues(selectedClosetIds, savedClosetIds)
    );
  }, [item, itemName, notes, priceAmount, priceCurrency, savedClosetIds, selectedBrands, selectedClosetIds, selectedColors, selectedMaterials, selectedSeasons, selectedTypes]);

  useEffect(() => {
    hasPendingChangesRef.current = hasPendingChanges;
    if (hasPendingChanges) {
      swipeSaveTriggeredRef.current = false;
    }
  }, [hasPendingChanges]);

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

  const toggleClosetSelection = (closetId: string) => {
    setSelectedClosetIds((current) =>
      current.includes(closetId) ? current.filter((id) => id !== closetId) : [...current, closetId]
    );
  };

  const handleSaveChanges = useCallback(async (options?: { blockUi?: boolean }) => {
    const blockUi = options?.blockUi ?? true;
    if (!item) return;
    if (blockUi && mountedRef.current) setSavingChanges(true);
    if (mountedRef.current) setErrorText(null);
    try {
      const nameValidation = validateItemName(itemName);
      if (!nameValidation.valid) {
        if (mountedRef.current) setErrorText(nameValidation.message ?? 'Invalid item name.');
        return false;
      }
      const priceValidation = validatePrice(priceAmount);
      if (!priceValidation.valid) {
        if (mountedRef.current) setErrorText(priceValidation.message ?? 'Invalid price.');
        return false;
      }
      const currencyValidation = validateCurrency(priceCurrency);
      if (!currencyValidation.valid) {
        if (mountedRef.current) setErrorText(currencyValidation.message ?? 'Invalid currency.');
        return false;
      }

      const trimmedNotes = notes.trim();
      const currentCustomFields = item.custom_fields;
      let nextCustomFields: Json | null = null;
      if (currentCustomFields && typeof currentCustomFields === 'object' && !Array.isArray(currentCustomFields)) {
        const next = { ...(currentCustomFields as Record<string, unknown>) };
        if (trimmedNotes) {
          next.notes = trimmedNotes;
        } else {
          delete next.notes;
        }
        nextCustomFields = Object.keys(next).length ? (next as Json) : null;
      } else if (trimmedNotes) {
        nextCustomFields = { notes: trimmedNotes } as Json;
      }

      const updated = await withRetry(() =>
        updateItemCategories({
          itemId: item.id,
          name: itemName,
          brand: selectedBrands.join(', '),
          clothingType: selectedTypes.join(', '),
          color: selectedColors.join(', '),
          priceAmount,
          priceCurrency,
          material: selectedMaterials,
          season: selectedSeasons,
          customFields: nextCustomFields
        })
      );
      await withRetry(() => replaceItemClosetMappings(item.id, selectedClosetIds));
      setItem(updated);
      setSavedClosetIds([...selectedClosetIds]);
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
      return true;
    } catch (error) {
      if (mountedRef.current) {
        setErrorText(error instanceof Error ? error.message : 'Could not save changes.');
      }
      return false;
    } finally {
      if (blockUi && mountedRef.current) setSavingChanges(false);
    }
  }, [
    extraImages,
    itemName,
    item,
    notes,
    priceAmount,
    priceCurrency,
    primaryImageUrl,
    selectedBrands,
    selectedClosetIds,
    selectedClosetNames,
    selectedColors,
    selectedMaterials,
    selectedSeasons,
    selectedTypes,
    session?.user.id
  ]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('transitionStart', (event) => {
      // Native-stack swipe back cannot be prevented safely; save in background on close transition.
      if (!event.data?.closing) return;
      if (!hasItemRef.current || !hasPendingChangesRef.current || swipeSaveTriggeredRef.current) return;
      swipeSaveTriggeredRef.current = true;
      void handleSaveChanges({ blockUi: false });
    });
    return unsubscribe;
  }, [handleSaveChanges, navigation]);

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
        <Pressable
          disabled={savingChanges}
          hitSlop={8}
          onPress={async () => {
            if (savingChanges) return;
            if (hasPendingChanges) {
              const saved = await handleSaveChanges({ blockUi: true });
              if (!saved) return;
            }
            navigation.goBack();
          }}
          style={styles.headerButton}
        >
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
          {carouselImageUrls.length ? (
            <View
              onLayout={(event) => {
                const width = event.nativeEvent.layout.width;
                if (width > 0 && width !== carouselWidth) {
                  setCarouselWidth(width);
                }
              }}
              style={styles.carouselWrap}
            >
              <ScrollView
                horizontal
                onMomentumScrollEnd={(event) => {
                  if (!carouselWidth) return;
                  const nextIndex = Math.round(event.nativeEvent.contentOffset.x / carouselWidth);
                  setCarouselIndex(nextIndex);
                }}
                pagingEnabled
                showsHorizontalScrollIndicator={false}
              >
                {carouselImageUrls.map((url) => (
                  <Image key={url} resizeMode="cover" source={{ uri: url }} style={[styles.mainImage, { width: carouselWidth || undefined }]} />
                ))}
              </ScrollView>
              {carouselImageUrls.length > 1 ? (
                <View style={styles.carouselDots}>
                  {carouselImageUrls.map((_, index) => (
                    <View key={`dot-${index}`} style={[styles.carouselDot, index === carouselIndex && styles.carouselDotActive]} />
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.input}>
              <Text style={styles.valueMuted}>No image available</Text>
            </View>
          )}

          <SectionHeader title="Metadata" />
          <View style={styles.optionGroup}>
            <Text style={styles.optionLabel}>Item Name</Text>
            <AppTextInput editable={!savingChanges} onChangeText={setItemName} placeholder="Item Name" style={styles.input} value={itemName} />
          </View>
          <MetadataOptionSelector
            disabled={savingChanges}
            label="Brand"
            onAddCustomOption={async (value) => handleAddCustomOption('brand', value)}
            onToggle={(value) => setSelectedBrands((current) => toggleMetadataOption(current, value))}
            options={brandOptions}
            selected={selectedBrands}
          />
          <MetadataOptionSelector
            disabled={savingChanges}
            label="Clothing Type"
            onAddCustomOption={async (value) => handleAddCustomOption('clothing_type', value)}
            onToggle={(value) => setSelectedTypes((current) => toggleMetadataOption(current, value))}
            options={typeOptions}
            selected={selectedTypes}
          />
          <MetadataOptionSelector
            disabled={savingChanges}
            label="Color"
            onAddCustomOption={async (value) => handleAddCustomOption('color', value)}
            onToggle={(value) => setSelectedColors((current) => toggleMetadataOption(current, value))}
            options={colorOptions}
            selected={selectedColors}
          />
          <View style={styles.optionGroup}>
            <Text style={styles.optionLabel}>Price</Text>
            <View style={styles.priceRow}>
              <AppTextInput
                editable={!savingChanges}
                keyboardType="decimal-pad"
                onChangeText={setPriceAmount}
                placeholder="Amount"
                style={[styles.input, styles.priceAmountInput]}
                value={priceAmount}
              />
              <AppTextInput
                autoCapitalize="characters"
                editable={!savingChanges}
                maxLength={3}
                onChangeText={setPriceCurrency}
                placeholder="USD"
                style={[styles.input, styles.priceCurrencyInput]}
                value={priceCurrency}
              />
            </View>
          </View>
          <MetadataOptionSelector
            disabled={savingChanges}
            label="Materials"
            onAddCustomOption={async (value) => handleAddCustomOption('material', value)}
            onToggle={(value) => setSelectedMaterials((current) => toggleMetadataOption(current, value))}
            options={materialOptions}
            selected={selectedMaterials}
          />
          <MetadataOptionSelector
            disabled={savingChanges}
            label="Seasons"
            onAddCustomOption={async (value) => handleAddCustomOption('season', value)}
            onToggle={(value) => setSelectedSeasons((current) => toggleMetadataOption(current, value))}
            options={seasonOptions}
            selected={selectedSeasons}
          />
          <View style={styles.optionGroup}>
            <Text style={styles.optionLabel}>Notes</Text>
            <AppTextInput
              editable={!savingChanges}
              multiline
              onChangeText={setNotes}
              placeholder="Add notes about fit, condition, styling, etc."
              style={[styles.input, styles.textArea]}
              value={notes}
            />
          </View>
          <SectionHeader title="Closets" />
          <View style={styles.optionGroup}>
            <Text style={styles.optionLabel}>Assigned Closets</Text>
            <Pressable disabled={savingChanges} onPress={() => setClosetPickerVisible(true)} style={styles.combobox}>
              <Text numberOfLines={1} style={selectedClosetNames.length ? styles.valueText : styles.valueMuted}>
                {selectedClosetNames.length ? selectedClosetNames.join(', ') : 'Select closets'}
              </Text>
              <Ionicons color="#0A0A0A" name="chevron-down" size={18} />
            </Pressable>
          </View>

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
      <Modal animationType="fade" transparent visible={isClosetPickerVisible}>
        <Pressable onPress={() => setClosetPickerVisible(false)} style={styles.pickerBackdrop}>
          <Pressable onPress={() => undefined} style={[styles.pickerSheet, { marginBottom: Math.max(insets.bottom, 12) + 10 }]}>
            <Text style={styles.pickerTitle}>Select Closets</Text>
            <AppTextInput
              autoCapitalize="none"
              editable={!savingChanges}
              onChangeText={setClosetSearch}
              placeholder="Search closets"
              style={styles.searchInput}
              value={closetSearch}
            />
            <ScrollView contentContainerStyle={styles.pickerList}>
              {filteredClosets.map((closet) => {
                const selected = selectedClosetIds.includes(closet.id);
                return (
                  <Pressable key={closet.id} onPress={() => toggleClosetSelection(closet.id)} style={styles.pickerRow}>
                    <Text style={styles.pickerRowLabel}>{closet.name}</Text>
                    <Ionicons color={selected ? '#0A0A0A' : '#B8B8BE'} name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={20} />
                  </Pressable>
                );
              })}
              {!filteredClosets.length ? <Text style={styles.valueMuted}>No closets found.</Text> : null}
            </ScrollView>
            <View style={styles.pickerActions}>
              <AppButton label="Done" onPress={() => setClosetPickerVisible(false)} style={styles.pickerDone} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal animationType="fade" transparent visible={savingChanges}>
        <View style={styles.savingBackdrop}>
          <View style={styles.savingCard}>
            <ActivityIndicator color="#0A0A0A" size="small" />
            <Text style={styles.savingText}>Saving changes...</Text>
          </View>
        </View>
      </Modal>
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
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  priceRow: {
    flexDirection: 'row',
    gap: 8
  },
  priceAmountInput: {
    flex: 1
  },
  priceCurrencyInput: {
    width: 96
  },
  combobox: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  textArea: {
    minHeight: 90
  },
  carouselWrap: {
    gap: 10
  },
  mainImage: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 18,
    backgroundColor: '#E8E8E8'
  },
  carouselDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C7C7CE'
  },
  carouselDotActive: {
    width: 18,
    borderRadius: 4,
    backgroundColor: '#0A0A0A'
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
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.35)',
    justifyContent: 'flex-end',
    paddingHorizontal: 14
  },
  pickerSheet: {
    backgroundColor: '#FAFAFA',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    maxHeight: '65%'
  },
  pickerTitle: {
    color: '#0A0A0A',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8
  },
  searchInput: {
    marginBottom: 8
  },
  pickerList: {
    gap: 2,
    paddingBottom: 6
  },
  pickerRow: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  pickerRowLabel: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '500'
  },
  pickerActions: {
    paddingTop: 8
  },
  pickerDone: {
    marginTop: 2
  },
  savingBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  savingCard: {
    minWidth: 150,
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  savingText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '600'
  }
});
