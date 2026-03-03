import type { Json } from './database';

export type Profile = {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarPath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Closet = {
  id: string;
  userId: string;
  name: string;
  coverImagePath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClothingItem = {
  id: string;
  userId: string;
  name: string;
  primaryImagePath: string;
  brand: string | null;
  priceAmount: string | null;
  priceCurrency: string | null;
  clothingType: string | null;
  color: string | null;
  season: string[] | null;
  material: string[] | null;
  customFields: Json | null;
  createdAt: string;
  updatedAt: string;
};

export type ClothingItemImage = {
  id: string;
  itemId: string;
  imagePath: string;
  sortOrder: number;
  createdAt: string;
};

export type ClothingItemCloset = {
  itemId: string;
  closetId: string;
  createdAt: string;
};
