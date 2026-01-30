/**
 * Tab State Module
 *
 * Manages per-tab state for sidebar selection, folder expansion,
 * view mode, and scroll position. Each tab has independent state.
 */

// ========================================
// State Shape
// ========================================

/**
 * @typedef {Object} TabStateData
 * @property {string} id - Unique tab identifier
 * @property {string} title - Tab display title
 * @property {string|null} icon - Tab icon (URL for favicon, or icon type like 'home', 'folder', 'objective')
 * @property {{id: string|null, type: 'folder'|'objective'|null}} selection - Current selection
 * @property {Set<string>} expandedFolders - Set of expanded folder IDs
 * @property {Set<string>} expandedTasks - Set of expanded task IDs
 * @property {'folder'|'objective'|'empty'} viewMode - Current view mode
 * @property {number} scrollPosition - Sidebar scroll position
 */

const state = {
  /** @type {Map<string, TabStateData>} */
  tabs: new Map(),

  /** @type {string|null} */
  activeTabId: null,

  /** @type {number} */
  nextTabId: 1
};

const STORAGE_KEY = 'layer-tab-state';

/** @type {Array<function({id: string|null, type: string|null}): void>} */
const selectionListeners = [];

// ========================================
// Internal Helpers
// ========================================

/**
 * Create a fresh tab state object
 */
function createTabState(id, title = 'Home', icon = 'home') {
  return {
    id,
    title,
    icon,
    selection: { id: 'home', type: 'home' },
    expandedFolders: new Set(),
    expandedTasks: new Set(),
    viewMode: 'home',
    scrollPosition: 0
  };
}

/**
 * Get the active tab state (or null if none)
 */
function getActiveTab() {
  if (!state.activeTabId) return null;
  return state.tabs.get(state.activeTabId) || null;
}

// ========================================
// Tab Lifecycle
// ========================================

/**
 * Create a new tab with fresh state
 * @returns {string} The new tab's ID
 */
export function createTab(title = 'New Tab') {
  const id = String(state.nextTabId++);
  const tabState = createTabState(id, title);
  state.tabs.set(id, tabState);
  state.activeTabId = id;
  saveToStorage();
  return id;
}

/**
 * Close a tab and remove its state
 * @returns {boolean} True if tab was closed, false if it was the last tab
 */
export function closeTab(tabId) {
  // Don't close the last tab
  if (state.tabs.size <= 1) return false;

  const wasActive = state.activeTabId === tabId;
  state.tabs.delete(tabId);

  // If closed tab was active, select another
  if (wasActive) {
    const remainingIds = Array.from(state.tabs.keys());
    state.activeTabId = remainingIds[0] || null;
  }

  saveToStorage();
  return true;
}

/**
 * Switch to a different tab
 */
export function switchTab(tabId) {
  if (!state.tabs.has(tabId)) return false;
  state.activeTabId = tabId;
  saveToStorage();
  return true;
}

// ========================================
// Active Tab Accessors - Selection
// ========================================

/**
 * Get current selection for active tab
 */
export function getSelection() {
  const tab = getActiveTab();
  return tab ? tab.selection : { id: null, type: null };
}

/**
 * Set selection for active tab
 */
export function setSelection(id, type) {
  const tab = getActiveTab();
  if (tab) {
    tab.selection = { id, type };
    saveToStorage();
    for (const fn of selectionListeners) fn({ id, type });
  }
}

export function onSelectionChange(fn) {
  selectionListeners.push(fn);
  return () => {
    const i = selectionListeners.indexOf(fn);
    if (i >= 0) selectionListeners.splice(i, 1);
  };
}

// ========================================
// Active Tab Accessors - View Mode
// ========================================

/**
 * Get view mode for active tab
 */
export function getViewMode() {
  const tab = getActiveTab();
  return tab ? tab.viewMode : 'empty';
}

/**
 * Set view mode for active tab
 */
export function setViewMode(mode) {
  const tab = getActiveTab();
  if (tab) {
    tab.viewMode = mode;
    saveToStorage();
  }
}

// ========================================
// Active Tab Accessors - Folder Expansion
// ========================================

/**
 * Check if folder is expanded in active tab
 */
