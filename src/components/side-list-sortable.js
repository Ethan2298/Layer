/**
 * Side List Sortable - Drag-drop for side navigation
 *
 * Uses the generic sortable module with app-specific callbacks for:
 * - Item data extraction (objectives, folders, notes, bookmarks)
 * - Folder drop-into validation (circular reference prevention)
 * - Optimistic state updates with Supabase persistence
 *
 * Drop zones:
 * - Top/bottom 25% of folder row = reorder (drop above/below)
 * - Center 50% of folder row = drop INTO folder
 */

import AppState from '../state/app-state.js';
import * as TreeUtils from '../data/tree-utils.js';
import * as OptimisticState from '../state/optimistic-state.js';
import { showErrorToast } from './toast.js';
import { makeNestedSortable } from '../utils/sortable.js';

// ========================================
// Module State
// ========================================

let _sortableInstance = null;
let _renderSideList = () => {};

// ========================================
// Public API
// ========================================

export function setRenderCallback(renderFn) {
  _renderSideList = renderFn;
}

/**
 * Initialize sortable on side list and all nested folder containers
 */
export function initSortable() {
  const $mainContainer = $('#side-list-items');
  if (!$mainContainer.length) return;

  // Check if jQuery UI is loaded
  if (!$.fn.sortable) {
    console.error('jQuery UI Sortable not loaded!');
    return;
  }

  // Destroy existing instance first
  destroySortable();

  // Create nested sortable for main container + folder children
  _sortableInstance = makeNestedSortable(
    $mainContainer,
    '.folder-children.sortable-container',
    {
      itemSelector: '.side-item[data-sortable="true"]',
      placeholderClass: 'sortable-placeholder',
      draggingClass: 'dragging',
      containerDraggingClass: 'is-dragging',
      dropTargetClass: 'folder-drop-hover',
      dropInvalidClass: 'drop-invalid',
      dropZoneThreshold: 0.25,
      scrollSensitivity: 60,
      scrollSpeed: 25,
      distance: 4,

      // Extract item data from DOM element
      getItemData,

      // Folders are drop targets
      isDropTarget: (el) => el.dataset.type === 'folder',

      // Validate drop (prevent circular folder references)
      canDrop: (draggedEl, targetEl, draggedData) => {
        const targetId = targetEl.dataset.folderId;

        // Can't drop folder into itself
        if (draggedData.type === 'folder' && draggedData.id === targetId) {
          return false;
        }

        // Can't drop folder into its own descendants
        if (draggedData.type === 'folder') {
          const tree = AppState.getTree();
          if (TreeUtils.isDescendantOf(tree, targetId, draggedData.id)) {
            return false;
          }
        }

        return true;
      },

      // Mark invalid drop targets when dragging a folder
      markInvalidTargets: (draggedEl, draggedData, invalidClass) => {
        if (draggedData.type !== 'folder') return;

        const tree = AppState.getTree();
        const draggedId = draggedData.id;

        $('.side-item.folder-row').each(function() {
          const $folder = $(this);
          const targetId = $folder.data('folderId');

          // Can't drop into self
          if (targetId === draggedId) {
            $folder.addClass(invalidClass);
            return;
          }

          // Can't drop into descendants
          if (TreeUtils.isDescendantOf(tree, targetId, draggedId)) {
            $folder.addClass(invalidClass);
          }
        });
      },

      // Custom helper for folders (hide children)
      createHelper: (e, item) => {
        // For folders, hide children before creating helper
        if (item.hasClass('folder-row')) {
          item.next('.folder-children').addClass('drag-hidden');
        }

        const $clone = item.clone();
        $clone.css({
          width: item.outerWidth(),
          height: item.outerHeight()
        });
        return $clone;
      },

      // Handle drag start - store state in AppState
      onDragStart: ({ element, data }) => {
        const $item = $(element);
        const $parentContainer = $item.closest('.sortable-container').length
          ? $item.closest('.sortable-container')
          : $item.closest('#side-list-items');

        AppState.setDraggedItem({
          type: data.type,
          id: data.id,
          originalParentId: $parentContainer.data('parentFolderId') || null
        });
      },

      // Handle drag end - clear AppState
      onDragEnd: () => {
        // Clean up folder children visibility
        $('.drag-hidden').removeClass('drag-hidden');
        AppState.setDraggedItem(null);
      },

      // Handle reorder (drop above/below another item)
      onReorder: handleReorder,

      // Handle drop into folder
      onDropInto: handleDropInto
    }
  );
}

