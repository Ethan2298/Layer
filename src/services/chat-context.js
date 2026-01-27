/**
 * Chat Context Service
 *
 * Manages conversation history for the agent panel.
 */

// ========================================
// Constants
// ========================================

const MAX_MESSAGES = 20;

// ========================================
// State
// ========================================

let conversationHistory = [];

// ========================================
// Public API
// ========================================

/**
 * Get conversation history formatted for Anthropic API
 * @returns {Array<{role: string, content: string}>}
 */
export function getConversationHistory() {
  return [...conversationHistory];
}

/**
 * Add a message to conversation history
 * @param {'user' | 'assistant'} role
 * @param {string} content
 */
export function addMessage(role, content) {
  conversationHistory.push({ role, content });

  // Trim history if it exceeds max
  if (conversationHistory.length > MAX_MESSAGES) {
    // Remove oldest messages, keeping pairs to maintain context
    const excess = conversationHistory.length - MAX_MESSAGES;
    conversationHistory = conversationHistory.slice(excess);
  }
}

/**
 * Clear all conversation history
 */
export function clearHistory() {
  conversationHistory = [];
}

/**
 * Get message count
 * @returns {number}
 */
export function getMessageCount() {
  return conversationHistory.length;
}

// ========================================
// Default Export
// ========================================

export default {
  getConversationHistory,
  addMessage,
  clearHistory,
  getMessageCount
};