export function isFolderExpanded(folderId) {
  const tab = getActiveTab();
  return tab ? tab.expandedFolders.has(folderId) : false;
}

/**
 * Toggle folder expansion in active tab
 */
export function toggleFolder(folderId) {
  const tab = getActiveTab();
  if (tab) {
    if (tab.expandedFolders.has(folderId)) {
      tab.expandedFolders.delete(folderId);
    } else {
      tab.expandedFolders.add(folderId);
    }
    saveToStorage();
  }
}

/**
 * Get all expanded folders for active tab
 */
export function getExpandedFolders() {
  const tab = getActiveTab();
  return tab ? tab.expandedFolders : new Set();
}

/**
 * Expand a folder in active tab
 */
export function expandFolder(folderId) {
  const tab = getActiveTab();
  if (tab) {
    tab.expandedFolders.add(folderId);
    saveToStorage();
  }
}

/**
 * Collapse a folder in active tab
 */
export function collapseFolder(folderId) {
  const tab = getActiveTab();
  if (tab) {
    tab.expandedFolders.delete(folderId);
    saveToStorage();
  }
}

// ========================================
// Active Tab Accessors - Task Expansion
// ========================================

/**
 * Check if task is expanded in active tab
 */
export function isTaskExpanded(taskId) {
  const tab = getActiveTab();
  return tab ? tab.expandedTasks.has(taskId) : false;
}

/**
 * Toggle task expansion in active tab
 */
export function toggleTask(taskId) {
  const tab = getActiveTab();
  if (tab) {
    if (tab.expandedTasks.has(taskId)) {
      tab.expandedTasks.delete(taskId);
    } else {
      tab.expandedTasks.add(taskId);
    }
    saveToStorage();
  }
}

/**
 * Get all expanded tasks for active tab
 */
export function getExpandedTasks() {
  const tab = getActiveTab();
  return tab ? tab.expandedTasks : new Set();
}

/**
 * Expand a task in active tab
 */
export function expandTask(taskId) {
  const tab = getActiveTab();
  if (tab) {
    tab.expandedTasks.add(taskId);
    saveToStorage();
  }
}

/**
 * Collapse a task in active tab
 */
export function collapseTask(taskId) {
  const tab = getActiveTab();
  if (tab) {
    tab.expandedTasks.delete(taskId);
    saveToStorage();
  }
}

// ========================================
// Active Tab Accessors - Scroll Position
// ========================================

/**
 * Get scroll position for active tab
 */
export function getScrollPosition() {
  const tab = getActiveTab();
  return tab ? tab.scrollPosition : 0;
}

/**
 * Set scroll position for active tab
 */
export function setScrollPosition(position) {
  const tab = getActiveTab();
  if (tab) {
    tab.scrollPosition = position;
    // Don't save on every scroll - too frequent
  }
}

// ========================================
// Tab Metadata
// ========================================

/**
 * Get title of active tab
 */
export function getTabTitle() {
  const tab = getActiveTab();
  return tab ? tab.title : '';
}

/**
 * Set title of active tab
 */
export function setTabTitle(title) {
  const tab = getActiveTab();
  if (tab) {
    tab.title = title;
    saveToStorage();
  }
}

/**
 * Get icon of active tab
 */
export function getTabIcon() {
  const tab = getActiveTab();
  return tab ? tab.icon : null;
}

/**
 * Set icon of active tab
 */
export function setTabIcon(icon) {
  const tab = getActiveTab();
  if (tab) {
    tab.icon = icon;
    saveToStorage();
  }
}

/**
 * Get title of specific tab
 */
export function getTabTitleById(tabId) {
  const tab = state.tabs.get(tabId);
  return tab ? tab.title : '';
}

/**
 * Set title of specific tab
 */
export function setTabTitleById(tabId, title) {
  const tab = state.tabs.get(tabId);
  if (tab) {
    tab.title = title;
    saveToStorage();
  }
}

/**
 * Get icon of specific tab
 */
export function getTabIconById(tabId) {
  const tab = state.tabs.get(tabId);
  return tab ? tab.icon : null;
}

/**
 * Set icon of specific tab
 */
