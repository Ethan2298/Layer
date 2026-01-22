/**
 * Directory Listing Component
 *
 * Renders a file-tree style directory listing with inline folder expansion.
 * Used on Home and Folder pages to show contents.
 */

import AppState from '../state/app-state.js';
import * as TabState from '../state/tab-state.js';
import * as TreeUtils from '../data/tree-utils.js';

// ========================================
// Icon SVGs
// ========================================

const ICONS = {
  folder: `<svg class="dir-icon dir-icon-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>`,
  folderOpen: `<svg class="dir-icon dir-icon-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z"/>
  </svg>`,
  objective: `<svg class="dir-icon dir-icon-objective" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="1"/>
  </svg>`,
  note: `<svg class="dir-icon dir-icon-note" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>`,
  bookmark: `<svg class="dir-icon dir-icon-bookmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>`,
  chevronRight: `<svg class="dir-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M9 6l6 6-6 6"/>
  </svg>`,
  chevronDown: `<svg class="dir-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6 9l6 6 6-6"/>
  </svg>`
};

// ========================================
// State Management
// ========================================

// Local expansion state for directory listing (separate from sidebar)
const directoryExpanded = new Set();

/**
 * Check if a folder is expanded in directory listing
 */
function isExpanded(folderId) {
  return directoryExpanded.has(folderId);
}

/**
 * Toggle folder expansion in directory listing
 */
function toggleExpanded(folderId) {
  if (directoryExpanded.has(folderId)) {
    directoryExpanded.delete(folderId);
  } else {
    directoryExpanded.add(folderId);
  }
}

// ========================================
// Main Render Function
// ========================================

/**
 * Render a directory listing into a container
 * @param {HTMLElement} container - Container to render into
 * @param {Object} options - Options
 * @param {string|null} options.folderId - Folder ID to show contents of (null for root)
 * @param {Function} options.onItemClick - Callback when item is clicked
 * @param {Function} options.onFolderToggle - Callback when folder expand/collapse is toggled
 */
export function renderDirectoryListing(container, options = {}) {
  const {
    folderId = null,
    onItemClick = () => {},
    onFolderToggle = () => {}
  } = options;

  const data = AppState.getData();

  // Build tree from flat data
  const tree = TreeUtils.flatToTree(
    data.objectives || [],
    data.folders || [],
    data.notes || [],
    [] // Don't include bookmarks in directory listing
  );

  // Get items to display
  let items;
  if (folderId === null) {
    // Root level - show all root items
    items = tree;
  } else {
    // Folder contents - find the folder and get its children
    const folder = TreeUtils.findFolder(tree, folderId);
    items = folder ? folder.children || [] : [];
  }

  // Flatten for render with expansion state
  const flatItems = flattenWithExpansion(items, directoryExpanded);

  // Clear and render
  container.innerHTML = '';

  const listContainer = document.createElement('div');
  listContainer.className = 'directory-listing';

  if (flatItems.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'directory-empty';
    emptyState.textContent = folderId ? 'This folder is empty' : 'No items yet';
    listContainer.appendChild(emptyState);
  } else {
    flatItems.forEach(item => {
      const element = createDirectoryItem(item, onItemClick, onFolderToggle, container, options);
      listContainer.appendChild(element);
    });
  }

  container.appendChild(listContainer);
}

/**
 * Flatten tree with expansion state (only expand what's in directoryExpanded)
 */
function flattenWithExpansion(items, expanded, depth = 0) {
  const result = [];

  items.forEach(item => {
    result.push({
      ...item,
      depth
    });

    // If it's an expanded folder, recurse into children
    if (item.type === 'folder' && expanded.has(item.id) && item.children) {
      const childItems = flattenWithExpansion(item.children, expanded, depth + 1);
      result.push(...childItems);
    }
  });

  return result;
}

/**
 * Create a directory item element
 */
function createDirectoryItem(item, onItemClick, onFolderToggle, container, options) {
  const div = document.createElement('div');
  div.className = 'directory-item';
  div.dataset.type = item.type;
  div.dataset.id = item.id;
  div.dataset.depth = item.depth || 0;

  // Build content
  let html = '';

  // Folder toggle or spacer
  if (item.type === 'folder') {
    const hasChildren = item.children && item.children.length > 0;
    const isExp = isExpanded(item.id);

    if (hasChildren) {
      html += `<span class="dir-toggle">${isExp ? ICONS.chevronDown : ICONS.chevronRight}</span>`;
    } else {
      html += `<span class="dir-toggle-spacer"></span>`;
    }
  } else {
    html += `<span class="dir-toggle-spacer"></span>`;
  }

  // Icon
  switch (item.type) {
    case 'folder':
      html += isExpanded(item.id) ? ICONS.folderOpen : ICONS.folder;
      break;
    case 'objective':
      html += ICONS.objective;
      break;
    case 'note':
      html += ICONS.note;
      break;
    case 'bookmark':
      html += ICONS.bookmark;
      break;
    default:
      html += ICONS.note;
  }

  // Name
  const name = item.name || (item.type === 'note' ? 'Untitled Note' : 'Unnamed');
  const escapedName = name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html += `<span class="dir-name">${escapedName}</span>`;

  div.innerHTML = html;

  // Click handlers
  div.addEventListener('click', (e) => {
    if (item.type === 'folder') {
      // Check if clicked on toggle
      const toggle = e.target.closest('.dir-toggle');
      if (toggle || e.target.closest('.dir-icon-folder')) {
        // Toggle expansion
        toggleExpanded(item.id);
        onFolderToggle(item);
        // Re-render the listing
        renderDirectoryListing(container, options);
        return;
      }
    }

    // Navigate to item
    onItemClick(item);
  });

  return div;
}

// ========================================
// Export
// ========================================

export default {
  renderDirectoryListing,
  isExpanded,
  toggleExpanded
};
