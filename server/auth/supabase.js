import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gkfuywaflismvlggypkp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[CRITICAL] Missing SUPABASE_SERVICE_ROLE_KEY in environment variables!');
}

// Server-side authoritative admin client (BYPASSES RLS)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Client-facing anonymous client (Respects RLS)
export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
});

// Helper to create a user-scoped Supabase client with their JWT for RLS testing
export function createUserClient(jwtToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${jwtToken}`
      }
    },
    auth: {
      persistSession: false
    }
  });
}