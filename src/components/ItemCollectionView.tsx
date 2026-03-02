import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Database } from '../types/database';

type ItemRow = Database['public']['Tables']['clothing_items']['Row'];

type Props = {
  title: string;
  items: ItemRow[];
  imageUrls: Record<string, string>;
  onPressItem: (itemId: string) => void;
  onPressAdd: () => void;
  addLabel?: string;
};

const CATEGORY_ORDER = ['Tops', 'Pants', 'Jackets', 'Dresses', 'Skirts', 'Shorts', 'Shoes', 'Other'] as const;

const parseTypes = (value: string | null) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

const typeToCategory = (type: string): string => {
  if (['t-shirt', 'shirt', 'sweater', 'hoodie', 'top', 'tank', 'blouse'].some((token) => type.includes(token))) return 'Tops';
  if (['pants', 'jeans', 'trouser', 'chino', 'jogger', 'legging'].some((token) => type.includes(token))) return 'Pants';
  if (['jacket', 'coat', 'blazer', 'parka', 'outerwear'].some((token) => type.includes(token))) return 'Jackets';
  if (['dress', 'gown'].some((token) => type.includes(token))) return 'Dresses';
  if (['skirt'].some((token) => type.includes(token))) return 'Skirts';
  if (['shorts'].some((token) => type.includes(token))) return 'Shorts';
  if (['shoe', 'sneaker', 'boot', 'heel', 'loafer', 'sandal'].some((token) => type.includes(token))) return 'Shoes';
  return 'Other';
};

const categoriesForItem = (item: ItemRow) => {
  const types = parseTypes(item.clothing_type);
  if (!types.length) return ['Other'];
  const categories = Array.from(new Set(types.map(typeToCategory)));
  return categories.length ? categories : ['Other'];
};

export default function ItemCollectionView({ title, items, imageUrls, onPressItem, onPressAdd, addLabel = 'Add Item' }: Props) {
  const [selectedCategory, setSelectedCategory] = useState('All');

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      categoriesForItem(item).forEach((category) => set.add(category));
    });
    const ordered = CATEGORY_ORDER.filter((category) => set.has(category));
    return ['All', ...ordered];
  }, [items]);

  useEffect(() => {
    if (!availableCategories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [availableCategories, selectedCategory]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'All') return items;
    return items.filter((item) => categoriesForItem(item).includes(selectedCategory));
  }, [items, selectedCategory]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>

      <ScrollView contentContainerStyle={styles.filterTabs} horizontal showsHorizontalScrollIndicator={false}>
        {availableCategories.map((category) => {
          const selected = selectedCategory === category;
          return (
            <Pressable key={category} onPress={() => setSelectedCategory(category)} style={[styles.filterTab, selected && styles.filterTabActive]}>
              <Text style={[styles.filterTabText, selected && styles.filterTabTextActive]}>{category}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.itemGrid}>
        {filteredItems.map((item) => (
          <Pressable key={item.id} onPress={() => onPressItem(item.id)} style={styles.itemTile}>
            {imageUrls[item.id] ? (
              <Image resizeMode="cover" source={{ uri: imageUrls[item.id] }} style={styles.itemImage} />
            ) : (
              <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                <Text style={styles.itemImagePlaceholderText}>No image</Text>
              </View>
            )}
            <Text numberOfLines={1} style={styles.itemTitle}>
              {item.name}
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={onPressAdd} style={[styles.itemTile, styles.addTile]}>
          <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
            <Text style={styles.addTileIcon}>+</Text>
          </View>
          <Text numberOfLines={1} style={styles.addTileLabel}>
            {addLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 21,
    fontWeight: '700',
    color: '#18191c'
  },
  filterTabs: {
    gap: 8
  },
  filterTab: {
    borderWidth: 1,
    borderColor: '#d9dce3',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  filterTabActive: {
    backgroundColor: '#141518',
    borderColor: '#141518'
  },
  filterTabText: {
    color: '#4d4f57',
    fontWeight: '600'
  },
  filterTabTextActive: {
    color: '#ffffff'
  },
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  itemTile: {
    width: '48%',
    gap: 8
  },
  itemImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: '#f6f7f9'
  },
  itemImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  itemImagePlaceholderText: {
    color: '#7a7b82',
    fontWeight: '500'
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
  itemTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#1a1b1f'
  }
});
