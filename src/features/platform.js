/**
 * Platform Module
 *
 * Platform detection, theme toggle, and status reporter.
 */

import AppState from '../state/app-state.js';
import { createNewTab } from './tabs.js';

// ========================================
// Platform Detection
// ========================================

export const isElectron = !!(window.electronAPI);
export const isBrowser = !isElectron;

// ========================================
// Theme Management
// ========================================

/**
 * Apply saved theme on page load
 */
export function applyStoredTheme() {
  const stored = localStorage.getItem('layer-theme');
  // Remove both mode classes first
  document.body.classList.remove('light-mode', 'solarized-mode');

  if (stored === 'light') {
    document.body.classList.add('light-mode');
  } else if (stored === 'solarized') {
    document.body.classList.add('solarized-mode');
  }
  // 'dark' is the default (no class needed)
}

/**
 * Get current theme
 * @returns {'light' | 'dark' | 'solarized'}
 */
export function getCurrentTheme() {
  if (document.body.classList.contains('light-mode')) return 'light';
  if (document.body.classList.contains('solarized-mode')) return 'solarized';
  return 'dark';
}

/**
 * Set theme
 * @param {'light' | 'dark' | 'solarized'} theme
 */
export function setTheme(theme) {
  // Remove both mode classes first
  document.body.classList.remove('light-mode', 'solarized-mode');

  if (theme === 'light') {
    document.body.classList.add('light-mode');
  } else if (theme === 'solarized') {
    document.body.classList.add('solarized-mode');
  }
  // 'dark' is the default (no class needed)
  localStorage.setItem('layer-theme', theme);
}

// ========================================
// Settings Modal
// ========================================

/**
 * Initialize settings button and modal
 */
export function initSettingsButton() {
  const btn = document.getElementById('settings-btn');
  const modal = document.getElementById('settings-modal');
  const closeBtn = document.getElementById('settings-modal-close');
  const themeSelect = document.getElementById('settings-theme-select');

  // Apply saved theme on load
  applyStoredTheme();

  if (!btn || !modal) return;

  // Open modal on settings button click
  btn.addEventListener('click', openSettingsModal);

  // Close modal on close button click
  if (closeBtn) {
    closeBtn.addEventListener('click', closeSettingsModal);
  }

  // Close modal on overlay click (outside the modal content)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeSettingsModal();
    }
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display !== 'none') {
      closeSettingsModal();
    }
  });

  // Theme select change handler
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      setTheme(e.target.value);
    });
  }
}

/**
 * Open settings modal
 */
export function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  const themeSelect = document.getElementById('settings-theme-select');

  if (!modal) return;

  // Update theme select to current value
  if (themeSelect) {
    const currentTheme = getCurrentTheme();
    themeSelect.value = currentTheme;
  }

  modal.style.display = 'flex';
}

/**
 * Close settings modal
 */
export function closeSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Open settings tab (deprecated - now opens modal)
 */
export function openSettingsTab() {
  openSettingsModal();
}

// ========================================
// Status Reporter
// ========================================

export function updateStatusReporter() {
  const container = document.getElementById('status-items');
  if (!container) return;

  const systemStatus = AppState.getSystemStatus();

  // Get Supabase storage status
  const storageStatus = window.Layer?.Repository?.getStorageStatus?.() || { isReady: false };
  const storageLabel = storageStatus.isReady ? 'connected' : 'not configured';
  const storageSt = storageStatus.isReady ? 'ok' : 'warn';

  const items = [
    { label: 'Platform', value: 'web', status: 'ok' },
    { label: 'Supabase', value: storageLabel, status: storageSt },
    { label: 'Taglines', value: systemStatus.taglines ? 'loaded' : 'fallback', status: systemStatus.taglines ? 'ok' : 'warn' }
  ];

  container.innerHTML = items.map(item =>
    `<div class="status-item"><span>${item.label}</span><span class="status-${item.status}">${item.value}</span></div>`
  ).join('');

  if (systemStatus.errors.length > 0) {
    container.innerHTML += `<div style="margin-top:8px;color:#ff5555;font-size:10px;">Errors: ${systemStatus.errors.length}</div>`;
    systemStatus.errors.slice(-3).forEach(err => {
      container.innerHTML += `<div style="color:#ff5555;font-size:9px;word-break:break-all;">${err}</div>`;
    });
  }
}

export function toggleStatusReporter() {
  const reporter = document.getElementById('status-reporter');
  if (reporter) {
    reporter.classList.toggle('visible');
    updateStatusReporter();
  }
}

export function initStatusReporter() {
  // Status toggle button
  document.getElementById('status-toggle')?.addEventListener('click', toggleStatusReporter);
  document.getElementById('status-close')?.addEventListener('click', toggleStatusReporter);

  // Keyboard shortcut 'i' for inspect
  document.addEventListener('keydown', (e) => {
    if (e.key === 'i' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const active = document.activeElement;
      if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.contentEditable === 'true') return;
      e.preventDefault();
      toggleStatusReporter();
    }
  });
}

// ========================================
// Window Controls (Electron)
// ========================================

export function initWindowControls() {
  if (!window.electronAPI) return;

  document.getElementById('btn-minimize')?.addEventListener('click', () => window.electronAPI.minimize());
  document.getElementById('btn-maximize')?.addEventListener('click', () => window.electronAPI.maximize());
  document.getElementById('btn-close')?.addEventListener('click', () => window.electronAPI.close());
}

// ========================================
// Browser Zoom Prevention
// ========================================

export function initZoomPrevention() {
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
      e.preventDefault();
    }
  });
}

// ========================================
// LocalStorage Test
// ========================================

export function testLocalStorage() {
  try {
    localStorage.setItem('_test', '1');
    localStorage.removeItem('_test');
    AppState.updateSystemStatus('localStorage', true);
    return true;
  } catch (e) {
    AppState.reportError('Storage', e);
    return false;
  }
}

// ========================================
// Initialize Platform Module
// ========================================

export function init() {
  // Apply browser mode class
  if (isBrowser) {
    document.body.classList.add('browser-mode');
  }

  // Update system status
  AppState.updateSystemStatus('platform', isBrowser ? 'browser' : 'electron');
  AppState.updateSystemStatus('clarityAPI', isElectron && !!window.electronAPI?.calculateClarity);

  // Test localStorage
  testLocalStorage();

  // Initialize features
  initSettingsButton();
  initStatusReporter();
  initWindowControls();
  initZoomPrevention();
}

// ========================================
// Default Export
// ========================================

export default {
  isElectron,
  isBrowser,
  applyStoredTheme,
  getCurrentTheme,
  setTheme,
  initSettingsButton,
  openSettingsModal,
  closeSettingsModal,
  openSettingsTab,
  updateStatusReporter,
  toggleStatusReporter,
  initStatusReporter,
  initWindowControls,
  initZoomPrevention,
  testLocalStorage,
  init
};
