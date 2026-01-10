/**
 * Side List State Module
 *
 * Unified state management for the side list navigation.
 * Treats objectives and folder explorer as one continuous navigable list.
 */

// ========================================
// State Shape
// ========================================

const state = {
  // Current selection index in the flat navigable list
  selectedIndex: 0,

  // Cached flat list of navigable items
  items: [],

  // Folder explorer specific state
  folderExplorer: {
    rootPath: null,
    expanded: new Set(),
    collapsed: false  // Whether FILES section is collapsed
  }
};

// ========================================
// Item Types
// ========================================

export const ItemType = {
  OBJECTIVE: 'objective',
  ADD_OBJECTIVE: 'add-objective',
  FILES_HEADER: 'files-header',
  SET_FOLDER: 'set-folder',
  FOLDER: 'folder',
  FILE: 'file'
};

// ========================================
// Getters
// ========================================

export function getSelectedIndex() {
  return state.selectedIndex;
}

export function getItems() {
  return state.items;
}

export function getSelectedItem() {
  return state.items[state.selectedIndex] || null;
}

export function getRootPath() {
  return state.folderExplorer.rootPath;
}

export function isExpanded(path) {
  return state.folderExplorer.expanded.has(path);
}

export function isFolderSectionCollapsed() {
  return state.folderExplorer.collapsed;
}

// ========================================
// Actions - Selection
// ========================================

export function setSelectedIndex(index) {
  if (index >= 0 && index < state.items.length) {
    state.selectedIndex = index;
  }
}

// Items that can be navigated to (skips headers)
function isNavigable(item) {
  return item && item.type !== ItemType.FILES_HEADER;
}

export function selectNext() {
  let newIndex = state.selectedIndex + 1;
  // Skip non-navigable items
  while (newIndex < state.items.length && !isNavigable(state.items[newIndex])) {
    newIndex++;
  }
  if (newIndex < state.items.length) {
    state.selectedIndex = newIndex;
    return true;
  }
  return false;
}

export function selectPrev() {
  let newIndex = state.selectedIndex - 1;
  // Skip non-navigable items
  while (newIndex >= 0 && !isNavigable(state.items[newIndex])) {
    newIndex--;
  }
  if (newIndex >= 0) {
    state.selectedIndex = newIndex;
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
    if (type === ItemType.OBJECTIVE) return item.index === identifier;
    if (type === ItemType.FOLDER || type === ItemType.FILE) return item.path === identifier;
    if (type === ItemType.ADD_OBJECTIVE || type === ItemType.FILES_HEADER) return true;
    return false;
  });
  if (index !== -1) {
    state.selectedIndex = index;
    return true;
  }
  return false;
}

// ========================================
// Actions - Folder Explorer
// ========================================

export function setRootPath(path) {
  state.folderExplorer.rootPath = path;
  state.folderExplorer.expanded.clear();
  if (path) {
    state.folderExplorer.expanded.add(path);
  }
  saveState();
}

export function toggleExpanded(path) {
  if (state.folderExplorer.expanded.has(path)) {
    state.folderExplorer.expanded.delete(path);
  } else {
    state.folderExplorer.expanded.add(path);
  }
  saveState();
}

export function toggleFolderSection() {
  state.folderExplorer.collapsed = !state.folderExplorer.collapsed;
  saveState();
}

// ========================================
// Build Navigable Items List
// ========================================

/**
 * Build the flat list of all navigable items
 * Called whenever objectives or folder structure changes
 *
 * @param {Object} options
 * @param {Array} options.objectives - Array of objective objects
 * @param {Function} options.getFolderContents - Async function to get folder contents
 * @param {boolean} options.isAddingObjective - Whether currently adding an objective
 */
export async function rebuildItems({ objectives = [], getFolderContents, isAddingObjective = false }) {
  const items = [];

  // Add objectives
  objectives.forEach((obj, index) => {
    items.push({
      type: ItemType.OBJECTIVE,
      index,
      data: obj,
      name: obj.name
    });
  });

  // Add "Add objective" option (unless currently adding)
  if (!isAddingObjective) {
    items.push({
      type: ItemType.ADD_OBJECTIVE,
      name: '+ Add objective'
    });
  }

  // Add FILES section header (always present, not navigable but marks section)
  items.push({
    type: ItemType.FILES_HEADER,
    name: 'FILES',
    isCollapsed: state.folderExplorer.collapsed,
    rootPath: state.folderExplorer.rootPath
  });

  // Add folder explorer items if root is set and not collapsed
  if (state.folderExplorer.rootPath && !state.folderExplorer.collapsed) {
    // Add folder tree items recursively
    await addFolderItems(items, state.folderExplorer.rootPath, 0, getFolderContents);
  } else if (!state.folderExplorer.rootPath && !state.folderExplorer.collapsed) {
    // No root set, add "Set folder" option
    items.push({
      type: ItemType.SET_FOLDER,
      name: '+ Set folder'
    });
  }

  state.items = items;

  // Clamp selection index
  if (state.selectedIndex >= items.length) {
    state.selectedIndex = Math.max(0, items.length - 1);
  }

  return items;
}

/**
 * Recursively add folder items to the list
 */
async function addFolderItems(items, dirPath, depth, getFolderContents) {
  if (!getFolderContents) return;

  try {
    const contents = await getFolderContents(dirPath);
    if (!contents || !Array.isArray(contents)) return;

    for (const entry of contents) {
      if (entry.isDirectory) {
        items.push({
          type: ItemType.FOLDER,
          path: entry.path,
          name: entry.name,
          depth,
          isExpanded: state.folderExplorer.expanded.has(entry.path)
        });

        // If expanded, add children
        if (state.folderExplorer.expanded.has(entry.path)) {
          await addFolderItems(items, entry.path, depth + 1, getFolderContents);
        }
      } else {
        items.push({
          type: ItemType.FILE,
          path: entry.path,
          name: entry.name,
          depth
        });
      }
    }
  } catch (err) {
    console.error('Error loading folder contents:', err);
  }
}

// ========================================
// Persistence
// ========================================

const STORAGE_KEY = 'objectiv-sidelist-state';

export function saveState() {
  try {
    const data = {
      rootPath: state.folderExplorer.rootPath,
      expanded: Array.from(state.folderExplorer.expanded),
      collapsed: state.folderExplorer.collapsed
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save side list state:', e);
  }
}

export function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      state.folderExplorer.rootPath = data.rootPath || null;
      state.folderExplorer.expanded = new Set(data.expanded || []);
      state.folderExplorer.collapsed = data.collapsed || false;
    }
  } catch (e) {
    console.warn('Failed to load side list state:', e);
  }
}

// ========================================
// Initialization
// ========================================

export function init() {
  loadState();
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
  getRootPath,
  isExpanded,
  isFolderSectionCollapsed,

  // Selection
  setSelectedIndex,
  selectNext,
  selectPrev,
  selectItem,

  // Folder explorer
  setRootPath,
  toggleExpanded,
  toggleFolderSection,

  // Building
  rebuildItems,

  // Persistence
  saveState,
  loadState,
  init
};
