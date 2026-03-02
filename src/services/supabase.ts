import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

import { env } from '../config/env';
import type { Database } from '../types/database';

const memoryStorage = new Map<string, string>();

const fallbackStorage = {
  getItem: async (key: string) => memoryStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    memoryStorage.set(key, value);
  },
  removeItem: async (key: string) => {
    memoryStorage.delete(key);
  }
};

const hasNativeAsyncStorage = Boolean((NativeModules as Record<string, unknown>).RNCAsyncStorage);
const hasWindowLocalStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const webStorage = {
  getItem: async (key: string) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memoryStorage.set(key, value);
    }
  },
  removeItem: async (key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memoryStorage.delete(key);
    }
  }
};

const authStorage =
  Platform.OS === 'web' && hasWindowLocalStorage
    ? webStorage
    : hasNativeAsyncStorage
      ? AsyncStorage
      : {
          getItem: fallbackStorage.getItem,
          setItem: fallbackStorage.setItem,
          removeItem: fallbackStorage.removeItem
        };

export const supabase = createClient<Database>(
  env.supabaseUrl || 'https://placeholder.supabase.co',
  env.supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);
