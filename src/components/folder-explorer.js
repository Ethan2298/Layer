/**
 * Folder Explorer Component
 *
 * A file/folder tree browser that integrates with the side list.
 * Allows exploring directories and selecting files.
 */

// ========================================
// State
// ========================================

const state = {
  rootPath: null,           // Root folder being explored
  expanded: new Set(),      // Set of expanded folder paths
  selectedPath: null,       // Currently selected file/folder path
  collapsed: false,         // Whether the entire explorer section is collapsed
  loading: false,           // Loading state
  cache: new Map()          // Cache of directory contents: path -> items[]
};

// ========================================
// State Getters
// ========================================

export function getRootPath() {
  return state.rootPath;
}

export function isExpanded(path) {
  return state.expanded.has(path);
}

export function getSelectedPath() {
  return state.selectedPath;
}

export function isSectionCollapsed() {
  return state.collapsed;
}

export function isLoading() {
  return state.loading;
}

// ========================================
// State Actions
// ========================================

export function setRootPath(path) {
  state.rootPath = path;
  state.expanded.clear();
  state.cache.clear();
  state.selectedPath = null;
  // Auto-expand root
  if (path) {
    state.expanded.add(path);
  }
  saveState();
}

export function toggleExpanded(path) {
  if (state.expanded.has(path)) {
    state.expanded.delete(path);
  } else {
    state.expanded.add(path);
  }
  saveState();
}

export function setSelected(path) {
  state.selectedPath = path;
}

export function toggleSectionCollapsed() {
  state.collapsed = !state.collapsed;
  saveState();
}

export function setLoading(value) {
  state.loading = value;
}

// ========================================
// Cache Management
// ========================================

export function getCachedDir(path) {
  return state.cache.get(path);
}

export function setCachedDir(path, items) {
  state.cache.set(path, items);
}

export function clearCache() {
  state.cache.clear();
}

// ========================================
// Persistence
// ========================================

const STORAGE_KEY = 'objectiv-folder-explorer';

export function saveState() {
  try {
    const data = {
      rootPath: state.rootPath,
      expanded: Array.from(state.expanded),
      collapsed: state.collapsed
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save folder explorer state:', e);
  }
}

export function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      state.rootPath = data.rootPath || null;
      state.expanded = new Set(data.expanded || []);
      state.collapsed = data.collapsed || false;
    }
  } catch (e) {
    console.warn('Failed to load folder explorer state:', e);
  }
}

// ========================================
// Directory Loading
// ========================================

export async function loadDirectory(dirPath) {
  // Check cache first
  const cached = state.cache.get(dirPath);
  if (cached) {
    return cached;
  }

  // Check if Electron API is available
  if (!window.electronAPI?.folderExplorer) {
    console.warn('Folder explorer not available in browser mode');
    return [];
  }

  const result = await window.electronAPI.folderExplorer.readDir(dirPath);
  if (result.success) {
    state.cache.set(dirPath, result.items);
    return result.items;
  } else {
    console.error('Failed to load directory:', result.error);
    return [];
  }
}

// ========================================
// Folder Picker
// ========================================

export async function pickFolder() {
  if (!window.electronAPI?.folderExplorer) {
    console.warn('Folder explorer not available in browser mode');
    return null;
  }

  const folderPath = await window.electronAPI.folderExplorer.pickFolder();
  if (folderPath) {
    setRootPath(folderPath);
  }
  return folderPath;
}

// ========================================
// Rendering
// ========================================

/**
 * Render the folder explorer section
 * @param {HTMLElement} container - Container element to render into
 * @param {Object} options - Rendering options
 * @param {Function} options.onFileSelect - Callback when file is selected
 * @param {Function} options.onFolderSelect - Callback when folder is selected
 */
