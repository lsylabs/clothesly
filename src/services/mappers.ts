import type { Database } from '../types/database';
import type { Closet, ClothingItem, ClothingItemCloset, ClothingItemImage, Profile } from '../types/domain';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ClosetRow = Database['public']['Tables']['closets']['Row'];
type ClothingItemRow = Database['public']['Tables']['clothing_items']['Row'];
type ClothingItemImageRow = Database['public']['Tables']['clothing_item_images']['Row'];
type ClothingItemClosetRow = Database['public']['Tables']['clothing_item_closets']['Row'];

export const mapProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  fullName: row.full_name,
  username: row.username,
  avatarPath: row.avatar_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const mapCloset = (row: ClosetRow): Closet => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  coverImagePath: row.cover_image_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const mapClothingItem = (row: ClothingItemRow): ClothingItem => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  primaryImagePath: row.primary_image_path,
  brand: row.brand,
  priceAmount: row.price_amount,
  priceCurrency: row.price_currency,
  clothingType: row.clothing_type,
  color: row.color,
  season: row.season,
  material: row.material,
  customFields: row.custom_fields,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const mapClothingItemImage = (row: ClothingItemImageRow): ClothingItemImage => ({
  id: row.id,
  itemId: row.item_id,
  imagePath: row.image_path,
  sortOrder: row.sort_order,
  createdAt: row.created_at
});

export const mapClothingItemCloset = (row: ClothingItemClosetRow): ClothingItemCloset => ({
  itemId: row.item_id,
  closetId: row.closet_id,
  createdAt: row.created_at
});
