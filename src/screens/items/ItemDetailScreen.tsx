import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { listClosets } from '../../services/closetService';
import { useAuth } from '../../services/AuthContext';
import { deleteItem, deleteItemViaBackend, getItem, listItemClosetMappings, listItemImages } from '../../services/itemService';
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

export default function ItemDetailScreen({ navigation, route }: Props) {
  const { itemId } = route.params;
  const { session } = useAuth();

  const [item, setItem] = useState<ItemRow | null>(null);
  const [extraImages, setExtraImages] = useState<ItemImageRow[]>([]);
  const [selectedClosetNames, setSelectedClosetNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const [itemRow, imageRows, closetRows, mappingRows] = await Promise.all([
        withRetry(() => getItem(itemId)),
        withRetry(() => listItemImages(itemId)),
        withRetry(() => listClosets()),
        withRetry(() => listItemClosetMappings())
      ]);

      setItem(itemRow);
      setExtraImages(imageRows);

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
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const selectedBrands = useMemo(() => parseCommaValues(item?.brand ?? null), [item?.brand]);
  const selectedTypes = useMemo(() => parseCommaValues(item?.clothing_type ?? null), [item?.clothing_type]);
  const selectedColors = useMemo(() => parseCommaValues(item?.color ?? null), [item?.color]);

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
          <ActivityIndicator color="#1f4d3d" />
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
          <View style={styles.input}>
            <Text style={styles.valueText}>{item.primary_image_path.split('/').pop() || item.primary_image_path}</Text>
          </View>

          <Text style={styles.sectionTitle}>Metadata</Text>
          <ReadonlyField label="Item Name" value={item.name} />
          <OptionChips label="Brand" values={selectedBrands} />
          <OptionChips label="Clothing Type" values={selectedTypes} />
          <OptionChips label="Color" values={selectedColors} />
          <ReadonlyField
            label="Price"
            value={item.price_amount ? `${item.price_currency || 'USD'} ${item.price_amount}` : 'N/A'}
          />
          <OptionChips label="Materials" values={item.material ?? []} />
          <OptionChips label="Seasons" values={item.season ?? []} />
          <ReadonlyField
            label="Custom Fields"
            value={item.custom_fields ? JSON.stringify(item.custom_fields, null, 2) : 'N/A'}
            multiline
          />

          <Text style={styles.sectionTitle}>Closets</Text>
          <OptionChips label="Selected Closets" values={selectedClosetNames} />

          <Text style={styles.sectionTitle}>Extra Outfit Photos</Text>
          <ReadonlyField label="Count" value={`${extraImages.length}`} />
          {extraImages.length ? (
            <View style={styles.optionList}>
              {extraImages.map((image) => (
                <View key={image.id} style={styles.chip}>
                  <Text style={styles.chipText}>{image.image_path.split('/').pop() || image.image_path}</Text>
                </View>
              ))}
            </View>
          ) : null}

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

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f1e8',
    gap: 10
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#222'
  },
  optionGroup: {
    gap: 8
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222'
  },
  optionList: {
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
  input: {
    borderWidth: 1,
    borderColor: '#d6d0c5',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  textArea: {
    minHeight: 90
  },
  valueText: {
    color: '#2d2d2d'
  },
  valueMuted: {
    color: '#666'
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
  errorCard: {
    borderWidth: 1,
    borderColor: '#e1bcbc',
    borderRadius: 10,
    backgroundColor: '#f9eaea',
    padding: 12,
    gap: 8
  },
  errorText: {
    color: '#8f2424',
    fontWeight: '600'
  },
  danger: {
    marginTop: 12,
    backgroundColor: '#8f2424',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 14
  },
  dangerText: {
    color: '#fff',
    fontWeight: '700'
  },
  disabled: {
    opacity: 0.65
  }
});
