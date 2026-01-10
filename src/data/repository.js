/**
 * Data Repository Module
 *
 * Environment-agnostic data persistence layer.
 * - Primary: localStorage (fast, synchronous)
 * - Secondary: Supabase cloud (async background sync)
 *
 * DATA FLOW:
 * 1. On app start: Try cloud first, fall back to localStorage
 * 2. On save: Save to localStorage immediately, then sync to cloud
 */

import { pullFromCloud, pushToCloud } from './supabase-sync.js';

const STORAGE_KEY = 'objectiv-data';

// ========================================
// Utility Functions
// ========================================

/**
 * Generate a unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Calculate clarity level from score or description
 */
export function calculateClarity(item) {
  // Use cached LLM score if available
  if (item.clarityScore !== undefined && item.clarityScore !== null) {
    const score = item.clarityScore;
    if (score <= 40) return 'fuzzy';
    if (score <= 60) return 'less fuzzy';
    if (score <= 80) return 'clear';
    return 'very clear';
  }

  // Fallback to word count
  const desc = item.description || '';
  const wordCount = desc.trim().split(/\s+/).filter(w => w).length;
  if (wordCount === 0) return 'fuzzy';
  if (wordCount < 5) return 'less fuzzy';
  if (wordCount < 15) return 'clear';
  return 'very clear';
}

// ========================================
// Dummy Data (for development/demo)
// ========================================

function getDummyData() {
  const now = new Date();
  const hourAgo = new Date(now - 60 * 60 * 1000);
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);

  return {
    objectives: [
      {
        id: 'obj1',
        name: 'Learn Rust programming',
        description: 'Master systems programming with Rust for building fast, reliable software',
        clarityScore: 78,
        priorities: [
          { id: 'p1a', name: 'Complete the Rust Book', description: 'Read through all chapters and do exercises', clarityScore: 85 },
          { id: 'p1b', name: 'Build a CLI tool', description: 'Create a practical command-line application', clarityScore: 72 },
          { id: 'p1c', name: 'Contribute to open source', description: 'Find a Rust project and submit a PR', clarityScore: 45 }
        ],
        steps: [
          { id: 's1a', name: 'Installed rustup and cargo', loggedAt: twoDaysAgo.toISOString(), orderNumber: 1 },
          { id: 's1b', name: 'Finished chapters 1-3 of the Rust Book', loggedAt: dayAgo.toISOString(), orderNumber: 2 },
          { id: 's1c', name: 'Wrote first ownership examples', loggedAt: hourAgo.toISOString(), orderNumber: 3 }
        ]
      },
      {
        id: 'obj2',
        name: 'Get in shape for summer',
        description: 'Build consistent exercise habits and improve overall fitness',
        clarityScore: 62,
        priorities: [
          { id: 'p2a', name: 'Exercise 4x per week', description: 'Mix of strength training and cardio', clarityScore: 80 },
          { id: 'p2b', name: 'Track nutrition', description: 'Log meals and aim for balanced macros', clarityScore: 55 }
        ],
        steps: [
          { id: 's2a', name: 'Signed up for gym membership', loggedAt: twoDaysAgo.toISOString(), orderNumber: 1 },
          { id: 's2b', name: 'Did first workout - legs and core', loggedAt: dayAgo.toISOString(), orderNumber: 2 },
          { id: 's2c', name: 'Morning run - 2 miles', loggedAt: now.toISOString(), orderNumber: 3 }
        ]
      },
      {
        id: 'obj3',
        name: 'Launch side project',
        description: '',
        clarityScore: 28,
        priorities: [
          { id: 'p3a', name: 'Define MVP scope', description: '', clarityScore: 35 }
        ],
        steps: [
          { id: 's3a', name: 'Brainstormed initial ideas', loggedAt: dayAgo.toISOString(), orderNumber: 1 }
        ]
      },
      {
        id: 'obj4',
        name: 'Read more books',
        description: 'Read at least 2 books per month across different genres',
        clarityScore: 70,
        priorities: [
          { id: 'p4a', name: 'Set daily reading time', description: '30 minutes before bed', clarityScore: 90 },
          { id: 'p4b', name: 'Join a book club', description: 'Find local or online community', clarityScore: 40 }
        ],
        steps: [
          { id: 's4a', name: 'Finished "Atomic Habits"', loggedAt: twoDaysAgo.toISOString(), orderNumber: 1 },
          { id: 's4b', name: 'Started "Deep Work"', loggedAt: hourAgo.toISOString(), orderNumber: 2 }
        ]
      }
    ]
  };
}

