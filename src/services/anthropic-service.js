/**
 * Anthropic Service
 *
 * Core service for Claude API calls with streaming support.
 * API key is provided via Doppler secrets injection.
 */

import {
  ANTHROPIC_API_ENDPOINT,
  ANTHROPIC_MODEL,
  ANTHROPIC_MAX_TOKENS
} from '../config.js';

// ========================================
// API Key Management (Doppler)
// ========================================

/**
 * Get API key from Doppler secrets
 * @returns {string | null}
 */
export function getApiKey() {
  return window.__DOPPLER_SECRETS__?.ANTHROPIC_API_KEY || null;
}

/**
 * Check if API key is configured
 * @returns {boolean}
 */
export function hasApiKey() {
  const key = getApiKey();
  return !!(key && key.trim().length > 0);
}

// ========================================
// Streaming API Call
// ========================================

/**
 * Send a message to Claude with streaming response
 * @param {Object} options
 * @param {string} options.message - User message
 * @param {string} options.mode - 'Agent' or 'Ask'
 * @param {Array} options.conversationHistory - Previous messages for context
 * @param {Function} options.onChunk - Callback for each text chunk
 * @param {Function} options.onComplete - Callback when streaming completes
 * @param {Function} options.onError - Callback for errors
 * @param {AbortSignal} options.signal - AbortController signal for cancellation
 */
export async function sendMessage({
  message,
  mode,
  conversationHistory = [],
  onChunk,
  onComplete,
  onError,
  signal
}) {
  const apiKey = getApiKey();

  if (!apiKey) {
    onError?.(new Error('NO_API_KEY'));
    return;
  }

  // Build system prompt based on mode
  const systemPrompt = mode === 'Agent'
    ? 'You are a helpful assistant that helps users accomplish tasks. Break down complex tasks into clear, actionable steps. Be concise but thorough. Focus on practical solutions.'
    : 'You are a helpful assistant that answers questions clearly and concisely. Provide accurate, well-structured information. If you\'re unsure about something, say so.';

  // Build messages array
  const messages = [
    ...conversationHistory,
    { role: 'user', content: message }
  ];

  try {
    const response = await fetch(ANTHROPIC_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        system: systemPrompt,
        messages,
        stream: true
      }),
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error?.message || `HTTP ${response.status}`);
      error.status = response.status;
      error.type = errorData.error?.type;
      throw error;
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            continue;
          }

          try {
            const event = JSON.parse(data);

            // Handle content_block_delta events
            if (event.type === 'content_block_delta' && event.delta?.text) {
              const chunk = event.delta.text;
              fullText += chunk;
              onChunk?.(chunk, fullText);
            }

            // Handle message_stop event
            if (event.type === 'message_stop') {
              onComplete?.(fullText);
              return;
            }

            // Handle errors in stream
            if (event.type === 'error') {
              throw new Error(event.error?.message || 'Stream error');
            }
          } catch (parseError) {
            // Ignore JSON parse errors for non-JSON lines
            if (data.trim() && !data.startsWith('event:')) {
              console.warn('Failed to parse SSE data:', data);
            }
          }
        }
      }
    }

    // Stream completed without message_stop
    onComplete?.(fullText);

  } catch (error) {
    if (error.name === 'AbortError') {
      // Request was cancelled - don't call onError
      return;
    }
    onError?.(error);
  }
}

// ========================================
// Default Export
// ========================================

export default {
  getApiKey,
  hasApiKey,
  sendMessage
};
