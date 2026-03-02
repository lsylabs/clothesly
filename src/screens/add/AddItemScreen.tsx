import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../../services/AuthContext';
import { listClosets } from '../../services/closetService';
import { createItemMetadataOption, listItemMetadataOptions, type ItemMetadataCategory } from '../../services/itemMetadataOptionService';
import { createItemViaBackend, deleteItem, deleteItemViaBackend, finalizeItemViaBackend } from '../../services/itemService';
import type { LocalImage } from '../../services/mediaService';
import { pickImageFromCamera, pickImageFromLibrary, uploadImage } from '../../services/mediaService';
import { buildItemExtraImagePath, buildItemPrimaryImagePath } from '../../services/storagePaths';
import type { Database } from '../../types/database';
import type { AppStackParamList } from '../../types/navigation';
import { withRetry } from '../../utils/retry';
import { validateCurrency, validateCustomFieldsJson, validateItemName, validatePrice } from '../../utils/validation';

type Props = NativeStackScreenProps<AppStackParamList, 'AddItem'>;
type ClosetRow = Database['public']['Tables']['closets']['Row'];

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

const toggleOption = (current: string[], value: string) =>
  current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];

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

type OptionSelectorProps = {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onAddCustomOption: (value: string) => Promise<void>;
  disabled?: boolean;
};

function OptionSelector({ label, options, selected, onToggle, onAddCustomOption, disabled = false }: OptionSelectorProps) {
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
              key={option}
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

export default function AddItemScreen({ navigation }: Props) {
  const { session } = useAuth();
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
  const [customOptions, setCustomOptions] = useState<Record<ItemMetadataCategory, string[]>>(EMPTY_CUSTOM_OPTIONS);
  const [selectedClosetIds, setSelectedClosetIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

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
      setCustomOptions(EMPTY_CUSTOM_OPTIONS);
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

  const brandOptions = useMemo(() => mergeOptions(DEFAULT_OPTIONS.brand, customOptions.brand), [customOptions.brand]);
  const clothingTypeOptions = useMemo(
    () => mergeOptions(DEFAULT_OPTIONS.clothing_type, customOptions.clothing_type),
    [customOptions.clothing_type]
  );
  const colorOptions = useMemo(() => mergeOptions(DEFAULT_OPTIONS.color, customOptions.color), [customOptions.color]);
  const materialOptions = useMemo(() => mergeOptions(DEFAULT_OPTIONS.material, customOptions.material), [customOptions.material]);
  const seasonOptions = useMemo(() => mergeOptions(DEFAULT_OPTIONS.season, customOptions.season), [customOptions.season]);

  const handleAddCustomOption = async (category: ItemMetadataCategory, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!userId) {
      throw new Error('You need to sign in again before adding a custom option.');
    }

    const existingInCategory = [...DEFAULT_OPTIONS[category], ...customOptions[category]];
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

      Alert.alert('Item added', 'Your wardrobe item has been saved.');
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>Main Image</Text>
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
      <Text style={styles.fileText}>{primaryImage ? `Selected: ${primaryImage.uri.split('/').pop()}` : 'No image selected'}</Text>

      <Text style={styles.sectionTitle}>Metadata</Text>
      <TextInput editable={!loading} onChangeText={setName} placeholder="Item Name *" style={styles.input} value={name} />
      <OptionSelector
        disabled={loading}
        label="Brand"
        onAddCustomOption={async (value) => handleAddCustomOption('brand', value)}
        onToggle={(value) => setSelectedBrands((current) => toggleOption(current, value))}
        options={brandOptions}
        selected={selectedBrands}
      />
      <OptionSelector
        disabled={loading}
        label="Clothing Type"
        onAddCustomOption={async (value) => handleAddCustomOption('clothing_type', value)}
        onToggle={(value) => setSelectedClothingTypes((current) => toggleOption(current, value))}
        options={clothingTypeOptions}
        selected={selectedClothingTypes}
      />
      <OptionSelector
        disabled={loading}
        label="Color"
        onAddCustomOption={async (value) => handleAddCustomOption('color', value)}
        onToggle={(value) => setSelectedColors((current) => toggleOption(current, value))}
        options={colorOptions}
        selected={selectedColors}
      />
      <TextInput editable={!loading} keyboardType="decimal-pad" onChangeText={setPriceAmount} placeholder="Price (e.g. 39.99)" style={styles.input} value={priceAmount} />
      <TextInput editable={!loading} autoCapitalize="characters" maxLength={3} onChangeText={setPriceCurrency} placeholder="Currency (USD)" style={styles.input} value={priceCurrency} />
      <OptionSelector
        disabled={loading}
        label="Materials"
        onAddCustomOption={async (value) => handleAddCustomOption('material', value)}
        onToggle={(value) => setSelectedMaterials((current) => toggleOption(current, value))}
        options={materialOptions}
        selected={selectedMaterials}
      />
      <OptionSelector
        disabled={loading}
        label="Seasons"
        onAddCustomOption={async (value) => handleAddCustomOption('season', value)}
        onToggle={(value) => setSelectedSeasons((current) => toggleOption(current, value))}
        options={seasonOptions}
        selected={selectedSeasons}
      />
      <TextInput editable={!loading} multiline onChangeText={setCustomFieldsText} placeholder='Custom Fields JSON, e.g. {"fit":"oversized"}' style={[styles.input, styles.textArea]} value={customFieldsText} />

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
      <Pressable
        disabled={loading}
        onPress={async () => {
          const image = await pickImageFromLibrary();
          if (image) setExtraImages((current) => [...current, image]);
        }}
        style={[styles.secondarySingle, loading && styles.disabled]}
      >
        <Text style={styles.secondaryText}>Add Extra Photo</Text>
      </Pressable>
      <Text style={styles.fileText}>{extraImages.length ? `${extraImages.length} extra image(s) selected` : 'No extra images selected'}</Text>
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

      <Pressable disabled={loading} onPress={handleSave} style={[styles.primary, loading && styles.disabled]}>
        <Text style={styles.primaryText}>{loading ? 'Saving...' : 'Save Item'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f1e8',
    gap: 10
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#222'
  },
  row: {
    flexDirection: 'row',
    gap: 10
  },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1f4d3d',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  secondarySingle: {
    borderWidth: 1,
    borderColor: '#1f4d3d',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  secondaryText: {
    color: '#1f4d3d',
    fontWeight: '600'
  },
  fileText: {
    color: '#555'
  },
  input: {
    borderWidth: 1,
    borderColor: '#d6d0c5',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top'
  },
  optionGroup: {
    gap: 8
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222'
  },
  addOptionButton: {
    borderWidth: 1,
    borderColor: '#1f4d3d',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fff'
  },
  addOptionButtonText: {
    color: '#1f4d3d',
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
    borderColor: '#c8c1b4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff'
  },
  addOptionConfirm: {
    borderColor: '#1f4d3d'
  },
  addOptionActionText: {
    color: '#2d2d2d',
    fontWeight: '600'
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  closetList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    borderWidth: 1,
    borderColor: '#c8c1b4',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#fff'
  },
  chipSelected: {
    backgroundColor: '#1f4d3d',
    borderColor: '#1f4d3d'
  },
  chipText: {
    color: '#2d2d2d',
    fontWeight: '500'
  },
  chipTextSelected: {
    color: '#fff'
  },
  muted: {
    color: '#666'
  },
  primary: {
    marginTop: 12,
    backgroundColor: '#1f4d3d',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 14
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700'
  },
  disabled: {
    opacity: 0.65
  },
  errorText: {
    color: '#8f2424',
    fontWeight: '600'
  }
});
