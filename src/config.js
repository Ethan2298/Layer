/**
 * Application Configuration
 *
 * Centralized configuration for external services.
 * Note: Supabase anon key is public by design - protected by Row Level Security.
 */

// ========================================
// Supabase Configuration
// ========================================

export const SUPABASE_URL = 'https://uajcwhcfrcqqpgvvfrpz.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhamN3aGNmcmNxcXBndnZmcnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjg2MDYsImV4cCI6MjA4MzY0NDYwNn0.1K6ttNixMSs_QW-_UiWmlB56AXxxt1W2oZKm_ewzxnI';

// ========================================
// Default Export
// ========================================

export default {
  supabase: {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY
  }
};