export function setTabIconById(tabId, icon) {
  const tab = state.tabs.get(tabId);
  if (tab) {
    tab.icon = icon;
    saveToStorage();
  }
}

/**
 * Get all tab IDs
 */
export function getTabIds() {
  return Array.from(state.tabs.keys());
}

/**
 * Get active tab ID
 */
export function getActiveTabId() {
  return state.activeTabId;
}

/**
 * Get tab state by ID
 */
export function getTabById(tabId) {
  return state.tabs.get(tabId) || null;
}

// ========================================
// Persistence
// ========================================

/**
 * Save tab state to localStorage
 */
export function saveToStorage() {
  try {
    const data = {
      activeTabId: state.activeTabId,
      nextTabId: state.nextTabId,
      tabs: Array.from(state.tabs.entries()).map(([id, tab]) => ({
        id: tab.id,
        title: tab.title,
        icon: tab.icon,
        selection: tab.selection,
        expandedFolders: Array.from(tab.expandedFolders),
        expandedTasks: Array.from(tab.expandedTasks),
        viewMode: tab.viewMode,
        scrollPosition: tab.scrollPosition
      }))
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save tab state:', e);
  }
}

/**
 * Load tab state from localStorage
 */
export function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      state.activeTabId = data.activeTabId;
      state.nextTabId = data.nextTabId || 1;
      state.tabs.clear();

      if (data.tabs && Array.isArray(data.tabs)) {
        data.tabs.forEach(tab => {
          state.tabs.set(tab.id, {
            id: tab.id,
            title: tab.title,
            icon: tab.icon || null,
            selection: tab.selection || { id: null, type: null },
            expandedFolders: new Set(tab.expandedFolders || []),
            expandedTasks: new Set(tab.expandedTasks || []),
            viewMode: tab.viewMode || 'empty',
            scrollPosition: tab.scrollPosition || 0
          });
        });
      }
      return true;
    }
  } catch (e) {
    console.warn('Failed to load tab state:', e);
  }
  return false;
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize tab state
 * - Tries to load from storage
 * - Falls back to syncing with existing DOM tabs
 */
export function init() {
  const loaded = loadFromStorage();

  if (!loaded || state.tabs.size === 0) {
    // Sync with existing DOM tabs
    syncWithDom();
  }

  // Ensure we have at least one tab
  if (state.tabs.size === 0) {
    createTab('Dashboard');
  }

  // Ensure active tab exists
  if (!state.activeTabId || !state.tabs.has(state.activeTabId)) {
    state.activeTabId = state.tabs.keys().next().value;
  }

  saveToStorage();
}

/**
 * Sync tab state with existing DOM tabs
 */
function syncWithDom() {
  const domTabs = document.querySelectorAll('.header-tab');
  let maxId = 0;

  domTabs.forEach(tabEl => {
    const tabId = tabEl.dataset.tabId;
    if (tabId) {
      const numId = parseInt(tabId, 10);
      if (numId > maxId) maxId = numId;

      const title = tabEl.querySelector('.tab-title')?.textContent || 'Tab';
      const isActive = tabEl.classList.contains('active');

      state.tabs.set(tabId, createTabState(tabId, title));

      if (isActive) {
        state.activeTabId = tabId;
      }
    }
  });

  state.nextTabId = maxId + 1;
}

// ========================================
// Default Export
// ========================================

export default {
  // Lifecycle
  createTab,
  closeTab,
  switchTab,

  // Selection
  getSelection,
  setSelection,
  onSelectionChange,

  // View Mode
  getViewMode,
  setViewMode,

  // Folder Expansion
  isFolderExpanded,
  toggleFolder,
  getExpandedFolders,
  expandFolder,
  collapseFolder,

  // Task Expansion
  isTaskExpanded,
  toggleTask,
  getExpandedTasks,
  expandTask,
  collapseTask,

  // Scroll Position
  getScrollPosition,
  setScrollPosition,

  // Tab Metadata
  getTabTitle,
  setTabTitle,
  getTabIcon,
  setTabIcon,
  getTabTitleById,
  setTabTitleById,
  getTabIconById,
  setTabIconById,
  getTabIds,
  getActiveTabId,
  getTabById,

  // Persistence
  saveToStorage,
  loadFromStorage,
  init
};
