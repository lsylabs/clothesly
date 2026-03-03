import type { Database } from '../types/database';
import { supabase } from './supabase';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export async function getMyProfile(): Promise<ProfileRow | null> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single<ProfileRow>();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

export async function updateMyAvatarPath(avatarPath: string | null) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error('You need to sign in again.');

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, avatar_path: avatarPath }, { onConflict: 'id' });
  if (error) throw error;
}
