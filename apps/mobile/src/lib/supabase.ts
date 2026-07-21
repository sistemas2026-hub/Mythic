import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSupabaseClient } from '@mythic/core';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Cliente de Supabase para la app móvil.
 * La sesión se persiste con AsyncStorage. Las credenciales vienen de
 * EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (archivo .env).
 */
export const supabase = createSupabaseClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
  },
});
