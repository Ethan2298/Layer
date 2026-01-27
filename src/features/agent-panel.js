/**
 * Agent Panel Module
 *
 * Right-side agent chat panel with toggle and resize functionality.
 */

// ========================================
// Constants
// ========================================

const PANEL_COLLAPSED_KEY = 'layer-agent-panel-collapsed';
const PANEL_WIDTH_KEY = 'layer-agent-panel-width';
const PANEL_MODE_KEY = 'layer-agent-panel-mode';
const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 360;

const MODES = {
  AGENT: 'Agent',
  ASK: 'Ask'
};

const MODE_ICONS = {
  Agent: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  Ask: `<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>`
};

// ========================================
// Panel State
// ========================================

let isResizing = false;
let currentMode = MODES.AGENT;
let messages = [];

// ========================================
// Panel Toggle
// ========================================

/**
 * Initialize panel toggle functionality
 */
export function initPanelToggle() {
  const toggleBtn = document.getElementById('agent-panel-toggle');
  const app = document.getElementById('app');

  if (!app) return;

  // Load saved state
  const isCollapsed = localStorage.getItem(PANEL_COLLAPSED_KEY) !== 'false';
  if (isCollapsed) {
    app.classList.add('agent-panel-collapsed');
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggle);
  }
}

/**
 * Toggle panel visibility
 */
export function toggle() {
  const app = document.getElementById('app');
  if (!app) return;

  app.classList.toggle('agent-panel-collapsed');
  const collapsed = app.classList.contains('agent-panel-collapsed');
  localStorage.setItem(PANEL_COLLAPSED_KEY, collapsed);

  // Update toggle button icon
  updateToggleIcon(collapsed);
}

/**
 * Update the toggle button icon based on state
 */
function updateToggleIcon(collapsed) {
  const toggleBtn = document.getElementById('agent-panel-toggle');
  if (!toggleBtn) return;

  const svg = toggleBtn.querySelector('svg');
  if (svg) {
    // Panel icon - show opposite state (collapsed = show open icon)
    svg.innerHTML = collapsed
      ? '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line>'
      : '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line>';
  }
}

/**
 * Check if panel is collapsed
 * @returns {boolean}
 */
export function isCollapsed() {
  const app = document.getElementById('app');
  return app?.classList.contains('agent-panel-collapsed') || false;
}

/**
 * Open the panel
 */
export function open() {
  const app = document.getElementById('app');
  if (!app) return;

  app.classList.remove('agent-panel-collapsed');
  localStorage.setItem(PANEL_COLLAPSED_KEY, false);
  updateToggleIcon(false);
}

/**
 * Close the panel
 */
export function close() {
  const app = document.getElementById('app');
  if (!app) return;

  app.classList.add('agent-panel-collapsed');
  localStorage.setItem(PANEL_COLLAPSED_KEY, true);
  updateToggleIcon(true);
}

// ========================================
// Panel Resize
// ========================================

/**
 * Initialize panel resize functionality
 */
export function initPanelResize() {
  const handle = document.getElementById('agent-panel-resize-handle');
  const app = document.getElementById('app');

  if (!handle || !app) return;

  // Load saved width
  const savedWidth = localStorage.getItem(PANEL_WIDTH_KEY);
  if (savedWidth) {
    app.style.setProperty('--agent-panel-width', savedWidth + 'px');
  } else {
    app.style.setProperty('--agent-panel-width', DEFAULT_WIDTH + 'px');
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
    // Calculate width from right edge
    const newWidth = window.innerWidth - e.clientX;
    const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
    app.style.setProperty('--agent-panel-width', clamped + 'px');
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      handle.classList.remove('dragging');
      document.body.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Save width
      const width = getComputedStyle(app).getPropertyValue('--agent-panel-width');
      localStorage.setItem(PANEL_WIDTH_KEY, parseInt(width));
    }
  });
}

/**
 * Set panel width
 * @param {number} width - Width in pixels
 */
export function setWidth(width) {
  const app = document.getElementById('app');
  if (!app) return;

  const clampedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
  app.style.setProperty('--agent-panel-width', clampedWidth + 'px');
  localStorage.setItem(PANEL_WIDTH_KEY, clampedWidth);
}

/**
 * Get current panel width
 * @returns {number} Width in pixels
 */
export function getWidth() {
  const app = document.getElementById('app');
  if (!app) return DEFAULT_WIDTH;

  const width = getComputedStyle(app).getPropertyValue('--agent-panel-width');
  return parseInt(width) || DEFAULT_WIDTH;
}

// ========================================
// Mode Selector
// ========================================

/**
 * Initialize the mode selector pill
 */
