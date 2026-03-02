import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../../services/AuthContext';
import { listClosets } from '../../services/closetService';
import { addExtraImages, assignItemToClosets, createItem, deleteItem, updatePrimaryImagePath } from '../../services/itemService';
import type { LocalImage } from '../../services/mediaService';
import { pickImageFromCamera, pickImageFromLibrary, uploadImage } from '../../services/mediaService';
import { buildItemExtraImagePath, buildItemPrimaryImagePath } from '../../services/storagePaths';
import type { Database } from '../../types/database';
import type { AppStackParamList } from '../../types/navigation';
import { withRetry } from '../../utils/retry';
import { validateCurrency, validateCustomFieldsJson, validateItemName, validatePrice } from '../../utils/validation';

type Props = NativeStackScreenProps<AppStackParamList, 'AddItem'>;
type ClosetRow = Database['public']['Tables']['closets']['Row'];

const parseCsv = (value: string) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

export default function AddItemScreen({ navigation }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [clothingType, setClothingType] = useState('');
  const [color, setColor] = useState('');
  const [priceAmount, setPriceAmount] = useState('');
  const [priceCurrency, setPriceCurrency] = useState('USD');
  const [seasonCsv, setSeasonCsv] = useState('');
  const [materialCsv, setMaterialCsv] = useState('');
  const [customFieldsText, setCustomFieldsText] = useState('{}');
  const [primaryImage, setPrimaryImage] = useState<LocalImage | null>(null);
  const [extraImages, setExtraImages] = useState<LocalImage[]>([]);
  const [closets, setClosets] = useState<ClosetRow[]>([]);
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
        createItem({
          userId,
          name,
          primaryImagePath: 'pending',
          brand,
          clothingType,
          color,
          priceAmount,
          priceCurrency,
          season: parseCsv(seasonCsv),
          material: parseCsv(materialCsv),
          customFields: parsedCustomFields
        })
      );
      createdItemId = created.id;

      const primaryPath = buildItemPrimaryImagePath(userId, created.id, primaryImage.extension);
      await withRetry(() => uploadImage('items', primaryPath, primaryImage));
      await withRetry(() => updatePrimaryImagePath(created.id, primaryPath));

      if (extraImages.length) {
        const uploadedPaths: string[] = [];
        for (const image of extraImages) {
          const path = buildItemExtraImagePath(userId, created.id, image.extension);
          await withRetry(() => uploadImage('items', path, image));
          uploadedPaths.push(path);
        }
        await withRetry(() => addExtraImages(created.id, uploadedPaths));
      }

      if (selectedClosetIds.length) {
        await withRetry(() => assignItemToClosets(created.id, selectedClosetIds));
      }

      Alert.alert('Item added', 'Your wardrobe item has been saved.');
      navigation.goBack();
    } catch (error) {
      if (createdItemId) {
        const rollbackItemId = createdItemId;
        await withRetry(() => deleteItem(rollbackItemId)).catch(() => undefined);
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
      <TextInput editable={!loading} onChangeText={setBrand} placeholder="Brand" style={styles.input} value={brand} />
      <TextInput editable={!loading} onChangeText={setClothingType} placeholder="Clothing Type (e.g. jacket)" style={styles.input} value={clothingType} />
      <TextInput editable={!loading} onChangeText={setColor} placeholder="Color" style={styles.input} value={color} />
      <TextInput editable={!loading} keyboardType="decimal-pad" onChangeText={setPriceAmount} placeholder="Price (e.g. 39.99)" style={styles.input} value={priceAmount} />
      <TextInput editable={!loading} autoCapitalize="characters" maxLength={3} onChangeText={setPriceCurrency} placeholder="Currency (USD)" style={styles.input} value={priceCurrency} />
      <TextInput editable={!loading} onChangeText={setMaterialCsv} placeholder="Materials (comma separated)" style={styles.input} value={materialCsv} />
      <TextInput editable={!loading} onChangeText={setSeasonCsv} placeholder="Seasons (comma separated)" style={styles.input} value={seasonCsv} />
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
