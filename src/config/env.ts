export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
};

export const hasSupabaseEnv = Boolean(env.supabaseUrl && env.supabaseAnonKey);
