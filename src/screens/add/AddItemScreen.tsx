import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
  toggleMetadataOption
} from '../../features/items/metadataOptions';
import { useAuth } from '../../services/AuthContext';
import { listClosets } from '../../services/closetService';
import { createItemMetadataOption, listItemMetadataOptions, type ItemMetadataCategory } from '../../services/itemMetadataOptionService';
import { createItemViaBackend, deleteItem, deleteItemViaBackend, finalizeItemViaBackend } from '../../services/itemService';
import type { LocalImage } from '../../services/mediaService';
import { pickImageFromCamera, pickImageFromLibrary, uploadImage } from '../../services/mediaService';
import { buildItemExtraImagePath, buildItemPrimaryImagePath } from '../../services/storagePaths';
import { refreshWardrobeData } from '../../services/wardrobeDataService';
import type { Database } from '../../types/database';
import type { AppStackParamList } from '../../types/navigation';
import { withRetry } from '../../utils/retry';
import { validateCurrency, validateCustomFieldsJson, validateItemName, validatePrice } from '../../utils/validation';

type Props = NativeStackScreenProps<AppStackParamList, 'AddItem'>;
type ClosetRow = Database['public']['Tables']['closets']['Row'];

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
  const [customFieldsText, setCustomFieldsText] = useState('{}');
  const [primaryImage, setPrimaryImage] = useState<LocalImage | null>(null);
  const [extraImages, setExtraImages] = useState<LocalImage[]>([]);
  const [closets, setClosets] = useState<ClosetRow[]>([]);
  const [customOptions, setCustomOptions] = useState<Record<ItemMetadataCategory, string[]>>(EMPTY_ITEM_METADATA_OPTIONS);
  const [selectedClosetIds, setSelectedClosetIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const allowExitRef = useRef(false);

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

  const parsedCustomFields = useMemo(() => {
    try {
      const parsed = JSON.parse(customFieldsText);
      return parsed;
    } catch {
      return null;
    }
  }, [customFieldsText]);

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
          customFieldsText.trim() !== '{}' ||
          primaryImage ||
          extraImages.length ||
          selectedClosetIds.length
      ),
    [
      customFieldsText,
      extraImages.length,
      name,
      priceAmount,
      priceCurrency,
      primaryImage,
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

    if (!primaryImage) {
      setErrorText('Please add a primary image for this item.');
      return;
    }

    const customValidation = validateCustomFieldsJson(customFieldsText);
    if (!customValidation.valid) {
      setErrorText(customValidation.message ?? 'Invalid custom metadata.');
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
          customFields: parsedCustomFields
        })
      );
      const itemId = created.itemId;
      createdItemId = itemId;

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
        <Text style={styles.customHeaderTitle}>Add Item</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!primaryImage ? (
        <View style={styles.imageStep}>
          <Text style={styles.imageStepTitle}>Add A Main Image</Text>
          <Text style={styles.imageStepBody}>Start by adding a photo of your item.</Text>
          <View style={styles.row}>
            <Pressable
              disabled={loading}
              onPress={async () => {
                try {
                  const image = await pickImageFromCamera();
                  if (image) setPrimaryImage(image);
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
                const image = await pickImageFromLibrary();
                if (image) setPrimaryImage(image);
              }}
              style={[styles.secondary, loading && styles.disabled]}
            >
              <Text style={styles.secondaryText}>Album</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {primaryImage ? (
        <>
          <Text style={styles.sectionTitle}>Item Photo</Text>
          <Image source={{ uri: primaryImage.uri }} style={styles.mainImage} />
          <View style={styles.row}>
            <Pressable
              disabled={loading}
              onPress={async () => {
                try {
                  const image = await pickImageFromCamera();
                  if (image) setPrimaryImage(image);
                } catch (error) {
                  Alert.alert('Camera error', error instanceof Error ? error.message : 'Could not open camera');
                }
              }}
              style={[styles.secondary, loading && styles.disabled]}
            >
              <Text style={styles.secondaryText}>Retake</Text>
            </Pressable>
            <Pressable
              disabled={loading}
              onPress={async () => {
                const image = await pickImageFromLibrary();
                if (image) setPrimaryImage(image);
              }}
              style={[styles.secondary, loading && styles.disabled]}
            >
              <Text style={styles.secondaryText}>Replace</Text>
            </Pressable>
          </View>

          <SectionHeader title="Item Details" />
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
            onChangeText={setCustomFieldsText}
            placeholder='Custom Fields JSON, e.g. {"fit":"oversized"}'
            style={[styles.input, styles.textArea]}
            value={customFieldsText}
          />

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

          <Text style={styles.sectionTitle}>Extra Outfit Photos (optional)</Text>
          <AppButton
            disabled={loading}
            label="Add Extra Photo"
            onPress={async () => {
              const image = await pickImageFromLibrary();
              if (image) setExtraImages((current) => [...current, image]);
            }}
            style={styles.secondarySingle}
            variant="secondary"
          />
          <Text style={styles.fileText}>{extraImages.length ? `${extraImages.length} extra image(s) selected` : 'No extra images selected'}</Text>
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
    padding: 16,
    backgroundColor: '#FAFAFA',
    flexGrow: 1,
    gap: 12
  },
  customHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  customHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A0A0A'
  },
  headerSpacer: {
    width: 30
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '700',
    color: '#0A0A0A'
  },
  row: {
    flexDirection: 'row',
    gap: 12
  },
  imageStep: {
    minHeight: 280,
    justifyContent: 'center',
    gap: 12
  },
  imageStepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A0A0A'
  },
  imageStepBody: {
    color: '#0A0A0A'
  },
  mainImage: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 16,
    backgroundColor: '#F5F5F5'
  },
  secondary: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FAFAFA'
  },
  secondarySingle: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FAFAFA'
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
    borderColor: '#E0E0E0',
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
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
  muted: {
    color: '#0A0A0A'
  },
  primary: {
    marginTop: 12
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
