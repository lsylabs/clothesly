import type { Json } from '../types/database';
import { env } from '../config/env';
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

export async function updateItemCategories(input: {
  itemId: string;
  brand: string;
  clothingType: string;
  color: string;
  material: string[];
  season: string[];
}) {
  const { data, error } = await supabase
    .from('clothing_items')
    .update({
      brand: input.brand.trim() || null,
      clothing_type: input.clothingType.trim() || null,
      color: input.color.trim() || null,
      material: input.material.length ? input.material : null,
      season: input.season.length ? input.season : null
    })
    .eq('id', input.itemId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteItemViaBackend(input: { itemId: string; accessToken: string }) {
  const baseUrl = env.backendUrl.trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('Backend URL is not configured. Set EXPO_PUBLIC_BACKEND_URL.');
  }

  const response = await fetch(`${baseUrl}/v1/items/${encodeURIComponent(input.itemId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${input.accessToken}`
    }
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message =
      typeof body === 'object' && body && 'error' in body && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Delete failed with status ${response.status}`;
    throw new Error(message);
  }

  return body;
}

export async function createItemViaBackend(input: {
  accessToken: string;
  name: string;
  brand?: string;
  clothingType?: string;
  color?: string;
  priceAmount?: string;
  priceCurrency?: string;
  season?: string[];
  material?: string[];
  customFields?: Json | null;
}) {
  const baseUrl = env.backendUrl.trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('Backend URL is not configured. Set EXPO_PUBLIC_BACKEND_URL.');
  }

  const response = await fetch(`${baseUrl}/v1/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: input.name,
      brand: input.brand,
      clothingType: input.clothingType,
      color: input.color,
      priceAmount: input.priceAmount,
      priceCurrency: input.priceCurrency,
      season: input.season,
      material: input.material,
      customFields: input.customFields
    })
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === 'object' && body && 'error' in body && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Create failed with status ${response.status}`;
    throw new Error(message);
  }
  return body as { ok: true; itemId: string };
}

export async function finalizeItemViaBackend(input: {
  accessToken: string;
  itemId: string;
  primaryImagePath: string;
  extraImagePaths: string[];
  closetIds: string[];
}) {
  const baseUrl = env.backendUrl.trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('Backend URL is not configured. Set EXPO_PUBLIC_BACKEND_URL.');
  }

  const response = await fetch(`${baseUrl}/v1/items/${encodeURIComponent(input.itemId)}/finalize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      primaryImagePath: input.primaryImagePath,
      extraImagePaths: input.extraImagePaths,
      closetIds: input.closetIds
    })
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === 'object' && body && 'error' in body && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Finalize failed with status ${response.status}`;
    throw new Error(message);
  }
  return body;
}