// ========================================
// Data Migration
// ========================================

/**
 * Migrate from old hierarchy format if needed
 */
function migrateData(oldData) {
  const newObjectives = [];
  for (const outcome of (oldData.outcomes || [])) {
    for (const objective of (outcome.objectives || [])) {
      const allPriorities = [];
      const allSteps = [];

      for (const priority of (objective.priorities || [])) {
        allPriorities.push({
          id: priority.id,
          name: priority.name,
          description: priority.description || ''
        });
        for (const step of (priority.steps || [])) {
          allSteps.push({
            id: step.id,
            name: step.name,
            loggedAt: step.done ? new Date().toISOString() : new Date().toISOString()
          });
        }
      }

      newObjectives.push({
        id: objective.id,
        name: objective.name,
        description: objective.description || '',
        priorities: allPriorities,
        steps: allSteps
      });
    }
  }
  return { objectives: newObjectives };
}

/**
 * Ensure data has correct structure
 */
function ensureStructure(data) {
  if (data.objectives) {
    for (const obj of data.objectives) {
      if (!obj.priorities) obj.priorities = [];
      if (!obj.steps) obj.steps = [];
    }
  }
  return data;
}

// ========================================
// Repository API
// ========================================

/**
 * Initialize data from cloud (async)
 *
 * Call this ONCE when app starts. It:
 * 1. Tries to pull from Supabase
 * 2. If cloud has data, uses that (and caches to localStorage)
 * 3. If cloud is empty/unavailable, falls back to localStorage
 *
 * This ensures you always have the latest cloud data.
 */
export async function initializeFromCloud() {
  try {
    // Try to get data from Supabase
    const cloudData = await pullFromCloud();

    if (cloudData) {
      // Cloud has data! Cache it locally and use it.
      console.log('📥 Using cloud data');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData));
      return ensureStructure(cloudData);
    }

    // No cloud data - fall back to localStorage
    console.log('📥 No cloud data, using local');
    const localData = loadData();

    // If we have local data, push it to cloud (first-time sync)
    if (localData.objectives && localData.objectives.length > 0) {
      console.log('📤 Pushing local data to cloud (first sync)');
      pushToCloud(localData);
    }

    return localData;

  } catch (e) {
    console.warn('Cloud init failed, using local:', e);
    return loadData();
  }
}

/**
 * Load data from storage (synchronous)
 * Uses localStorage in browser, file system in Electron
 */
export function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate from old format if needed
      if (parsed.outcomes && !parsed.objectives) {
        return migrateData(parsed);
      }
      return ensureStructure(parsed);
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
  // Return dummy data for development
  return getDummyData();
}

/**
 * Save data to storage
 *
 * This does TWO things:
 * 1. Saves to localStorage immediately (fast, synchronous)
 * 2. Queues a cloud sync (async, debounced)
 *
 * The cloud sync is fire-and-forget - if it fails, data is still
 * safe in localStorage.
 */
export function saveData(data) {
  // Step 1: Save locally (this is instant)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data:', e);
  }

  // Step 2: Sync to cloud (background, debounced)
  pushToCloud(data);
}

/**
 * Create a new objective
 */
export function createObjective(name = '', description = '') {
  return {
    id: generateId(),
    name,
    description,
    priorities: [],
    steps: []
  };
}

/**
 * Create a new priority
 */
export function createPriority(name = '', description = '') {
  return {
    id: generateId(),
    name,
    description
  };
}

/**
 * Create a new step
 */
export function createStep(name = '', orderNumber = 1) {
  return {
    id: generateId(),
    name,
    loggedAt: new Date().toISOString(),
    orderNumber
  };
}

// Default export for convenience
export default {
  initializeFromCloud,
  loadData,
  saveData,
  generateId,
  calculateClarity,
  createObjective,
  createPriority,
  createStep
};
