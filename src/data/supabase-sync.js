/**
 * Supabase Sync Layer
 *
 * This handles the actual syncing between your local app and the cloud.
 *
 * KEY CONCEPTS:
 *
 * 1. PULL = Download data from cloud (happens once on app start)
 * 2. PUSH = Upload data to cloud (happens after every save)
 *
 * 3. DEBOUNCING = If you save 5 times in 1 second, we only upload ONCE.
 *    This prevents hammering the server and saves bandwidth.
 *
 * 4. GRACEFUL DEGRADATION = If cloud fails, app still works via localStorage.
 */

import { getSupabase, getIsConfigured, initSupabase } from './supabase-client.js';

// How long to wait after a save before syncing to cloud
// (groups rapid saves into one upload)
const SYNC_DEBOUNCE_MS = 1000;

// Timer reference for debouncing
let syncTimeout = null;

// Track sync status
let lastSyncTime = null;
let syncInProgress = false;

/**
 * PULL: Fetch data from Supabase
 *
 * Called once when app starts.
 * Returns the cloud data, or null if unavailable.
 */
export async function pullFromCloud() {
  // Wait for Supabase to initialize
  await initSupabase();

  const supabase = getSupabase();
  const isConfigured = getIsConfigured();

  // Skip if Supabase isn't set up
  if (!isConfigured || !supabase) {
    console.log('☁️ Supabase not ready, skipping pull');
    return null;
  }

  try {
    console.log('☁️ Pulling data from cloud...');

    // Query the app_data table for our singleton row
    const { data, error } = await supabase
      .from('app_data')              // Table name
      .select('data, updated_at')    // Columns we want
      .eq('id', 'singleton')         // Where id = 'singleton'
      .single();                     // Expect exactly one row

    // Handle "row not found" - that's OK, just means first run
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('☁️ No cloud data yet (first sync)');
        return null;
      }
      throw error;
    }

    console.log('☁️ Cloud data loaded (last updated:', data.updated_at, ')');
    return data.data; // Return just the JSONB data column

  } catch (e) {
    console.warn('☁️ Cloud pull failed:', e.message);
    return null;
  }
}

/**
 * PUSH: Send data to Supabase
 *
 * Called after every saveData().
 * Uses debouncing - waits 1 second of "quiet time" before actually uploading.
 */
export function pushToCloud(appData) {
  // Cancel any pending sync (debouncing)
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  // Schedule a new sync
  syncTimeout = setTimeout(async () => {
    // Wait for Supabase to initialize
    await initSupabase();

    const supabase = getSupabase();
    const isConfigured = getIsConfigured();

    // Skip if Supabase isn't set up
    if (!isConfigured || !supabase) {
      return;
    }

    // Don't overlap syncs
    if (syncInProgress) {
      console.log('☁️ Sync already in progress, queuing...');
      pushToCloud(appData); // Re-queue
      return;
    }

    syncInProgress = true;

    try {
      console.log('☁️ Pushing data to cloud...');

      // UPSERT = INSERT if not exists, UPDATE if exists
      const { error } = await supabase
        .from('app_data')
        .upsert({
          id: 'singleton',                       // Our single row ID
          data: appData,                         // The full app data as JSONB
          updated_at: new Date().toISOString()   // Timestamp
        });

      if (error) throw error;

      lastSyncTime = new Date();
      console.log('☁️ Cloud sync complete');

    } catch (e) {
      console.warn('☁️ Cloud push failed:', e.message);
      // That's OK - data is still safe in localStorage
    } finally {
      syncInProgress = false;
    }
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Get sync status (for UI if needed)
 */
export function getSyncStatus() {
  return {
    configured: getIsConfigured(),
    lastSync: lastSyncTime,
    syncing: syncInProgress
  };
}
