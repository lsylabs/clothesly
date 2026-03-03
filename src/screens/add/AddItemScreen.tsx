import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MetadataOptionSelector from '../../components/MetadataOptionSelector';
import AppButton from '../../components/ui/AppButton';
import AppTextInput from '../../components/ui/AppTextInput';
import {
  DEFAULT_ITEM_METADATA_OPTIONS,
  EMPTY_ITEM_METADATA_OPTIONS,
  mergeMetadataOptions,
  toggleMetadataOption
} from '../../features/items/metadataOptions';
import { useAuth } from '../../services/AuthContext';
import { listClosets } from '../../services/closetService';
import { createItemMetadataOption, listItemMetadataOptions, type ItemMetadataCategory } from '../../services/itemMetadataOptionService';
import { createItemViaBackend, deleteItem, deleteItemViaBackend, finalizeItemViaBackend } from '../../services/itemService';
import type { LocalImage } from '../../services/mediaService';
import { pickImageFromCamera, pickImagesFromLibrary, uploadImage } from '../../services/mediaService';
import { buildItemExtraImagePath, buildItemPrimaryImagePath } from '../../services/storagePaths';
import { refreshWardrobeData } from '../../services/wardrobeDataService';
import type { Database } from '../../types/database';
import type { AppStackParamList } from '../../types/navigation';
import { withRetry } from '../../utils/retry';
import { validateCurrency, validateItemName, validatePrice } from '../../utils/validation';

type Props = NativeStackScreenProps<AppStackParamList, 'AddItem'>;
type ClosetRow = Database['public']['Tables']['closets']['Row'];
const MAX_ITEM_IMAGES = 5;

