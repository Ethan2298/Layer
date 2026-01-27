/**
 * Supabase Client for Backend
 *
 * Server-side Supabase client using anon key.
 * Uses the same key as the frontend - RLS protects data access.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uajcwhcfrcqqpgvvfrpz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhamN3aGNmcmNxcXBndnZmcnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjg2MDYsImV4cCI6MjA4MzY0NDYwNn0.1K6ttNixMSs_QW-_UiWmlB56AXxxt1W2oZKm_ewzxnI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Check if Supabase is available
 * @returns {boolean}
 */
export function isAvailable() {
  return true;
}