export async function render(container, options = {}) {
  const { onFileSelect, onFolderSelect } = options;

  // Clear container
  container.innerHTML = '';

  // Section header with collapse toggle
  const header = document.createElement('div');
  header.className = 'folder-explorer-header';
  header.innerHTML = `
    <span class="folder-explorer-toggle">${state.collapsed ? '>' : 'v'}</span>
    <span class="folder-explorer-title">FILES</span>
    ${state.rootPath ? `<span class="folder-explorer-path" title="${state.rootPath}">${getShortPath(state.rootPath)}</span>` : ''}
  `;
  header.onclick = (e) => {
    if (e.target.classList.contains('folder-explorer-title') || e.target.classList.contains('folder-explorer-toggle')) {
      toggleSectionCollapsed();
      render(container, options);
    }
  };
  container.appendChild(header);

  // If collapsed, stop here
  if (state.collapsed) {
    return;
  }

  // Content area
  const content = document.createElement('div');
  content.className = 'folder-explorer-content';
  container.appendChild(content);

  // No root folder set
  if (!state.rootPath) {
    const setFolderBtn = document.createElement('div');
    setFolderBtn.className = 'folder-explorer-empty';
    setFolderBtn.innerHTML = '<span class="folder-explorer-action">+ Set folder</span>';
    setFolderBtn.onclick = async () => {
      await pickFolder();
      render(container, options);
    };
    content.appendChild(setFolderBtn);
    return;
  }

  // Render tree starting from root
  await renderTree(content, state.rootPath, 0, { onFileSelect, onFolderSelect, container, options });
}

/**
 * Recursively render a directory tree
 */
async function renderTree(container, dirPath, depth, ctx) {
  const items = await loadDirectory(dirPath);

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'folder-explorer-item';
    if (state.selectedPath === item.path) {
      row.classList.add('selected');
    }
    row.style.paddingLeft = `${8 + depth * 12}px`;
    row.dataset.path = item.path;

    if (item.isDirectory) {
      const isExp = state.expanded.has(item.path);
      row.innerHTML = `
        <span class="folder-explorer-icon folder">${isExp ? 'v' : '>'}</span>
        <span class="folder-explorer-name">${item.name}</span>
      `;
      row.onclick = async (e) => {
        e.stopPropagation();
        toggleExpanded(item.path);
        if (ctx.onFolderSelect) {
          ctx.onFolderSelect(item);
        }
        setSelected(item.path);
        render(ctx.container, ctx.options);
      };
      container.appendChild(row);

      // Render children if expanded
      if (isExp) {
        await renderTree(container, item.path, depth + 1, ctx);
      }
    } else {
      row.innerHTML = `
        <span class="folder-explorer-icon file">&nbsp;</span>
        <span class="folder-explorer-name">${item.name}</span>
      `;
      row.onclick = (e) => {
        e.stopPropagation();
        setSelected(item.path);
        if (ctx.onFileSelect) {
          ctx.onFileSelect(item);
        }
        // Update selection visually
        container.querySelectorAll('.folder-explorer-item.selected').forEach(el => el.classList.remove('selected'));
        row.classList.add('selected');
      };
      container.appendChild(row);
    }
  }
}

// ========================================
// Utilities
// ========================================

function getShortPath(fullPath) {
  if (!fullPath) return '';
  const parts = fullPath.split('/').filter(Boolean);
  if (parts.length <= 2) return fullPath;
  return '.../' + parts.slice(-2).join('/');
}

export function getFileName(filePath) {
  if (!filePath) return '';
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

export function getExtension(filePath) {
  const name = getFileName(filePath);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.slice(dotIndex + 1).toLowerCase() : '';
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
  // Getters
  getRootPath,
  isExpanded,
  getSelectedPath,
  isSectionCollapsed,
  isLoading,

  // Actions
  setRootPath,
  toggleExpanded,
  setSelected,
  toggleSectionCollapsed,
  setLoading,

  // Cache
  getCachedDir,
  setCachedDir,
  clearCache,

  // Persistence
  saveState,
  loadState,

  // Operations
  loadDirectory,
  pickFolder,

  // Rendering
  render,

  // Utils
  getFileName,
  getExtension,

  // Init
  init
};
