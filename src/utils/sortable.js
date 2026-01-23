/**
 * Generic Sortable Module
 *
 * Reusable drag-and-drop sortable functionality wrapping jQuery UI Sortable.
 * Can be used for any list that needs drag-and-drop reordering.
 *
 * Features:
 * - Reorder items within a container
 * - Drop items into other items (e.g., dropping into folders)
 * - Drop zone detection (top/bottom 25% for reorder, center 50% for drop-into)
 * - Circular reference prevention via canDrop callback
 * - Visual feedback with CSS classes
 *
 * @example
 * import { makeSortable } from '../utils/sortable.js';
 *
 * const sortable = makeSortable(container, {
 *   itemSelector: '[data-sortable="true"]',
 *   getItemData: (el) => ({ id: el.dataset.id, type: el.dataset.type }),
 *   isDropTarget: (el) => el.dataset.type === 'folder',
 *   onReorder: ({ itemId, itemType, prevItemId, nextItemId }) => { ... },
 *   onDropInto: ({ itemId, itemType, targetId }) => { ... }
 * });
 */

// ========================================
// Module State (per instance via closure)
// ========================================

/**
 * Make a container sortable with drag-and-drop reordering
 *
 * @param {HTMLElement|jQuery} container - The list container element
 * @param {Object} options
 * @param {string} options.itemSelector - CSS selector for draggable items (default: '[data-sortable]')
 * @param {string} options.handleSelector - Optional drag handle selector
 * @param {string} options.placeholderClass - CSS class for placeholder (default: 'sortable-placeholder')
 * @param {string} options.draggingClass - CSS class for dragging state (default: 'dragging')
 * @param {string} options.containerDraggingClass - CSS class for container during drag (default: 'is-dragging')
 * @param {string} options.dropTargetClass - CSS class for drop target hover (default: 'sortable-drop-target')
 * @param {string} options.dropInvalidClass - CSS class for invalid drop targets (default: 'sortable-drop-invalid')
 * @param {number} options.dropZoneThreshold - Percentage for top/bottom reorder zones (default: 0.25)
 * @param {Function} options.onReorder - Callback when item is reordered: ({ itemId, itemType, prevEl, nextEl }) => void
 * @param {Function} options.onDropInto - Callback for dropping into containers: ({ itemId, itemType, targetId, targetEl }) => void
 * @param {Function} options.canDrop - Optional validation: (draggedEl, targetEl) => boolean
 * @param {Function} options.getItemData - Extract data from element: (el) => { id, type, ... }
 * @param {Function} options.isDropTarget - Check if element accepts drops: (el) => boolean
 * @param {Function} options.createHelper - Optional custom helper creation: (event, item) => jQuery element
 * @param {Object} options.sortableOptions - Additional jQuery UI Sortable options to merge
 * @returns {Object} - { destroy(), refresh(), isActive() }
 */
