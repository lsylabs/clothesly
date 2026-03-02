import type { Json } from '../types/database';
import { supabase } from './supabase';

export type CreateItemInput = {
  userId: string;
  name: string;
  primaryImagePath: string;
  brand?: string;
  clothingType?: string;
  color?: string;
  priceAmount?: string;
  priceCurrency?: string;
  season?: string[];
  material?: string[];
  customFields?: Json | null;
};

export async function listItems() {
  const { data, error } = await supabase.from('clothing_items').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listItemClosetMappings() {
  const { data, error } = await supabase.from('clothing_item_closets').select('*');
  if (error) throw error;
  return data;
}

export async function getItem(itemId: string) {
  const { data, error } = await supabase.from('clothing_items').select('*').eq('id', itemId).single();
  if (error) throw error;
  return data;
}

export async function listItemImages(itemId: string) {
  const { data, error } = await supabase
    .from('clothing_item_images')
    .select('*')
    .eq('item_id', itemId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createItem(input: CreateItemInput) {
  const { data, error } = await supabase
    .from('clothing_items')
    .insert({
      user_id: input.userId,
      name: input.name.trim(),
      primary_image_path: input.primaryImagePath,
      brand: input.brand?.trim() || null,
      clothing_type: input.clothingType?.trim() || null,
      color: input.color?.trim() || null,
      price_amount: input.priceAmount?.trim() || null,
      price_currency: input.priceCurrency?.trim() || 'USD',
      season: input.season?.length ? input.season : null,
      material: input.material?.length ? input.material : null,
      custom_fields: input.customFields ?? null
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updatePrimaryImagePath(itemId: string, primaryImagePath: string) {
  const { data, error } = await supabase
    .from('clothing_items')
    .update({ primary_image_path: primaryImagePath })
    .eq('id', itemId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function addExtraImages(itemId: string, imagePaths: string[]) {
  if (!imagePaths.length) return [];

  const { data, error } = await supabase
    .from('clothing_item_images')
    .insert(
      imagePaths.map((path, index) => ({
        item_id: itemId,
        image_path: path,
        sort_order: index
      }))
    )
    .select('*');

  if (error) throw error;
  return data;
}

export async function assignItemToClosets(itemId: string, closetIds: string[]) {
  if (!closetIds.length) return [];

  const rows = closetIds.map((closetId) => ({
    item_id: itemId,
    closet_id: closetId
  }));

  const { data, error } = await supabase.from('clothing_item_closets').insert(rows).select('*');
  if (error) throw error;
  return data;
}

export async function deleteItem(itemId: string) {
  const { error } = await supabase.from('clothing_items').delete().eq('id', itemId);
  if (error) throw error;
}