/**
 * Refresh sortable after list re-render
 */
export function refreshSortable() {
  if (_sortableInstance) {
    _sortableInstance.refreshAll();
  } else {
    initSortable();
  }
}

/**
 * Destroy all sortable instances
 */
export function destroySortable() {
  if (_sortableInstance) {
    _sortableInstance.destroyAll();
    _sortableInstance = null;
  }
}

// ========================================
// Data Extraction
// ========================================

/**
 * Extract item data from a DOM element
 */
function getItemData(el) {
  const type = el.dataset.type;
  let id;

  switch (type) {
    case 'objective':
      id = el.dataset.objectiveId;
      break;
    case 'folder':
      id = el.dataset.folderId;
      break;
    case 'bookmark':
      id = el.dataset.bookmarkId;
      break;
    case 'note':
      id = el.dataset.noteId;
      break;
    case 'task-list':
      id = el.dataset.taskListId;
      break;
  }

  return {
    id,
    type,
    folderId: el.dataset.folderId || null,
    depth: parseInt(el.dataset.depth || '0', 10)
  };
}

// ========================================
// Drop Handlers
// ========================================

/**
 * Handle reorder - item dropped above/below another item
 */
async function handleReorder({ itemId, itemType, data, prevEl, nextEl, prevData, nextData }) {
  // Determine target parent from neighbors
  const targetParentId = getTargetParentId(prevEl, nextEl, prevData, nextData, itemType);

  console.log('Drop reorder:', {
    type: itemType,
    id: itemId,
    targetParentId,
    prev: prevData?.type,
    next: nextData?.type
  });

  // Update item and renumber siblings
  await updateItemPosition(itemType, itemId, targetParentId, prevEl, nextEl);
}

/**
 * Handle drop into folder (center zone)
 */
async function handleDropInto({ itemId, itemType, targetId }) {
  console.log('Dropping into folder:', { type: itemType, id: itemId, folderId: targetId });

  // Add item to end of folder (no prev/next)
  await updateItemPosition(itemType, itemId, targetId, null, null);
}

// ========================================
// Position Calculation
// ========================================

/**
 * Get the target parent ID based on neighboring items
 */
function getTargetParentId(prevEl, nextEl, prevData, nextData, droppedType) {
  // If prev is an expanded folder and next is inside it, drop INTO the folder
  if (prevEl && prevData?.type === 'folder') {
    const prevDepth = prevData.depth;
    const nextDepth = nextData?.depth ?? -1;

    // Next item is deeper = we're inside the folder
    if (nextDepth > prevDepth) {
      return prevData.id;
    }
  }

  // If prev is a non-folder item, use its folder
  if (prevEl && prevData?.type !== 'folder') {
    return prevData.folderId || null;
  }

  // If next is a non-folder item, use its folder
  if (nextEl && nextData?.type !== 'folder') {
    return nextData.folderId || null;
  }

  // Root level
  return null;
}

// ========================================
// Position Updates
// ========================================

/**
 * Update item position and renumber all siblings in the target folder
 * Uses optimistic updates: UI updates immediately, persistence is async
 */
