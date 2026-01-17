/**
 * Side List State Module
 *
 * State management for the side list navigation.
 * Manages folders and objectives in a hierarchical structure.
 *
 * Note: Selection and folder expansion are now delegated to TabState
 * for per-tab independence.
 */

import * as TabState from './tab-state.js';

// ========================================
// State Shape
// ========================================

const state = {
  // Cached flat list of navigable items
  items: [],

  // Cached folders array
  folders: []
};

// ========================================
// Item Types
// ========================================

export const ItemType = {
  HOME: 'home',
  UNFILED_HEADER: 'unfiled-header',
  OBJECTIVE: 'objective',
  FOLDER: 'folder',
  ADD_OBJECTIVE: 'add-objective',
  ADD_FOLDER: 'add-folder'
};

// ========================================
// Getters
// ========================================

/**
 * Get selected index by finding selection ID in items array
 */
export function getSelectedIndex() {
  const selection = TabState.getSelection();
  if (!selection.type) return -1;

  return state.items.findIndex(item => {
    if (selection.type === 'home' && item.type === ItemType.HOME) {
      return true;
    }
    if (selection.type === 'objective' && item.type === ItemType.OBJECTIVE) {
      return item.objectiveId === selection.id;
    }
    if (selection.type === 'folder' && item.type === ItemType.FOLDER) {
      return item.folderId === selection.id;
    }
    return false;
  });
}

export function getItems() {
  return state.items;
}

export function getSelectedItem() {
  const index = getSelectedIndex();
  return index >= 0 ? state.items[index] : null;
}

export function getFolders() {
  return state.folders;
}

/**
 * Delegate to TabState
 */
export function isFolderExpanded(folderId) {
  return TabState.isFolderExpanded(folderId);
}

/**
 * Delegate to TabState
 */
export function getExpandedFolders() {
  return TabState.getExpandedFolders();
}

// ========================================
// Actions - Selection
// ========================================

/**
 * Set selected index by updating TabState selection
 */
export function setSelectedIndex(index) {
  if (index >= 0 && index < state.items.length) {
    const item = state.items[index];
    if (item.type === ItemType.HOME) {
      TabState.setSelection('home', 'home');
    } else if (item.type === ItemType.OBJECTIVE) {
      TabState.setSelection(item.objectiveId, 'objective');
    } else if (item.type === ItemType.FOLDER) {
      TabState.setSelection(item.folderId, 'folder');
    }
  }
}

export function selectNext() {
  const currentIndex = getSelectedIndex();
  const newIndex = currentIndex + 1;
  if (newIndex < state.items.length) {
    setSelectedIndex(newIndex);
    return true;
  }
  return false;
}

export function selectPrev() {
  const currentIndex = getSelectedIndex();
  const newIndex = currentIndex - 1;
  if (newIndex >= 0) {
    setSelectedIndex(newIndex);
    return true;
  }
  return false;
}

/**
 * Select item by finding it in the list
 */
export function selectItem(type, identifier) {
  const index = state.items.findIndex(item => {
    if (item.type !== type) return false;
    if (type === ItemType.OBJECTIVE) return item.objectiveId === identifier;
    if (type === ItemType.FOLDER) return item.folderId === identifier;
    return false;
  });
  if (index !== -1) {
    setSelectedIndex(index);
    return true;
  }
  return false;
}

// ========================================
// Actions - Folder Expansion
// ========================================

/**
 * Delegate to TabState
 */
export function toggleFolder(folderId) {
  TabState.toggleFolder(folderId);
}

/**
 * Delegate to TabState
 */
export function expandFolder(folderId) {
  TabState.expandFolder(folderId);
}

/**
 * Delegate to TabState
 */
export function collapseFolder(folderId) {
  TabState.collapseFolder(folderId);
}

// ========================================
// Build Navigable Items List
// ========================================

/**
 * Build the flat list of all navigable items
 * Called whenever objectives or folders change
 *
 * Structure:
 * - Unfiled objectives (in a box at top, no label)
 * - Folders (with nested objectives and subfolders)
 * - Add objective button
 *
 * @param {Object} options
 * @param {Array} options.objectives - Array of objective objects
 * @param {Array} options.folders - Array of folder objects
 * @param {boolean} options.isAddingObjective - Whether currently adding an objective
 */
