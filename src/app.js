/**
 * Objectiv.go - Main Application Entry Point
 *
 * This module serves as the central entry point, importing and
 * re-exporting all modules for use by the application.
 */

// ========================================
// Module Imports
// ========================================

import * as Repository from './data/repository.js';
import * as SupabaseSync from './data/supabase-sync.js';
import * as State from './state/store.js';
import * as Utils from './utils.js';
import * as Clarity from './clarity.js';
import * as ListItem from './components/list-item.js';
import * as EditController from './controllers/edit-controller.js';
import * as FolderExplorer from './components/folder-explorer.js';

// ========================================
// Re-export for global access
// ========================================

// Make modules available globally for gradual migration
window.Objectiv = {
  Repository,
  SupabaseSync,
  State,
  Utils,
  Clarity,
  ListItem,
  EditController,
  FolderExplorer
};

// ========================================
// Initialization
// ========================================

/**
 * Initialize the application
 */
export function init() {
  console.log('Objectiv.go modules loaded');

  // Set up clarity score update callback
  Clarity.setOnScoresUpdated(() => {
    // Will be connected to updateView() when fully migrated
    if (window.updateView) {
      window.updateView();
    }
  });

  // Initialize folder explorer
  FolderExplorer.init();
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ========================================
// Exports
// ========================================

export {
  Repository,
  State,
  Utils,
  Clarity,
  ListItem,
  EditController,
  FolderExplorer
};

export default {
  Repository,
  State,
  Utils,
  Clarity,
  ListItem,
  EditController,
  FolderExplorer,
  init
};
