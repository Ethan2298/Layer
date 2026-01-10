/**
 * Supabase Client
 *
 * Loads Supabase from CDN (works in Electron without bundler)
 */

// ===========================================
// SUPABASE CREDENTIALS (Objectiv.go project)
// ===========================================
const SUPABASE_URL = 'https://uajcwhcfrcqqpgvvfrpz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhamN3aGNmcmNxcXBndnZmcnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjg2MDYsImV4cCI6MjA4MzY0NDYwNn0.1K6ttNixMSs_QW-_UiWmlB56AXxxt1W2oZKm_ewzxnI';

// ===========================================
// Load Supabase from CDN and create client
// ===========================================

let supabase = null;
let isSupabaseConfigured = false;
let initPromise = null;

// Async initialization - loads Supabase from CDN
async function initSupabase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Dynamically load Supabase from CDN
      if (!window.supabase) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // Create client
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      isSupabaseConfigured = true;
      console.log('☁️ Supabase loaded and configured');
      return true;
    } catch (e) {
      console.warn('☁️ Failed to load Supabase:', e);
      return false;
    }
  })();

  return initPromise;
}

// Start loading immediately
initSupabase();

// Export getter functions (since values are set async)
export function getSupabase() {
  return supabase;
}

export function getIsConfigured() {
  return isSupabaseConfigured;
}

export { initSupabase };

// For backwards compatibility
export { supabase, isSupabaseConfigured };