function updateItemPosition(type, id, targetParentId, prevEl, nextEl) {
  const Repository = window.Layer?.Repository;
  const NoteStorage = window.Layer?.NoteStorage;
  const BookmarkStorage = window.Layer?.BookmarkStorage;

  // Capture scroll position for restoration
  const $container = $('#side-list-items');
  const scrollTop = $container.length ? $container[0].scrollTop : 0;

  // Build updates array before mutation
  const updates = buildUpdatesArray(type, id, targetParentId, prevEl, nextEl);

  if (!updates) {
    console.error('Could not build updates for:', type, id);
    _renderSideList();
    restoreScroll(scrollTop);
    return;
  }

  console.log('Saving updates:', updates);

  // Optimistic update: local first, persist async
  OptimisticState.optimisticUpdate(
    // Local mutation (synchronous)
    () => {
      applyUpdatesLocally(type, updates);
      AppState.rebuildTree(BookmarkStorage?.loadAllBookmarks?.() || []);
      _renderSideList();
      restoreScroll(scrollTop);
    },
    // Persist function (async)
    async () => {
      await persistUpdates(type, updates, Repository, NoteStorage, BookmarkStorage);
    },
    // Options
    {
      onError: (error) => {
        console.error('Drag-drop save failed:', error);
        showErrorToast('Move failed. Changes reverted.');
        _renderSideList();
        restoreScroll(scrollTop);
      }
    }
  );
}

/**
 * Build the array of updates needed for the position change
 * Gets ALL items in the folder (all types) and renumbers them
 */
function buildUpdatesArray(type, id, targetParentId, prevEl, nextEl) {
  const data = AppState.getData();
  const BookmarkStorage = window.Layer?.BookmarkStorage;

  // Get ALL items in the target folder (all types share the same orderIndex space)
  let allItems = [];

  // Folders (children of targetParentId)
  data.folders
    .filter(f => (f.parentId || null) === targetParentId)
    .forEach(f => allItems.push({ ...f, _type: 'folder' }));

  // Objectives
  data.objectives
    .filter(o => (o.folderId || null) === targetParentId)
    .forEach(o => allItems.push({ ...o, _type: 'objective' }));

  // Notes
  (data.notes || [])
    .filter(n => (n.folderId || null) === targetParentId)
    .forEach(n => allItems.push({ ...n, _type: 'note' }));

  // Bookmarks
  (BookmarkStorage?.loadAllBookmarks() || [])
    .filter(b => (b.folderId || null) === targetParentId)
    .forEach(b => allItems.push({ ...b, _type: 'bookmark' }));

  // Task Lists
  (data.taskLists || [])
    .filter(tl => (tl.folderId || null) === targetParentId)
    .forEach(tl => allItems.push({ ...tl, _type: 'task-list' }));

  // Sort all by current orderIndex
  allItems.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  // Remove the dropped item from the list (if it was already there)
  allItems = allItems.filter(item => item.id !== id);

  // Find the dropped item from its original location
  let droppedItem;
  if (type === 'folder') {
    droppedItem = data.folders.find(f => f.id === id);
  } else if (type === 'objective') {
    droppedItem = data.objectives.find(o => o.id === id);
  } else if (type === 'note') {
    droppedItem = (data.notes || []).find(n => n.id === id);
  } else if (type === 'bookmark') {
    droppedItem = (BookmarkStorage?.loadAllBookmarks() || []).find(b => b.id === id);
  } else if (type === 'task-list') {
    droppedItem = (data.taskLists || []).find(tl => tl.id === id);
  }

  if (!droppedItem) {
    return null;
  }

  // Add type marker to dropped item
  const droppedWithType = { ...droppedItem, _type: type };

  // Determine insert position based on prev/next
  let insertIndex = 0;

  if (prevEl) {
    const prevId = getItemIdFromElement(prevEl);
    // Find prev item in allItems (any type)
    const prevIndex = allItems.findIndex(item => item.id === prevId);
    if (prevIndex !== -1) {
      insertIndex = prevIndex + 1;
    }
  } else if (!nextEl) {
    // No prev and no next = dropping INTO folder (center zone drop)
    // Insert at end
    insertIndex = allItems.length;
  }

  // Insert dropped item at position
  allItems.splice(insertIndex, 0, droppedWithType);

  // Renumber ALL items and build updates with correct parent field per type
  return allItems.map((item, index) => ({
    id: item.id,
    _type: item._type,
    orderIndex: index * 1000,
    parentId: item._type === 'folder' ? targetParentId : undefined,
    folderId: item._type !== 'folder' ? targetParentId : undefined
  }));
}

