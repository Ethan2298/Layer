/**
 * Task List Sortable Module
 *
 * Handles drag-drop reordering and nesting of tasks within a task list.
 * Uses the same sortable module as side-list for consistent UX.
 *
 * Key Features:
 * - Drag tasks to reorder within same parent
 * - Drop into center of task to nest as child
 * - Prevents circular references (can't drop task into its descendants)
 * - Optimistic updates for instant UI feedback
 * - Error recovery with automatic revert on failure
 */

import * as TaskHelpers from '../utils/task-helpers.js';
import * as OptimisticState from '../state/optimistic-state.js';
import { showErrorToast } from './toast.js';
import { makeSortable } from '../utils/sortable.js';

let _sortableInstance = null;
let _renderCallback = () => {};
let _currentTasks = [];

/**
 * Set the callback function to call after reorder
 * @param {Function} renderFn - Function to call to refresh the view
 */
export function setRenderCallback(renderFn) {
  _renderCallback = renderFn;
}

/**
 * Set the current tasks array (needed for circular reference checks)
 * @param {Array} tasks - Flat array of all tasks
 */
export function setCurrentTasks(tasks) {
  _currentTasks = tasks;
}

/**
 * Initialize sortable on tasks container
 * @param {HTMLElement} container - The .tasks-container element
 */
export function initSortable(container) {
  if (!container) return;

  // Destroy existing instance
  destroySortable();

  _sortableInstance = makeSortable(container, {
    itemSelector: '.task-item[data-sortable="true"]',
    placeholderClass: 'sortable-placeholder',
    draggingClass: 'dragging',
    containerDraggingClass: 'is-dragging',
    dropTargetClass: 'task-drop-hover',
    dropInvalidClass: 'drop-invalid',
    dropZoneThreshold: 0.25,
    scrollSensitivity: 60,
    scrollSpeed: 25,
    distance: 4,
    sortableOptions: {
      cancel: '[contenteditable="true"], .task-checkbox, .task-toggle, .add-subtask-btn, .delete-task-btn'
    },

    // Extract task data from DOM
    getItemData: (el) => ({
      id: el.dataset.taskId,
      type: 'task',
      parentTaskId: el.dataset.parentTaskId || null,
      depth: parseInt(el.dataset.depth || '0', 10)
    }),

    // All tasks can be drop targets (can have children)
    isDropTarget: (el) => el.dataset.type === 'task',

    // Validate drops - prevent circular references
    canDrop: (draggedEl, targetEl, draggedData) => {
      const draggedId = draggedData.id;
      const targetId = targetEl.dataset.taskId;

      // Can't drop task into itself
      if (draggedId === targetId) return false;

      // Can't drop task into its own descendants
      if (TaskHelpers.isTaskDescendantOf(_currentTasks, targetId, draggedId)) {
        return false;
      }

      return true;
    },

    // Mark invalid drop targets
    markInvalidTargets: (draggedEl, draggedData, invalidClass) => {
      const draggedId = draggedData.id;
      document.querySelectorAll('.task-item').forEach(el => {
        const targetId = el.dataset.taskId;
        if (targetId === draggedId ||
            TaskHelpers.isTaskDescendantOf(_currentTasks, targetId, draggedId)) {
          el.classList.add(invalidClass);
        }
      });
    },

    // Handle reorder (drop above/below another task)
    onReorder: handleReorder,

    // Handle drop into task (make it a child)
    onDropInto: handleDropInto,

    // Track drag state
    onDragStart: ({ data }) => {
      console.log('Dragging task:', data.id);
    },

    onDragEnd: () => {
      console.log('Drag ended');
    }
  });
}

/**
 * Refresh sortable after DOM changes
 */
export function refreshSortable() {
  if (_sortableInstance) {
    _sortableInstance.refresh();
  }
}

/**
 * Destroy sortable instance
 */
export function destroySortable() {
  if (_sortableInstance) {
    _sortableInstance.destroy();
    _sortableInstance = null;
  }
}

/**
 * Handle reorder - task dropped above/below another task
 */
