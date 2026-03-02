import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

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

export default function ItemCollectionView({ title, items, imageUrls, onPressItem, onPressAdd, addLabel = 'Add Item' }: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.itemGrid}>
        {items.map((item) => (
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