/**
 * Get item ID from a DOM element
 */
function getItemIdFromElement(el) {
  if (!el) return null;
  const type = el.dataset.type;
  switch (type) {
    case 'objective': return el.dataset.objectiveId;
    case 'folder': return el.dataset.folderId;
    case 'bookmark': return el.dataset.bookmarkId;
    case 'note': return el.dataset.noteId;
    case 'task-list': return el.dataset.taskListId;
    default: return null;
  }
}

/**
 * Apply updates to local state (mutate AppState directly)
 */
function applyUpdatesLocally(type, updates) {
  const data = AppState.getData();
  const BookmarkStorage = window.Layer?.BookmarkStorage;

  for (const update of updates) {
    const itemType = update._type || type;

    if (itemType === 'folder') {
      const folder = data.folders.find(f => f.id === update.id);
      if (folder) {
        folder.orderIndex = update.orderIndex;
        folder.parentId = update.parentId;
      }
    } else if (itemType === 'objective') {
      const objective = data.objectives.find(o => o.id === update.id);
      if (objective) {
        objective.orderIndex = update.orderIndex;
        objective.folderId = update.folderId;
      }
    } else if (itemType === 'note') {
      const note = (data.notes || []).find(n => n.id === update.id);
      if (note) {
        note.orderIndex = update.orderIndex;
        note.folderId = update.folderId;
      }
    } else if (itemType === 'bookmark') {
      BookmarkStorage?.updateBookmarkOrder?.(update.id, update.orderIndex, update.folderId);
    } else if (itemType === 'task-list') {
      const taskList = (data.taskLists || []).find(tl => tl.id === update.id);
      if (taskList) {
        taskList.orderIndex = update.orderIndex;
        taskList.folderId = update.folderId;
      }
    }
  }
}

/**
 * Persist updates to database
 */
async function persistUpdates(type, updates, Repository, NoteStorage, BookmarkStorage) {
  const savePromises = [];

  for (const update of updates) {
    const itemType = update._type || type;

    if (itemType === 'folder' && Repository?.updateFolder) {
      savePromises.push(
        Repository.updateFolder({ id: update.id, orderIndex: update.orderIndex, parentId: update.parentId })
      );
    } else if (itemType === 'objective' && Repository?.updateObjectiveOrder) {
      savePromises.push(
        Repository.updateObjectiveOrder(update.id, update.orderIndex, update.folderId)
      );
    } else if (itemType === 'note' && NoteStorage?.updateNoteOrder) {
      savePromises.push(
        NoteStorage.updateNoteOrder(update.id, update.orderIndex, update.folderId)
      );
    } else if (itemType === 'task-list' && Repository?.updateTaskListOrder) {
      savePromises.push(
        Repository.updateTaskListOrder(update.id, update.orderIndex, update.folderId)
      );
    }
    // Bookmarks are localStorage-only, already updated in applyUpdatesLocally
  }

  await Promise.all(savePromises);
}

/**
 * Restore scroll position after re-render
 */
function restoreScroll(scrollTop) {
  const $container = $('#side-list-items');
  if ($container.length && scrollTop > 0) {
    requestAnimationFrame(() => {
      $container[0].scrollTop = scrollTop;
    });
  }
}

// ========================================
// Export
// ========================================

export default {
  initSortable,
  refreshSortable,
  destroySortable,
  setRenderCallback
};