export function initModeSelector() {
  const pill = document.getElementById('agent-input-pill');
  const label = document.getElementById('agent-mode-label');
  const icon = document.getElementById('agent-mode-icon');

  if (!pill || !label) return;

  // Load saved mode
  const savedMode = localStorage.getItem(PANEL_MODE_KEY);
  if (savedMode && Object.values(MODES).includes(savedMode)) {
    currentMode = savedMode;
  }
  label.textContent = currentMode;

  if (icon && MODE_ICONS[currentMode]) {
    icon.innerHTML = MODE_ICONS[currentMode];
  }

  pill.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = pill.getBoundingClientRect();

    // Use the global ContextMenu
    const ContextMenu = window.Layer?.ContextMenu;
    if (!ContextMenu) {
      console.warn('ContextMenu not available');
      return;
    }

    ContextMenu.showContextMenu({
      x: rect.left,
      y: rect.top - 8,
      items: [
        {
          label: MODES.AGENT,
          icon: MODE_ICONS.Agent,
          action: () => setMode(MODES.AGENT)
        },
        {
          label: MODES.ASK,
          icon: MODE_ICONS.Ask,
          action: () => setMode(MODES.ASK)
        }
      ]
    });
  });
}

/**
 * Set the current mode
 * @param {string} mode
 */
export function setMode(mode) {
  if (!Object.values(MODES).includes(mode)) return;

  currentMode = mode;
  localStorage.setItem(PANEL_MODE_KEY, mode);

  const label = document.getElementById('agent-mode-label');
  if (label) {
    label.textContent = mode;
  }

  const icon = document.getElementById('agent-mode-icon');
  if (icon && MODE_ICONS[mode]) {
    icon.innerHTML = MODE_ICONS[mode];
  }
}

/**
 * Get current mode
 * @returns {string}
 */
export function getMode() {
  return currentMode;
}

// ========================================
// Auto-expand Textarea
// ========================================

/**
 * Initialize auto-expanding textarea
 */
export function initTextarea() {
  const textarea = document.getElementById('agent-input-text');
  if (!textarea) return;

  const adjustHeight = () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };

  textarea.addEventListener('input', adjustHeight);
  adjustHeight();
}

// ========================================
// Chat Functionality
// ========================================

/**
 * Add a message to the chat
 * @param {string} content - Message text
 * @param {'user' | 'assistant'} role - Who sent the message
 */
function addMessage(content, role) {
  const message = {
    id: Date.now(),
    content,
    role,
    timestamp: new Date()
  };
  messages.push(message);
  renderMessage(message);
  scrollToBottom();
}

/**
 * Render a single message to the DOM
 * @param {object} message
 */
function renderMessage(message) {
  const container = document.getElementById('agent-panel-content');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `chat-message chat-message-${message.role}`;
  el.dataset.messageId = message.id;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = message.content;

  el.appendChild(bubble);
  container.appendChild(el);
}

/**
 * Scroll chat to bottom
 */
function scrollToBottom() {
  const container = document.getElementById('agent-panel-content');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
  const container = document.getElementById('agent-panel-content');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'chat-message chat-message-assistant';
  el.id = 'typing-indicator';

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble typing-bubble';
  bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';

  el.appendChild(bubble);
  container.appendChild(el);
  scrollToBottom();
}

/**
 * Remove typing indicator
 */
function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    indicator.remove();
  }
}

/**
 * Generate a dummy AI response based on mode
 * @param {string} userMessage
 */
function generateDummyResponse(userMessage) {
  const responses = {
    [MODES.AGENT]: [
      "I'll help you with that. Let me break this down into steps...",
      "Working on it. I've identified a few approaches we could take.",
      "Understood. I'll start by analyzing what needs to be done.",
      "Got it. Here's my plan for tackling this..."
    ],
    [MODES.ASK]: [
      "That's a great question. Here's what I think...",
      "Based on my understanding, the answer would be...",
      "Let me explain that for you.",
      "Here's what you should know about this..."
    ]
  };

  const modeResponses = responses[currentMode] || responses[MODES.AGENT];
  return modeResponses[Math.floor(Math.random() * modeResponses.length)];
}

/**
 * Handle sending a message
 */
function sendMessage() {
  const textarea = document.getElementById('agent-input-text');
  if (!textarea) return;

  const content = textarea.value.trim();
  if (!content) return;

  // Add user message
  addMessage(content, 'user');

  // Clear input
  textarea.value = '';
  textarea.style.height = 'auto';

  // Show typing indicator and send dummy response after delay
  showTypingIndicator();

  setTimeout(() => {
    removeTypingIndicator();
    const response = generateDummyResponse(content);
    addMessage(response, 'assistant');
  }, 800 + Math.random() * 400);
}

/**
 * Initialize chat input handlers
 */
function initChatInput() {
  const textarea = document.getElementById('agent-input-text');
  const sendBtn = document.getElementById('agent-send-btn');

  if (textarea) {
    textarea.addEventListener('keydown', (e) => {
      // Send on Enter (without shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }
}

/**
 * Clear all messages
 */
export function clearMessages() {
  messages = [];
  const container = document.getElementById('agent-panel-content');
  if (container) {
    container.innerHTML = '';
  }
}

// ========================================
// Initialize
// ========================================

export function init() {
  initPanelToggle();
  initPanelResize();
  initModeSelector();
  initTextarea();
  initChatInput();

  // Set initial toggle icon state
  const collapsed = localStorage.getItem(PANEL_COLLAPSED_KEY) !== 'false';
  updateToggleIcon(collapsed);
}

// ========================================
// Default Export
// ========================================

export default {
  init,
  initPanelToggle,
  initPanelResize,
  initModeSelector,
  toggle,
  isCollapsed,
  open,
  close,
  setWidth,
  getWidth,
  setMode,
  getMode,
  clearMessages
};