async function handleReorder({ itemId, prevEl, nextEl }) {
  const targetParentId = getTargetParentId(prevEl, nextEl);

  console.log('Reorder task:', {
    taskId: itemId,
    targetParentId,
    prev: prevEl?.dataset.taskId,
    next: nextEl?.dataset.taskId
  });

  await updateTaskPosition(itemId, targetParentId, prevEl, nextEl);
}

/**
 * Handle drop into task (center zone)
 */
async function handleDropInto({ itemId, targetId }) {
  console.log('Drop into task:', { taskId: itemId, newParentId: targetId });

  // Add task as child of target (at end of children list)
  await updateTaskPosition(itemId, targetId, null, null);
}

/**
 * Determine target parent ID from neighboring tasks
 */
function getTargetParentId(prevEl, nextEl) {
  // If prev exists, check if next is its child
  if (prevEl) {
    const prevDepth = parseInt(prevEl.dataset.depth || '0', 10);
    const nextDepth = nextEl ? parseInt(nextEl.dataset.depth || '0', 10) : -1;

    // Next is deeper = we're inside prev's children
    if (nextDepth > prevDepth) {
      return prevEl.dataset.taskId;
    }

    // Same or shallower = use prev's parent
    return prevEl.dataset.parentTaskId || null;
  }

  // If next exists, use its parent
  if (nextEl) {
    return nextEl.dataset.parentTaskId || null;
  }

  // Root level
  return null;
}

/**
 * Update task position with optimistic UI updates
 */
async function updateTaskPosition(taskId, targetParentId, prevEl, nextEl) {
  const Repository = window.Layer?.Repository;
  if (!Repository) {
    console.error('Repository not available');
    return;
  }

  // Build updates array
  const updates = buildUpdatesArray(taskId, targetParentId, prevEl, nextEl);
  if (!updates) {
    console.error('Could not build updates');
    return;
  }

  console.log('Saving task updates:', updates);

  // Optimistic update pattern
  OptimisticState.optimisticUpdate(
    // Local mutation (synchronous)
    () => {
      applyUpdatesLocally(updates);
      _renderCallback();
    },
    // Persist async
    async () => {
      await persistUpdates(updates, Repository);
    },
    // Error handler
    {
      onError: (error) => {
        console.error('Task reorder failed:', error);
        showErrorToast('Move failed. Changes reverted.');
        _renderCallback();
      }
    }
  );
}

/**
 * Build updates array for all siblings in target parent
 */
function buildUpdatesArray(taskId, targetParentId, prevEl, nextEl) {
  // Get all tasks with same parent
  let siblings = _currentTasks.filter(t =>
    (t.parentTaskId || null) === targetParentId
  );

  // Sort by current orderIndex
  siblings.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  // Remove the moved task
  siblings = siblings.filter(t => t.id !== taskId);

  // Find the moved task
  const movedTask = _currentTasks.find(t => t.id === taskId);
  if (!movedTask) return null;

  // Determine insert position
  let insertIndex = 0;
  if (prevEl) {
    const prevId = prevEl.dataset.taskId;
    const prevIndex = siblings.findIndex(t => t.id === prevId);
    if (prevIndex !== -1) {
      insertIndex = prevIndex + 1;
    }
  } else if (!nextEl) {
    // No prev and no next = drop into center (end of list)
    insertIndex = siblings.length;
  }

  // Insert at position
  siblings.splice(insertIndex, 0, movedTask);

  // Renumber all siblings
  return siblings.map((task, index) => ({
    id: task.id,
    orderIndex: index * 1000,
    parentTaskId: targetParentId
  }));
}

/**
 * Apply updates to local state
 */
function applyUpdatesLocally(updates) {
  updates.forEach(update => {
    const task = _currentTasks.find(t => t.id === update.id);
    if (task) {
      task.orderIndex = update.orderIndex;
      task.parentTaskId = update.parentTaskId;
    }
  });
}

/**
 * Persist updates to database
 */
async function persistUpdates(updates, Repository) {
  const promises = updates.map(update =>
    Repository.updateTaskOrder(update.id, update.orderIndex, update.parentTaskId)
  );
  await Promise.all(promises);
}

export default {
  initSortable,
  refreshSortable,
  destroySortable,
  setRenderCallback,
  setCurrentTasks
};
