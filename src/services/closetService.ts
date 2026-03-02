import { supabase } from './supabase';

export type CreateClosetInput = {
  userId: string;
  name: string;
  coverImagePath?: string | null;
};

export async function listClosets() {
  const { data, error } = await supabase.from('closets').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createCloset(input: CreateClosetInput) {
  const { data, error } = await supabase
    .from('closets')
    .insert({
      user_id: input.userId,
      name: input.name.trim(),
      cover_image_path: input.coverImagePath ?? null
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateClosetCover(closetId: string, coverImagePath: string) {
  const { data, error } = await supabase
    .from('closets')
    .update({ cover_image_path: coverImagePath })
    .eq('id', closetId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

