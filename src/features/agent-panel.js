/**
 * Agent Panel Module
 *
 * Right-side agent chat panel with toggle and resize functionality.
 */

import * as AnthropicService from '../services/anthropic-service.js';
import * as ChatContext from '../services/chat-context.js';
import * as smd from '../vendor/smd.js';

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
let isStreaming = false;
let currentAbortController = null;
let currentParser = null;

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
  bubble.className = message.role === 'assistant' ? 'chat-bubble chat-bubble-markdown' : 'chat-bubble';

  if (message.role === 'assistant') {
    // Render markdown for assistant messages
    const renderer = smd.default_renderer(bubble);
    const parser = smd.parser(renderer);
    smd.parser_write(parser, message.content);
    smd.parser_end(parser);
  } else {
    bubble.textContent = message.content;
  }

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
 * Create an empty streaming bubble for assistant response
 * Initializes the streaming markdown parser
 * @returns {Object} Parser instance
 */
function createStreamingBubble() {
  const container = document.getElementById('agent-panel-content');
  if (!container) return null;

  const el = document.createElement('div');
  el.className = 'chat-message chat-message-assistant';
  el.id = 'streaming-message';

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble chat-bubble-markdown';
  bubble.id = 'streaming-bubble';

  el.appendChild(bubble);
  container.appendChild(el);
  scrollToBottom();

  // Initialize streaming markdown parser
  const renderer = smd.default_renderer(bubble);
  currentParser = smd.parser(renderer);

  return currentParser;
}

/**
 * Write a chunk to the streaming markdown parser
 * @param {string} chunk - New chunk of text
 */
function writeStreamingChunk(chunk) {
  if (currentParser) {
    smd.parser_write(currentParser, chunk);
    scrollToBottom();
  }
}

/**
 * Finalize streaming bubble (end parser and clean up)
 * @param {string} content - Final content for context
 */
function finalizeStreamingBubble(content) {
  // End the parser to flush any remaining content
  if (currentParser) {
    smd.parser_end(currentParser);
    currentParser = null;
  }

  const el = document.getElementById('streaming-message');
  const bubble = document.getElementById('streaming-bubble');

  if (el) {
    el.removeAttribute('id');
    el.dataset.messageId = Date.now();
  }

  if (bubble) {
    bubble.removeAttribute('id');
  }

  // Add to messages array
  messages.push({
    id: Date.now(),
    content,
    role: 'assistant',
    timestamp: new Date()
  });

  // Add to conversation context
  ChatContext.addMessage('assistant', content);
}

/**
 * Handle API errors
 * @param {Error} error
 */
function handleApiError(error) {
  removeTypingIndicator();
  const streamingEl = document.getElementById('streaming-message');
  if (streamingEl) streamingEl.remove();

  const container = document.getElementById('agent-panel-content');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'chat-message chat-message-assistant';

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble chat-bubble-error';

  let errorMessage = 'Something went wrong. Please try again.';

  if (error.message === 'NO_API_KEY') {
    errorMessage = 'No API key configured. Run: doppler run -- npm run web';
  } else if (error.status === 401) {
    errorMessage = 'Invalid API key. Check your Doppler configuration.';
  } else if (error.status === 429) {
    errorMessage = 'Rate limited. Please wait a moment and try again.';
  } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
    errorMessage = 'Network error. Please check your connection.';
  } else if (error.message) {
    errorMessage = error.message;
  }

  bubble.innerHTML = errorMessage;
  el.appendChild(bubble);
  container.appendChild(el);
  scrollToBottom();

  isStreaming = false;
}

/**
 * Cancel ongoing stream
 */
export function cancelStream() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  if (currentParser) {
    smd.parser_end(currentParser);
    currentParser = null;
  }
  isStreaming = false;
}

/**
 * Handle sending a message
 */
async function sendMessage() {
  const textarea = document.getElementById('agent-input-text');
  if (!textarea) return;

  const content = textarea.value.trim();
  if (!content) return;

  // Don't allow sending while streaming
  if (isStreaming) return;

  // Add user message to UI
  addMessage(content, 'user');

  // Add to conversation context
  ChatContext.addMessage('user', content);

  // Clear input
  textarea.value = '';
  textarea.style.height = 'auto';

  // Check for API key first
  if (!AnthropicService.hasApiKey()) {
    handleApiError(new Error('NO_API_KEY'));
    return;
  }

  // Show typing indicator
  showTypingIndicator();
  isStreaming = true;

  // Create abort controller for cancellation
  currentAbortController = new AbortController();

  // Create streaming bubble
  let streamingBubble = null;

  await AnthropicService.sendMessage({
    message: content,
    mode: currentMode,
    conversationHistory: ChatContext.getConversationHistory().slice(0, -1), // Exclude the message we just added
    signal: currentAbortController.signal,

    onChunk: (chunk, fullText) => {
      // Remove typing indicator on first chunk
      removeTypingIndicator();

      // Create parser if not exists
      if (!streamingBubble) {
        streamingBubble = createStreamingBubble();
      }

      // Write chunk to streaming markdown parser
      writeStreamingChunk(chunk);
    },

    onComplete: (fullText) => {
      removeTypingIndicator();
      isStreaming = false;
      currentAbortController = null;

      if (fullText) {
        finalizeStreamingBubble(fullText);
      }
    },

    onError: (error) => {
      handleApiError(error);
      currentAbortController = null;
    }
  });
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
  // Cancel any ongoing stream
  cancelStream();

  messages = [];
  ChatContext.clearHistory();

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
  clearMessages,
  cancelStream
};
