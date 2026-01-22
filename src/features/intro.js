/**
 * Intro Module
 *
 * Intro animation with typewriter effect.
 */

import AppState from '../state/app-state.js';
import { typeText } from '../utils.js';

// ========================================
// Fallback Taglines
// ========================================

const FALLBACK_TAGLINES = [
  'Proceed.',
  'Begin where you are.',
  'One step at a time.',
  'Clarity through action.',
  'Define. Refine. Execute.'
];

// ========================================
// Intro Animation
// ========================================

/**
 * Show intro animation (skippable with click or spacebar)
 * @returns {Promise<void>}
 */
export async function showIntro() {
  let tagline = FALLBACK_TAGLINES[Math.floor(Math.random() * FALLBACK_TAGLINES.length)];

  // Try to load taglines from file
  try {
    const response = await fetch('taglines.json');
    if (response.ok) {
      const taglines = await response.json();
      tagline = taglines[Math.floor(Math.random() * taglines.length)];
      AppState.updateSystemStatus('taglines', true);
    }
  } catch (e) {
    // Silently use fallback - common in file:// mode
    console.log('Using fallback taglines (fetch unavailable)');
  }

  const introText = document.getElementById('intro-text');
  const introTagline = document.getElementById('intro-tagline');
  const introCursor = document.getElementById('intro-cursor');
  const introEl = document.getElementById('intro');
  const appEl = document.getElementById('app');

  if (!introText || !introEl || !appEl) {
    // Skip intro if elements not found
    if (appEl) appEl.style.display = 'grid';
    return;
  }

  let skipped = false;

  // Skip handler
  const skip = () => {
    if (skipped) return;
    skipped = true;
    document.removeEventListener('click', skip);
    document.removeEventListener('keydown', handleKey);
    introEl.style.display = 'none';
    appEl.style.display = 'grid';
  };

  const handleKey = (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      skip();
    }
  };

  // Listen for skip inputs
  document.addEventListener('click', skip);
  document.addEventListener('keydown', handleKey);

  // Type "Layer"
  await typeText(introText, 'Layer', 80, null, () => skipped);
  if (skipped) return;

  // Wait 300ms
  await delay(300);
  if (skipped) return;

  // Show and type tagline
  if (introTagline) {
    introTagline.style.opacity = '1';
    if (introCursor) {
      introTagline.appendChild(introCursor);
    }
    await typeText(introTagline, tagline, 80, introCursor, () => skipped);
  }
  if (skipped) return;

  // Wait 1.5s
  await delay(1500);
  if (skipped) return;

  // Clean up and show app
  document.removeEventListener('click', skip);
  document.removeEventListener('keydown', handleKey);
  introEl.style.display = 'none';
  appEl.style.display = 'grid';
}

/**
 * Skip intro immediately
 */
export function skipIntro() {
  const introEl = document.getElementById('intro');
  const appEl = document.getElementById('app');

  if (introEl) introEl.style.display = 'none';
  if (appEl) appEl.style.display = 'grid';
}

// ========================================
// Helpers
// ========================================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// Default Export
// ========================================

export default {
  showIntro,
  skipIntro,
  FALLBACK_TAGLINES
};
