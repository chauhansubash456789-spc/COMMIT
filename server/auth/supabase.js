import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gkfuywaflismvlggypkp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZnV5d2FmbGlzbXZsZ2d5cGtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTE4MDQzNSwiZXhwIjoyMTA2NzU2NDM1fQ.Xvn23--_qt6wsOLF3UM0bILIx8cNlMH3hnwT156cg0M';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrZnV5d2FmbGlzbXZsZ2d5cGtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExODA0MzUsImV4cCI6MjEwNjc1NjQzNX0.krhWdEjB4dBorFDKlmkJ0D4hT7bOZA4UjGpGCFo4P8w';

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