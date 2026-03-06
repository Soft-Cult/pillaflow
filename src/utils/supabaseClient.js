// src/utils/supabaseClient.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// 1. Paste YOUR values from the Supabase dashboard:
export const SUPABASE_URL = 'https://ueiptamivkuwhswotwpn.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_xwvO6KpSuJbKAUNMkV7vrw_S5RN2_XE';

// 2. Create and export a single supabase client for the whole app
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
