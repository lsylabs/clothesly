import { supabase } from './supabase';

export type ItemMetadataCategory = 'brand' | 'clothing_type' | 'color' | 'material' | 'season';
const MAX_ITEM_ARRAY_ENTRY_LENGTH = 40;

export type ItemMetadataOptionRow = {
  id: string;
  user_id: string;
  category: ItemMetadataCategory;
  label: string;
  created_at: string;
};

export async function listItemMetadataOptions() {
  const { data, error } = await supabase.from('item_metadata_options').select('*').order('label', { ascending: true });
  if (error) throw error;
  return data as ItemMetadataOptionRow[];
}

export async function createItemMetadataOption(input: {
  userId: string;
  category: ItemMetadataCategory;
  label: string;
}) {
  const trimmedLabel = input.label.trim();
  if (
    (input.category === 'material' || input.category === 'season') &&
    trimmedLabel.length > MAX_ITEM_ARRAY_ENTRY_LENGTH
  ) {
    const categoryLabel = input.category === 'material' ? 'Material' : 'Season';
    throw new Error(`${categoryLabel} options must be ${MAX_ITEM_ARRAY_ENTRY_LENGTH} characters or less`);
  }
  const { data, error } = await supabase
    .from('item_metadata_options')
    .upsert(
      {
        user_id: input.userId,
        category: input.category,
        label: trimmedLabel
      },
      {
        onConflict: 'user_id,category,label_normalized',
        ignoreDuplicates: true
      }
    )
    .select('*');

  if (error) throw error;

  if (data?.length) {
    return data[0] as ItemMetadataOptionRow;
  }

  const { data: existing, error: existingError } = await supabase
    .from('item_metadata_options')
    .select('*')
    .eq('user_id', input.userId)
    .eq('category', input.category)
    .eq('label_normalized', trimmedLabel.toLowerCase())
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing) throw new Error('Failed to load metadata option after creation.');
  return existing as ItemMetadataOptionRow;
}
