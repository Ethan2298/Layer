/**
 * Sidebar Module
 *
 * Sidebar toggle and resize functionality.
 */

// ========================================
// Constants
// ========================================

const SIDEBAR_COLLAPSED_KEY = 'layer-sidebar-collapsed';
const SIDEBAR_WIDTH_KEY = 'layer-sidebar-width';
const MIN_WIDTH = 150;
const MAX_WIDTH = 500;

// ========================================
// Sidebar State
// ========================================

let isResizing = false;
let isHoverExpanded = false; // Track if expanded via hover

// ========================================
// Sidebar Toggle
// ========================================

/**
 * Initialize sidebar toggle functionality
 */
export function initSidebarToggle() {
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  const headerToggleBtn = document.getElementById('sidebar-toggle');
  const app = document.getElementById('app');

  if (!app) return;

  // Load saved state
  const isCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  if (isCollapsed) {
    app.classList.add('sidebar-collapsed');
  }

  const handleToggle = () => {
    app.classList.toggle('sidebar-collapsed');
    const collapsed = app.classList.contains('sidebar-collapsed');
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed);
  };

  if (toggleBtn) {
    toggleBtn.addEventListener('click', handleToggle);
  }

  if (headerToggleBtn) {
    headerToggleBtn.addEventListener('click', handleToggle);
  }
}

/**
 * Toggle sidebar visibility
 */
export function toggleSidebar() {
  const app = document.getElementById('app');
  if (!app) return;

  app.classList.toggle('sidebar-collapsed');
  const collapsed = app.classList.contains('sidebar-collapsed');
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed);
}

/**
 * Check if sidebar is collapsed
 * @returns {boolean}
 */
export function isSidebarCollapsed() {
  const app = document.getElementById('app');
  return app?.classList.contains('sidebar-collapsed') || false;
}

// ========================================
// Sidebar Hover Expand
// ========================================

/**
 * Initialize hover-to-expand when sidebar is collapsed
 */
export function initSidebarHover() {
  const app = document.getElementById('app');
  const sideList = document.getElementById('side-list');

  if (!app || !sideList) return;

  // Create hover trigger zone
  const trigger = document.createElement('div');
  trigger.id = 'sidebar-hover-trigger';
  app.appendChild(trigger);

  // Expand on trigger hover
  trigger.addEventListener('mouseenter', () => {
    if (app.classList.contains('sidebar-collapsed')) {
      isHoverExpanded = true;
      app.classList.remove('sidebar-collapsed');
    }
  });

  // Collapse when leaving sidebar (if hover-expanded)
  sideList.addEventListener('mouseleave', () => {
    if (isHoverExpanded) {
      isHoverExpanded = false;
      app.classList.add('sidebar-collapsed');
    }
  });
}

// ========================================
// Sidebar Resize
// ========================================

/**
 * Initialize sidebar resize functionality
 */
export function initSidebarResize() {
  const handle = document.getElementById('resize-handle');
  const app = document.getElementById('app');

  if (!handle || !app) return;

  // Load saved width
  const savedWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  if (savedWidth) {
    app.style.setProperty('--sidebar-width', savedWidth + 'px');
  }

  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    handle.classList.add('dragging');
    document.body.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
    app.style.setProperty('--sidebar-width', newWidth + 'px');
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      handle.classList.remove('dragging');
      document.body.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Save width
      const width = getComputedStyle(app).getPropertyValue('--sidebar-width');
      localStorage.setItem(SIDEBAR_WIDTH_KEY, parseInt(width));
    }
  });
}

/**
 * Set sidebar width
 * @param {number} width - Width in pixels
 */
export function setSidebarWidth(width) {
  const app = document.getElementById('app');
  if (!app) return;

  const clampedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
  app.style.setProperty('--sidebar-width', clampedWidth + 'px');
  localStorage.setItem(SIDEBAR_WIDTH_KEY, clampedWidth);
}

/**
 * Get current sidebar width
 * @returns {number} Width in pixels
 */
export function getSidebarWidth() {
  const app = document.getElementById('app');
  if (!app) return MIN_WIDTH;

  const width = getComputedStyle(app).getPropertyValue('--sidebar-width');
  return parseInt(width) || MIN_WIDTH;
}

// ========================================
// Initialize
// ========================================

export function init() {
  initSidebarToggle();
  initSidebarResize();
  initSidebarHover();
}

// ========================================
// Default Export
// ========================================

export default {
  initSidebarToggle,
  initSidebarResize,
  initSidebarHover,
  toggleSidebar,
  isSidebarCollapsed,
  setSidebarWidth,
  getSidebarWidth,
  init
};