export function rebuildItems({ objectives = [], folders = [], isAddingObjective = false }) {
  const items = [];

  // Store folders for reference
  state.folders = folders;

  // Get expanded folders from TabState
  const expandedFolders = TabState.getExpandedFolders();

  // Add Home item at the top
  items.push({
    type: ItemType.HOME,
    name: 'Home',
    depth: 0
  });

  // Separate unfiled objectives (folderId is null or undefined)
  const unfiledObjectives = objectives.filter(obj => !obj.folderId);
  const filedObjectives = objectives.filter(obj => obj.folderId);

  // Build folder tree structure
  const folderMap = new Map();
  folders.forEach(f => folderMap.set(f.id, { ...f, children: [], objectives: [] }));

  // Assign objectives to folders
  filedObjectives.forEach(obj => {
    const folder = folderMap.get(obj.folderId);
    if (folder) {
      folder.objectives.push(obj);
    } else {
      // Folder not found, treat as unfiled
      unfiledObjectives.push(obj);
    }
  });

  // Build folder hierarchy (assign children to parents)
  const rootFolders = [];
  folderMap.forEach(folder => {
    if (folder.parentId) {
      const parent = folderMap.get(folder.parentId);
      if (parent) {
        parent.children.push(folder);
      } else {
        rootFolders.push(folder);
      }
    } else {
      rootFolders.push(folder);
    }
  });

  // Combine unfiled objectives and root folders, then sort by orderIndex
  const rootItems = [
    ...unfiledObjectives.map(obj => ({ type: 'objective', data: obj, orderIndex: obj.orderIndex || 0 })),
    ...rootFolders.map(folder => ({ type: 'folder', data: folder, orderIndex: folder.orderIndex || 0 }))
  ].sort((a, b) => a.orderIndex - b.orderIndex);

  // Recursively add folders and their contents
  function addFolderItems(folder, depth) {
    items.push({
      type: ItemType.FOLDER,
      folderId: folder.id,
      data: folder,
      name: folder.name,
      parentId: folder.parentId,
      depth,
      hasChildren: folder.children.length > 0 || folder.objectives.length > 0
    });

    // Only show contents if folder is expanded (use expandedFolders from TabState)
    if (expandedFolders.has(folder.id)) {
      // Combine objectives and child folders, then sort by orderIndex
      const folderContents = [
        ...folder.objectives.map(obj => ({ type: 'objective', data: obj, orderIndex: obj.orderIndex || 0 })),
        ...folder.children.map(child => ({ type: 'folder', data: child, orderIndex: child.orderIndex || 0 }))
      ].sort((a, b) => a.orderIndex - b.orderIndex);

      folderContents.forEach(item => {
        if (item.type === 'objective') {
          const obj = item.data;
          const objIndex = objectives.indexOf(obj);
          items.push({
            type: ItemType.OBJECTIVE,
            index: objIndex,
            objectiveId: obj.id,
            data: obj,
            name: obj.name,
            folderId: folder.id,
            depth: depth + 1
          });
        } else {
          addFolderItems(item.data, depth + 1);
        }
      });
    }
  }

  // Add root items (interleaved objectives and folders)
  rootItems.forEach(item => {
    if (item.type === 'objective') {
      const obj = item.data;
      const objIndex = objectives.indexOf(obj);
      items.push({
        type: ItemType.OBJECTIVE,
        index: objIndex,
        objectiveId: obj.id,
        data: obj,
        name: obj.name,
        folderId: null,
        depth: 0
      });
    } else {
      addFolderItems(item.data, 0);
    }
  });

  state.items = items;

  return items;
}

// ========================================
// Persistence (now handled by TabState)
// ========================================

export function saveState() {
  // Selection and expansion are now saved via TabState
  TabState.saveToStorage();
}

export function loadState() {
  // Selection and expansion are now loaded via TabState
  // Nothing to do here - TabState.init() handles this
}

// ========================================
// Initialization
// ========================================

export function init() {
  // TabState should be initialized before this module
  // No local state to load anymore
}

// ========================================
// Default Export
// ========================================

export default {
  ItemType,

  // Getters
  getSelectedIndex,
  getItems,
  getSelectedItem,
  getFolders,
  isFolderExpanded,
  getExpandedFolders,

  // Selection
  setSelectedIndex,
  selectNext,
  selectPrev,
  selectItem,

  // Folder expansion
  toggleFolder,
  expandFolder,
  collapseFolder,

  // Building
  rebuildItems,

  // Persistence
  saveState,
  loadState,
  init
};