export default function AddItemScreen({ navigation }: Props) {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const userId = session?.user.id;
  const accessToken = session?.access_token;

  const [name, setName] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedClothingTypes, setSelectedClothingTypes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [priceAmount, setPriceAmount] = useState('');
  const [priceCurrency, setPriceCurrency] = useState('USD');
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<LocalImage[]>([]);
  const [closets, setClosets] = useState<ClosetRow[]>([]);
  const [customOptions, setCustomOptions] = useState<Record<ItemMetadataCategory, string[]>>(EMPTY_ITEM_METADATA_OPTIONS);
  const [selectedClosetIds, setSelectedClosetIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const allowExitRef = useRef(false);

  const addImages = useCallback((incoming: LocalImage[]) => {
    if (!incoming.length) return;
    setImages((current) => {
      const dedupedIncoming = incoming.filter((image) => !current.some((existing) => existing.uri === image.uri));
      const next = [...current, ...dedupedIncoming].slice(0, MAX_ITEM_IMAGES);
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    withRetry(() => listClosets())
      .then((rows) => {
        if (active) setClosets(rows);
      })
      .catch((error) => {
        if (active) setClosets([]);
        if (active) setErrorText(error instanceof Error ? error.message : 'Could not load closets.');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setCustomOptions(EMPTY_ITEM_METADATA_OPTIONS);
      return;
    }

    let active = true;
    withRetry(() => listItemMetadataOptions())
      .then((rows) => {
        if (!active) return;
        const grouped: Record<ItemMetadataCategory, string[]> = {
          brand: [],
          clothing_type: [],
          color: [],
          material: [],
          season: []
        };
        rows.forEach((row) => {
          grouped[row.category].push(row.label);
        });
        setCustomOptions(grouped);
      })
      .catch((error) => {
        if (active) setErrorText(error instanceof Error ? error.message : 'Could not load metadata options.');
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const brandOptions = useMemo(() => mergeMetadataOptions(DEFAULT_ITEM_METADATA_OPTIONS.brand, customOptions.brand), [customOptions.brand]);
  const clothingTypeOptions = useMemo(
    () => mergeMetadataOptions(DEFAULT_ITEM_METADATA_OPTIONS.clothing_type, customOptions.clothing_type),
    [customOptions.clothing_type]
  );
  const colorOptions = useMemo(() => mergeMetadataOptions(DEFAULT_ITEM_METADATA_OPTIONS.color, customOptions.color), [customOptions.color]);
  const materialOptions = useMemo(() => mergeMetadataOptions(DEFAULT_ITEM_METADATA_OPTIONS.material, customOptions.material), [customOptions.material]);
  const seasonOptions = useMemo(() => mergeMetadataOptions(DEFAULT_ITEM_METADATA_OPTIONS.season, customOptions.season), [customOptions.season]);

  const handleAddCustomOption = async (category: ItemMetadataCategory, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!userId) {
      throw new Error('You need to sign in again before adding a custom option.');
    }

    const existingInCategory = [...DEFAULT_ITEM_METADATA_OPTIONS[category], ...customOptions[category]];
    if (existingInCategory.some((option) => option.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

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

  const hasUnsavedChanges = useMemo(
    () =>
      Boolean(
        name.trim() ||
          selectedBrands.length ||
          selectedClothingTypes.length ||
          selectedColors.length ||
          priceAmount.trim() ||
          (priceCurrency.trim() && priceCurrency.trim().toUpperCase() !== 'USD') ||
          selectedSeasons.length ||
          selectedMaterials.length ||
          notes.trim() ||
          images.length ||
          selectedClosetIds.length
      ),
    [
      images.length,
      name,
      notes,
      priceAmount,
      priceCurrency,
      selectedBrands.length,
      selectedClosetIds.length,
      selectedClothingTypes.length,
      selectedColors.length,
      selectedMaterials.length,
      selectedSeasons.length
    ]
  );

  const confirmDiscard = useCallback(
    (onDiscard: () => void) => {
      if (!hasUnsavedChanges) {
        onDiscard();
        return;
      }
      Alert.alert('Discard this item?', 'Your unsaved changes will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onDiscard }
      ]);
    },
    [hasUnsavedChanges]
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowExitRef.current || !hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      confirmDiscard(() => {
        allowExitRef.current = true;
        navigation.dispatch(event.data.action);
      });
    });

    return unsubscribe;
  }, [confirmDiscard, hasUnsavedChanges, navigation]);

  const handleSave = async () => {
    setErrorText(null);

    if (!userId) {
      setErrorText('You need to sign in again before adding an item.');
      return;
    }
    if (!accessToken) {
      setErrorText('You need to sign in again before adding an item.');
      return;
    }

    const nameValidation = validateItemName(name);
    if (!nameValidation.valid) {
      setErrorText(nameValidation.message ?? 'Invalid item name.');
      return;
    }

    if (!images.length) {
      setErrorText('Please add a primary image for this item.');
      return;
    }

    const priceValidation = validatePrice(priceAmount);
    if (!priceValidation.valid) {
      setErrorText(priceValidation.message ?? 'Invalid price.');
      return;
    }

    const currencyValidation = validateCurrency(priceCurrency);
    if (!currencyValidation.valid) {
      setErrorText(currencyValidation.message ?? 'Invalid currency.');
      return;
    }

    setLoading(true);
    let createdItemId: string | null = null;
    try {
      const created = await withRetry(() =>
        createItemViaBackend({
          accessToken,
          name,
          brand: selectedBrands.join(', '),
          clothingType: selectedClothingTypes.join(', '),
          color: selectedColors.join(', '),
          priceAmount,
          priceCurrency,
          season: selectedSeasons,
          material: selectedMaterials,
          customFields: notes.trim() ? { notes: notes.trim() } : null
        })
      );
      const itemId = created.itemId;
      createdItemId = itemId;

      const primaryImage = images[0];
      const extraImages = images.slice(1);
      const primaryPath = buildItemPrimaryImagePath(userId, itemId, primaryImage.extension);
      await withRetry(() => uploadImage('items', primaryPath, primaryImage));

      const uploadedPaths: string[] = [];
      if (extraImages.length) {
        for (const image of extraImages) {
          const path = buildItemExtraImagePath(userId, itemId, image.extension);
          await withRetry(() => uploadImage('items', path, image));
          uploadedPaths.push(path);
        }
      }

      await withRetry(() =>
        finalizeItemViaBackend({
          accessToken,
          itemId,
          primaryImagePath: primaryPath,
          extraImagePaths: uploadedPaths,
          closetIds: selectedClosetIds
        })
      );
      await refreshWardrobeData(userId).catch(() => undefined);

      Alert.alert('Item added', 'Your wardrobe item has been saved.');
      allowExitRef.current = true;
      navigation.goBack();
    } catch (error) {
      if (createdItemId) {
        const rollbackItemId = createdItemId;
        await withRetry(() => deleteItemViaBackend({ itemId: rollbackItemId, accessToken })).catch(() =>
          withRetry(() => deleteItem(rollbackItemId)).catch(() => undefined)
        );
      }
      setErrorText(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 8 }]} style={styles.screen}>
      <View style={styles.customHeader}>
        <Pressable
          hitSlop={8}
          onPress={() =>
            confirmDiscard(() => {
              allowExitRef.current = true;
              navigation.goBack();
            })
          }
          style={styles.headerCloseTap}
        >
          <Ionicons color="#0A0A0A" name="close" size={22} />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.customHeaderTitle}>Add Item</Text>
          <Text style={styles.customHeaderSubtitle}>Capture details and save to your wardrobe</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {!images.length ? (
        <View style={styles.imageStep}>
          <View style={styles.imageStepIconWrap}>
            <Ionicons color="#0A0A0A" name="image-outline" size={24} />
          </View>
          <Text style={styles.imageStepTitle}>Add Item Photos</Text>
          <Text style={styles.imageStepBody}>Add up to {MAX_ITEM_IMAGES} photos. The first photo will be the main image.</Text>
          <View style={styles.row}>
            <Pressable
              disabled={loading}
              onPress={async () => {
                try {
                  const image = await pickImageFromCamera();
                  if (image) addImages([image]);
                } catch (error) {
                  Alert.alert('Camera error', error instanceof Error ? error.message : 'Could not open camera');
                }
              }}
              style={[styles.secondary, loading && styles.disabled]}
            >
              <Text style={styles.secondaryText}>Camera</Text>
            </Pressable>
            <Pressable
              disabled={loading}
              onPress={async () => {
                const selection = await pickImagesFromLibrary(MAX_ITEM_IMAGES);
                addImages(selection);
              }}
              style={[styles.secondary, loading && styles.disabled]}
            >
              <Text style={styles.secondaryText}>Album</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {images.length ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionEyebrow}>Photo</Text>
            <Text style={styles.sectionTitle}>Item Photos ({images.length}/{MAX_ITEM_IMAGES})</Text>
            <Image source={{ uri: images[0].uri }} style={styles.mainImage} />
            <ScrollView contentContainerStyle={styles.thumbnailRow} horizontal showsHorizontalScrollIndicator={false}>
              {images.map((image, index) => (
                <View key={image.uri} style={styles.thumbWrap}>
                  <Pressable
                    onPress={() => {
                      if (loading || index === 0) return;
                      setImages((current) => {
                        const next = [...current];
                        const [picked] = next.splice(index, 1);
                        next.unshift(picked);
                        return next;
                      });
                    }}
                  >
                    <Image source={{ uri: image.uri }} style={[styles.thumbImage, index === 0 && styles.thumbPrimary]} />
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      if (loading) return;
                      setImages((current) => current.filter((_, currentIndex) => currentIndex !== index));
                    }}
                    style={styles.thumbRemove}
                  >
                    <Ionicons color="#FAFAFA" name="close" size={12} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <View style={styles.row}>
              <Pressable
                disabled={loading || images.length >= MAX_ITEM_IMAGES}
                onPress={async () => {
                  try {
                    const image = await pickImageFromCamera();
                    if (image) addImages([image]);
                  } catch (error) {
                    Alert.alert('Camera error', error instanceof Error ? error.message : 'Could not open camera');
                  }
                }}
                style={[styles.secondary, loading && styles.disabled]}
              >
                <Text style={styles.secondaryText}>Add Camera</Text>
              </Pressable>
              <Pressable
                disabled={loading || images.length >= MAX_ITEM_IMAGES}
                onPress={async () => {
                  const selection = await pickImagesFromLibrary(MAX_ITEM_IMAGES - images.length);
                  addImages(selection);
                }}
                style={[styles.secondary, loading && styles.disabled]}
              >
                <Text style={styles.secondaryText}>Add Album</Text>
              </Pressable>
            </View>
            <Text style={styles.fileText}>Tap a thumbnail to make it the cover image.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionEyebrow}>Details</Text>
            <Text style={styles.sectionTitle}>Item Details</Text>
            <AppTextInput editable={!loading} onChangeText={setName} placeholder="Item Name *" style={styles.input} value={name} />
            <MetadataOptionSelector
              disabled={loading}
              label="Brand"
              onAddCustomOption={async (value) => handleAddCustomOption('brand', value)}
              onToggle={(value) => setSelectedBrands((current) => toggleMetadataOption(current, value))}
              options={brandOptions}
              selected={selectedBrands}
            />
            <MetadataOptionSelector
              disabled={loading}
              label="Clothing Type"
              onAddCustomOption={async (value) => handleAddCustomOption('clothing_type', value)}
              onToggle={(value) => setSelectedClothingTypes((current) => toggleMetadataOption(current, value))}
              options={clothingTypeOptions}
              selected={selectedClothingTypes}
            />
            <MetadataOptionSelector
              disabled={loading}
              label="Color"
              onAddCustomOption={async (value) => handleAddCustomOption('color', value)}
              onToggle={(value) => setSelectedColors((current) => toggleMetadataOption(current, value))}
              options={colorOptions}
              selected={selectedColors}
            />
            <AppTextInput
              editable={!loading}
              keyboardType="decimal-pad"
              onChangeText={setPriceAmount}
              placeholder="Price (e.g. 39.99)"
              style={styles.input}
              value={priceAmount}
            />
            <AppTextInput
              autoCapitalize="characters"
              editable={!loading}
              maxLength={3}
              onChangeText={setPriceCurrency}
              placeholder="Currency (USD)"
              style={styles.input}
              value={priceCurrency}
            />
            <MetadataOptionSelector
              disabled={loading}
              label="Materials"
              onAddCustomOption={async (value) => handleAddCustomOption('material', value)}
              onToggle={(value) => setSelectedMaterials((current) => toggleMetadataOption(current, value))}
              options={materialOptions}
              selected={selectedMaterials}
            />
            <MetadataOptionSelector
              disabled={loading}
              label="Seasons"
              onAddCustomOption={async (value) => handleAddCustomOption('season', value)}
              onToggle={(value) => setSelectedSeasons((current) => toggleMetadataOption(current, value))}
              options={seasonOptions}
              selected={selectedSeasons}
            />
            <AppTextInput
              editable={!loading}
              multiline
              onChangeText={setNotes}
              placeholder="Notes (optional)"
              style={[styles.input, styles.textArea]}
              value={notes}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionEyebrow}>Organize</Text>
            <Text style={styles.sectionTitle}>Closets</Text>
            {closets.length ? (
              <View style={styles.closetList}>
                {closets.map((closet) => {
                  const selected = selectedClosetIds.includes(closet.id);
                  return (
                    <Pressable
                      key={closet.id}
                      onPress={() => {
                        if (loading) return;
                        setSelectedClosetIds((current) => (selected ? current.filter((id) => id !== closet.id) : [...current, closet.id]));
                      }}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{closet.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.muted}>No closets yet. You can still save item with no closet.</Text>
            )}
          </View>

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          <AppButton label="Save Item" loading={loading} loadingLabel="Saving..." onPress={handleSave} style={styles.primary} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAFA'
  },
  container: {
    padding: 18,
    backgroundColor: '#FAFAFA',
    flexGrow: 1,
    gap: 14
  },
  customHeader: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTextWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12
  },
  customHeaderTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0A0A0A',
    letterSpacing: -0.8
  },
  customHeaderSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: '#5A5A61'
  },
  headerSpacer: {
    width: 30
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#8B8B93',
    marginBottom: 4
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0A0A0A',
    letterSpacing: -0.7,
    marginBottom: 10
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  card: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9E9EE',
    padding: 16,
    gap: 10,
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6
  },
  imageStep: {
    minHeight: 320,
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CFCFD6',
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 24
  },
  imageStepIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F8'
  },
  imageStepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0A0A0A',
    letterSpacing: -0.6
  },
  imageStepBody: {
    color: '#5A5A61',
    fontSize: 15,
    lineHeight: 22
  },
  mainImage: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 16,
    backgroundColor: '#F5F5F5'
  },
  thumbnailRow: {
    gap: 10
  },
  thumbWrap: {
    marginTop: 4
  },
  thumbImage: {
    width: 68,
    height: 68,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DFDFE6',
    backgroundColor: '#F5F5F5'
  },
  thumbPrimary: {
    borderColor: '#0A0A0A'
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A'
  },
  secondary: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#D9D9DF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F7F7FA'
  },
  secondaryText: {
    color: '#0A0A0A',
    fontWeight: '600'
  },
  fileText: {
    color: '#0A0A0A'
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#DFDFE6',
    borderRadius: 14,
    backgroundColor: '#FBFBFD',
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top'
  },
  closetList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    borderWidth: 1.5,
    borderColor: '#DFDFE6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FBFBFD'
  },
  chipSelected: {
    backgroundColor: '#ECECF2',
    borderColor: '#D6D6E0'
  },
  chipText: {
    color: '#0A0A0A',
    fontWeight: '500'
  },
  chipTextSelected: {
    color: '#0A0A0A'
  },
  muted: {
    color: '#5A5A61'
  },
  primary: {
    marginTop: 4,
    marginBottom: 18
  },
  disabled: {
    opacity: 0.65
  },
  errorText: {
    color: '#DC2626',
    fontWeight: '600'
  },
  headerCloseTap: {
    paddingHorizontal: 4,
    paddingVertical: 2
  }
});