export function makeSortable(container, options = {}) {
  const $container = $(container);
  if (!$container.length) {
    console.warn('makeSortable: container not found');
    return createNullInstance();
  }

  // Check jQuery UI is available
  if (!$.fn.sortable) {
    console.error('makeSortable: jQuery UI Sortable not loaded');
    return createNullInstance();
  }

  // ========================================
  // Options with defaults
  // ========================================
  const config = {
    itemSelector: options.itemSelector || '[data-sortable]',
    handleSelector: options.handleSelector || null,
    placeholderClass: options.placeholderClass || 'sortable-placeholder',
    draggingClass: options.draggingClass || 'dragging',
    containerDraggingClass: options.containerDraggingClass || 'is-dragging',
    dropTargetClass: options.dropTargetClass || 'sortable-drop-target',
    dropInvalidClass: options.dropInvalidClass || 'sortable-drop-invalid',
    dropZoneThreshold: options.dropZoneThreshold ?? 0.25,
    tolerance: options.tolerance || 'pointer',
    scrollSensitivity: options.scrollSensitivity ?? 60,
    scrollSpeed: options.scrollSpeed ?? 25,
    revert: options.revert ?? false,
    delay: options.delay ?? 0,
    distance: options.distance ?? 4,
    zIndex: options.zIndex ?? 1000,
    cursor: options.cursor || 'grabbing',
    cursorAt: options.cursorAt || { top: 20, left: 20 },
    onReorder: options.onReorder || (() => {}),
    onDropInto: options.onDropInto || (() => {}),
    onDragStart: options.onDragStart || (() => {}),
    onDragEnd: options.onDragEnd || (() => {}),
    canDrop: options.canDrop || (() => true),
    getItemData: options.getItemData || ((el) => ({ id: el.dataset.id, type: el.dataset.type })),
    isDropTarget: options.isDropTarget || (() => false),
    createHelper: options.createHelper || null,
    markInvalidTargets: options.markInvalidTargets || null,
    sortableOptions: options.sortableOptions || {}
  };

  // ========================================
  // Instance State
  // ========================================
  let _isActive = false;
  let _hoverTargetEl = null;
  let _draggedEl = null;
  let _draggedData = null;

  // ========================================
  // jQuery UI Sortable Configuration
  // ========================================
  const sortableConfig = {
    items: `> ${config.itemSelector}`,
    placeholder: config.placeholderClass,
    tolerance: config.tolerance,
    revert: config.revert,
    scrollSensitivity: config.scrollSensitivity,
    scrollSpeed: config.scrollSpeed,
    cursor: config.cursor,
    zIndex: config.zIndex,
    delay: config.delay,
    distance: config.distance,
    cursorAt: config.cursorAt,

    // Handle selector if provided
    ...(config.handleSelector && { handle: config.handleSelector }),

    // Helper creation
    helper: config.createHelper || function(e, item) {
      const $clone = item.clone();
      $clone.css({
        width: item.outerWidth(),
        height: item.outerHeight()
      });
      return $clone;
    },

    // Event handlers
    start: handleDragStart,
    sort: handleSort,
    stop: handleDragStop,

    // Merge any additional options
    ...config.sortableOptions
  };

  // ========================================
  // Event Handlers
  // ========================================

  function handleDragStart(e, ui) {
    const $item = $(ui.item);
    const el = $item[0];

    _isActive = true;
    _draggedEl = el;
    _draggedData = config.getItemData(el);
    _hoverTargetEl = null;

    // Visual feedback
    $item.addClass(config.draggingClass);
    $container.addClass(config.containerDraggingClass);

    // Mark invalid drop targets if callback provided
    if (config.markInvalidTargets) {
      config.markInvalidTargets(el, _draggedData, config.dropInvalidClass);
    }

    // Notify consumer
    config.onDragStart({
      element: el,
      data: _draggedData
    });
  }

  function handleSort(e, ui) {
    if (!_isActive || !_draggedEl) return;

    const cursorX = e.pageX;
    const cursorY = e.pageY;

    let foundDropTarget = false;

    // Check all potential drop targets
    $container.find(config.itemSelector).each(function() {
      const targetEl = this;
      const $target = $(targetEl);

      // Skip if not a drop target
      if (!config.isDropTarget(targetEl)) {
        $target.removeClass(config.dropTargetClass);
        return true; // continue
      }

      // Skip if it's the dragged item
      if (targetEl === _draggedEl) {
        $target.removeClass(config.dropTargetClass);
        return true;
      }

      const rect = targetEl.getBoundingClientRect();

      // Check if cursor is within element bounds
      if (cursorX < rect.left || cursorX > rect.right ||
          cursorY < rect.top || cursorY > rect.bottom) {
        $target.removeClass(config.dropTargetClass);
        return true;
      }

      // Check if cursor is in center zone (drop-into area)
      const relativeY = cursorY - rect.top;
      const threshold = rect.height * config.dropZoneThreshold;
      const inCenterZone = relativeY > threshold && relativeY < (rect.height - threshold);

      // Validate drop is allowed
      const canDrop = config.canDrop(_draggedEl, targetEl, _draggedData);

      if (inCenterZone && canDrop) {
        $target.addClass(config.dropTargetClass);
        _hoverTargetEl = targetEl;
        foundDropTarget = true;

        // Hide placeholder when dropping into a target
        $container.find(`.${config.placeholderClass}`).hide();

        return false; // break
      } else {
        $target.removeClass(config.dropTargetClass);
      }
    });

    // If not over any drop target, clear state and show placeholder
    if (!foundDropTarget) {
      _hoverTargetEl = null;
      $container.find(`.${config.placeholderClass}`).show();
    }
  }

  function handleDragStop(e, ui) {
    const $item = $(ui.item);
    const el = $item[0];
    const data = config.getItemData(el);

    // Capture drop target before cleanup
    const dropTargetEl = _hoverTargetEl;
    const dropTargetData = dropTargetEl ? config.getItemData(dropTargetEl) : null;

    // Clean up visual state
    $item.removeClass(config.draggingClass);
    $container.removeClass(config.containerDraggingClass);
    $container.find(`.${config.dropTargetClass}`).removeClass(config.dropTargetClass);
    $container.find(`.${config.dropInvalidClass}`).removeClass(config.dropInvalidClass);

    // Reset instance state
    const wasActive = _isActive;
    _isActive = false;
    _draggedEl = null;
    _draggedData = null;
    _hoverTargetEl = null;

    if (!wasActive) return;

    // Notify consumer of drag end
    config.onDragEnd({
      element: el,
      data: data
    });

    // If dropping into a target (center zone)
    if (dropTargetEl) {
      // Cancel sortable's DOM changes - we're doing a drop-into instead
      if ($container.data('ui-sortable')) {
        $container.sortable('cancel');
      }

      config.onDropInto({
        itemId: data.id,
        itemType: data.type,
        element: el,
        data: data,
        targetId: dropTargetData?.id,
        targetEl: dropTargetEl,
        targetData: dropTargetData
      });
      return;
    }

    // Otherwise, it's a reorder - get neighbors
    const $prev = $item.prev(config.itemSelector);
    const $next = $item.next(config.itemSelector);

    config.onReorder({
      itemId: data.id,
      itemType: data.type,
      element: el,
      data: data,
      prevEl: $prev.length ? $prev[0] : null,
      nextEl: $next.length ? $next[0] : null,
      prevData: $prev.length ? config.getItemData($prev[0]) : null,
      nextData: $next.length ? config.getItemData($next[0]) : null
    });
  }

  // ========================================
  // Initialize
  // ========================================

  $container.sortable(sortableConfig);

  // Add sortable-enabled class to items
  $container.find(config.itemSelector).addClass('sortable-enabled');

  // ========================================
  // Public API
  // ========================================

  return {
    /**
     * Destroy the sortable instance and clean up
     */
    destroy() {
      if ($container.data('ui-sortable')) {
        $container.sortable('destroy');
      }
      $container.find('.sortable-enabled').removeClass('sortable-enabled');
      $container.removeClass(config.containerDraggingClass);
      _isActive = false;
      _hoverTargetEl = null;
      _draggedEl = null;
      _draggedData = null;
    },

    /**
     * Refresh sortable after DOM changes
     */
    refresh() {
      if ($container.data('ui-sortable')) {
        $container.sortable('refresh');
      }
      // Re-add sortable-enabled class to any new items
      $container.find(config.itemSelector).addClass('sortable-enabled');
    },

    /**
     * Check if a drag is currently active
     */
    isActive() {
      return _isActive;
    },

    /**
     * Get the container element
     */
    getContainer() {
      return $container[0];
    },

    /**
     * Cancel current drag operation
     */
    cancel() {
      if ($container.data('ui-sortable')) {
        $container.sortable('cancel');
      }
    }
  };
}

