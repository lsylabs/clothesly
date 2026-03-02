import type { ItemMetadataCategory } from '../../services/itemMetadataOptionService';

export const DEFAULT_ITEM_METADATA_OPTIONS: Record<ItemMetadataCategory, string[]> = {
  brand: ['Nike', 'Adidas', 'Uniqlo', 'Zara', "Levi's", 'H&M', 'Patagonia', 'Lululemon', 'The North Face', 'Gap'],
  clothing_type: ['T-Shirt', 'Shirt', 'Sweater', 'Hoodie', 'Jacket', 'Coat', 'Jeans', 'Pants', 'Skirt', 'Dress', 'Shorts'],
  color: ['Black', 'White', 'Gray', 'Navy', 'Blue', 'Green', 'Red', 'Pink', 'Purple', 'Brown', 'Beige', 'Yellow'],
  material: ['Cotton', 'Denim', 'Wool', 'Linen', 'Silk', 'Polyester', 'Nylon', 'Leather', 'Cashmere', 'Rayon'],
  season: ['Spring', 'Summer', 'Fall', 'Winter']
};

export const EMPTY_ITEM_METADATA_OPTIONS: Record<ItemMetadataCategory, string[]> = {
  brand: [],
  clothing_type: [],
  color: [],
  material: [],
  season: []
};

export const mergeMetadataOptions = (defaultOptions: string[], customOptions: string[]) => {
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

export const toggleMetadataOption = (current: string[], value: string) =>
  current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];

export const parseCommaValues = (value: string | null) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
