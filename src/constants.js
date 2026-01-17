/**
 * Application Constants
 *
 * Centralized definitions for magic strings used throughout the app.
 */

// ========================================
// Data Sections
// ========================================

export const Section = {
  OBJECTIVES: 'objectives',
  PRIORITIES: 'priorities',
  STEPS: 'steps'
};

// ========================================
// Step Status
// ========================================

/**
 * Step status lifecycle: pending → active → paused → completed
 * Note: 'active' is runtime-only, never persisted to disk
 */
export const StepStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',      // Runtime only
  PAUSED: 'paused',
  COMPLETED: 'completed'
};

// ========================================
// Edit Modes
// ========================================

export const EditMode = {
  ADD: 'add',
  EDIT: 'edit'
};

// ========================================
// Default Export
// ========================================

export default {
  Section,
  StepStatus,
  EditMode
};