/**
 * Create a null/no-op instance for error cases
 */
function createNullInstance() {
  return {
    destroy() {},
    refresh() {},
    isActive() { return false; },
    getContainer() { return null; },
    cancel() {}
  };
}

/**
 * Helper to create sortable instances for nested containers
 * Useful for hierarchical lists with folders
 *
 * @param {HTMLElement|jQuery} rootContainer - Root container
 * @param {string} nestedSelector - Selector for nested containers
 * @param {Object} options - Same options as makeSortable
 * @returns {Object} - { destroyAll(), refreshAll(), getInstances() }
 */
export function makeNestedSortable(rootContainer, nestedSelector, options = {}) {
  const $root = $(rootContainer);
  const instances = [];

  // Initialize on root
  instances.push({
    container: $root[0],
    instance: makeSortable($root, options)
  });

  // Initialize on nested containers
  $root.find(nestedSelector).each(function() {
    instances.push({
      container: this,
      instance: makeSortable(this, options)
    });
  });

  return {
    destroyAll() {
      instances.forEach(({ instance }) => instance.destroy());
      instances.length = 0;
    },

    refreshAll() {
      // Re-scan for nested containers and reinitialize
      this.destroyAll();

      instances.push({
        container: $root[0],
        instance: makeSortable($root, options)
      });

      $root.find(nestedSelector).each(function() {
        instances.push({
          container: this,
          instance: makeSortable(this, options)
        });
      });
    },

    getInstances() {
      return instances.map(({ instance }) => instance);
    },

    isAnyActive() {
      return instances.some(({ instance }) => instance.isActive());
    }
  };
}

export default { makeSortable, makeNestedSortable };
