import { supabase } from './supabase';

export type ItemMetadataCategory = 'brand' | 'clothing_type' | 'color' | 'material' | 'season';
const MAX_METADATA_OPTION_LENGTH: Record<ItemMetadataCategory, number> = {
  brand: 120,
  clothing_type: 120,
  color: 120,
  material: 40,
  season: 40
};

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
  const maxLength = MAX_METADATA_OPTION_LENGTH[input.category];
  if (trimmedLabel.length > maxLength) {
    const categoryLabel =
      input.category === 'clothing_type'
        ? 'Clothing type'
        : input.category.charAt(0).toUpperCase() + input.category.slice(1);
    throw new Error(`${categoryLabel} options must be ${maxLength} characters or less`);
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
