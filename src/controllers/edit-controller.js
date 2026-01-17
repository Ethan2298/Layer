/**
 * Edit Controller Module
 *
 * Unified controller for all inline editing operations.
 * Consolidates: startAddObjective, startAddPriority, startLogStep,
 * startEditInPlace, and commitEditInPlace into a single coherent API.
 */

import { generateId } from '../data/repository.js';
import { Section, EditMode } from '../constants.js';

// ========================================
// Edit State
// ========================================

let editState = {
  active: false,
  mode: null,        // EditMode.ADD | EditMode.EDIT
  section: null,     // Section.OBJECTIVES | Section.PRIORITIES | Section.STEPS
  index: -1,
  item: null,
  element: null,     // The contenteditable element
  skipBlur: false
};

// Callbacks
let onStateChange = null;
let getData = null;
let saveData = null;
let getSelectedObjectiveIndex = null;

// ========================================
// Configuration
// ========================================

/**
 * Configure the edit controller with callbacks
 */
export function configure(options) {
  onStateChange = options.onStateChange || null;
  getData = options.getData || (() => ({ objectives: [] }));
  saveData = options.saveData || (() => {});
  getSelectedObjectiveIndex = options.getSelectedObjectiveIndex || (() => 0);
}

// ========================================
// State Getters
// ========================================

export function isEditing() {
  return editState.active;
}

export function getEditState() {
  return { ...editState };
}

export function isEditingItem(section, index) {
  return editState.active &&
         editState.section === section &&
         editState.index === index;
}

// ========================================
// Edit Operations
// ========================================

/**
 * Start adding a new item
 */
export function startAdd(section, options = {}) {
  // Commit any current edit first
  if (editState.active) {
    commit();
  }

  const data = getData();
  const selectedIdx = getSelectedObjectiveIndex();
  let newItem;
  let targetIndex;

  switch (section) {
    case 'objectives':
      newItem = {
        id: generateId(),
        name: '',
        description: '',
        priorities: [],
        steps: []
      };
      data.objectives.push(newItem);
      targetIndex = data.objectives.length - 1;
      break;

    case 'priorities':
      const objForPriority = data.objectives[selectedIdx];
      if (!objForPriority || objForPriority.priorities.length >= 3) return false;
      newItem = {
        id: generateId(),
        name: '',
        description: ''
      };
      objForPriority.priorities.push(newItem);
      targetIndex = objForPriority.priorities.length - 1;
      break;

    case 'steps':
      const objForStep = data.objectives[selectedIdx];
      if (!objForStep) return false;
      const maxOrder = objForStep.steps.reduce((max, s) => Math.max(max, s.orderNumber || 0), 0);
      newItem = {
        id: generateId(),
        name: '',
        loggedAt: new Date().toISOString(),
        orderNumber: maxOrder + 1
      };
      objForStep.steps.push(newItem);
      targetIndex = objForStep.steps.length - 1;
      break;

    default:
      return false;
  }

  editState = {
    active: true,
    mode: EditMode.ADD,
    section,
    index: targetIndex,
    item: newItem,
    element: null,
    skipBlur: false
  };

  notifyStateChange();
  return true;
}

/**
 * Start editing an existing item in-place
 */
export function startEdit(section, index, element = null) {
  // Commit any current edit first
  if (editState.active) {
    commit();
  }

  const data = getData();
  const selectedIdx = getSelectedObjectiveIndex();
  let item;

  switch (section) {
    case 'objectives':
      item = data.objectives[index];
      break;

    case 'priorities':
      const objForPriority = data.objectives[selectedIdx];
      item = objForPriority?.priorities[index];
      break;

    case 'steps':
      const objForStep = data.objectives[selectedIdx];
      item = objForStep?.steps[index];
      break;
  }

  if (!item) return false;

  editState = {
    active: true,
    mode: EditMode.EDIT,
    section,
    index,
    item,
    element,
    skipBlur: false
  };

  notifyStateChange();
  return true;
}

/**
 * Commit the current edit
 */
export function commit(value = null) {
  if (!editState.active) return { committed: false };

  const data = getData();
  const selectedIdx = getSelectedObjectiveIndex();

  // Get the value from the element if not provided
  if (value === null && editState.element) {
    value = editState.element.textContent || '';
  }

  value = (value || '').trim();
  let needsRerender = false;
  let removedElement = false;

  if (editState.mode === EditMode.ADD) {
    if (!value) {
      // Empty value - remove the placeholder item
      switch (editState.section) {
        case 'objectives':
          data.objectives.splice(editState.index, 1);
          break;
        case 'priorities':
          const objP = data.objectives[selectedIdx];
          if (objP) objP.priorities.splice(editState.index, 1);
          break;
        case 'steps':
          const objS = data.objectives[selectedIdx];
          if (objS) objS.steps.splice(editState.index, 1);
          break;
      }
      removedElement = true;
      needsRerender = true;
    } else {
      // Save the new item
      editState.item.name = value;
      saveData();
    }
  } else if (editState.mode === EditMode.EDIT) {
    if (!value) {
      // Empty value - delete the item
      switch (editState.section) {
        case 'objectives':
          data.objectives.splice(editState.index, 1);
          break;
        case 'priorities':
          const objP = data.objectives[selectedIdx];
          if (objP) objP.priorities.splice(editState.index, 1);
          break;
        case 'steps':
          const objS = data.objectives[selectedIdx];
          if (objS) objS.steps.splice(editState.index, 1);
          break;
      }
      removedElement = true;
      needsRerender = true;
      saveData();
    } else if (value !== editState.item.name) {
      // Update the item
      editState.item.name = value;
      saveData();
    }
  }

  const result = {
    committed: true,
    section: editState.section,
    index: editState.index,
    needsRerender,
    removedElement
  };

  // Reset state
  editState = {
    active: false,
    mode: null,
    section: null,
    index: -1,
    item: null,
    element: null,
    skipBlur: false
  };

  notifyStateChange();
  return result;
}

/**
 * Cancel the current edit without saving
 */
export function cancel() {
  if (!editState.active) return;

  const data = getData();
  const selectedIdx = getSelectedObjectiveIndex();

  // If adding, remove the placeholder
  if (editState.mode === EditMode.ADD) {
    switch (editState.section) {
      case 'objectives':
        data.objectives.splice(editState.index, 1);
        break;
      case 'priorities':
        const objP = data.objectives[selectedIdx];
        if (objP) objP.priorities.splice(editState.index, 1);
        break;
      case 'steps':
        const objS = data.objectives[selectedIdx];
        if (objS) objS.steps.splice(editState.index, 1);
        break;
    }
  }

  // Reset state
  editState = {
    active: false,
    mode: null,
    section: null,
    index: -1,
    item: null,
    element: null,
    skipBlur: false
  };

  notifyStateChange();
}

/**
 * Set the skip blur flag
 */
export function setSkipBlur(value) {
  editState.skipBlur = value;
}

/**
 * Check and clear the skip blur flag
 */
export function checkAndClearSkipBlur() {
  if (editState.skipBlur) {
    editState.skipBlur = false;
    return true;
  }
  return false;
}

/**
 * Set the current editable element
 */
export function setElement(element) {
  editState.element = element;
}

// ========================================
// Internal Helpers
// ========================================

function notifyStateChange() {
  if (onStateChange) {
    onStateChange(getEditState());
  }
}

// ========================================
// Exports
// ========================================

export default {
  configure,
  isEditing,
  getEditState,
  isEditingItem,
  startAdd,
  startEdit,
  commit,
  cancel,
  setSkipBlur,
  checkAndClearSkipBlur,
  setElement
};
