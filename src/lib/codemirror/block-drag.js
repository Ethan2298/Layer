/**
 * Block Drag Manager for CodeMirror 6
 *
 * Handles drag-and-drop reordering and keyboard shortcuts
 * for moving blocks (Alt+Up/Down).
 */

import {
  EditorView,
  ViewPlugin,
  keymap
} from './index.js';

import {
  parseBlocks,
  getBlockAtLine,
  getBlockIndexAtLine
} from './block-parser.js';

import {
  selectedBlockField,
  selectBlockEffect,
  clearBlockSelectionEffect
} from './block-overlay.js';

// ========================================
// Block Movement Operations
// ========================================

/**
 * Move a block to a new position
 * @param {EditorView} view - Editor view
 * @param {number} sourceIndex - Index of block to move
 * @param {number} targetIndex - Index to move to
 * @returns {boolean} Whether the move was successful
 */
function moveBlock(view, sourceIndex, targetIndex) {
  const blocks = parseBlocks(view.state.doc);

  if (sourceIndex < 0 || sourceIndex >= blocks.length) return false;
  if (targetIndex < 0 || targetIndex >= blocks.length) return false;
  if (sourceIndex === targetIndex) return false;

  const doc = view.state.doc;

  // For simplicity, move one step at a time by swapping adjacent blocks
  // This ensures correct behavior without complex position calculations
  const direction = targetIndex > sourceIndex ? 1 : -1;
  let currentIndex = sourceIndex;

  // Build a sequence of swaps
  const swaps = [];
  while (currentIndex !== targetIndex) {
    const nextIndex = currentIndex + direction;
    swaps.push({ from: currentIndex, to: nextIndex });
    currentIndex = nextIndex;
  }

  // Execute swaps in sequence (each swap is atomic)
  // We re-parse blocks after each swap since positions change
  for (const swap of swaps) {
    const currentBlocks = parseBlocks(view.state.doc);
    const block1 = currentBlocks[Math.min(swap.from, swap.to)];
    const block2 = currentBlocks[Math.max(swap.from, swap.to)];

    if (!block1 || !block2) return false;

    const text1 = view.state.doc.sliceString(block1.from, block1.to);
    const text2 = view.state.doc.sliceString(block2.from, block2.to);

    // Swap: put text2 in block1's position, text1 in block2's position
    // Changes must be in document order (block1 comes first)
    view.dispatch({
      changes: [
        { from: block1.from, to: block1.to, insert: text2 },
        { from: block2.from, to: block2.to, insert: text1 }
      ]
    });
  }

  // Select the final position
  view.dispatch({
    effects: selectBlockEffect.of(targetIndex)
  });

  return true;
}

/**
 * Swap a block with its neighbor
 * @param {EditorView} view - Editor view
 * @param {number} blockIndex - Index of block to swap
 * @param {number} direction - -1 for up, 1 for down
 * @returns {boolean} Whether the swap was successful
 */
function swapBlock(view, blockIndex, direction) {
  const blocks = parseBlocks(view.state.doc);

  if (blockIndex < 0 || blockIndex >= blocks.length) return false;

  const targetIndex = blockIndex + direction;
  if (targetIndex < 0 || targetIndex >= blocks.length) return false;

  const block = blocks[blockIndex];
  const neighbor = blocks[targetIndex];

  const doc = view.state.doc;

  // Get text for both blocks
  const blockText = doc.sliceString(block.from, block.to);
  const neighborText = doc.sliceString(neighbor.from, neighbor.to);

  // Swap the text content
  const firstBlock = direction < 0 ? neighbor : block;
  const secondBlock = direction < 0 ? block : neighbor;
  const firstText = direction < 0 ? blockText : neighborText;
  const secondText = direction < 0 ? neighborText : blockText;

  view.dispatch({
    changes: [
      { from: firstBlock.from, to: firstBlock.to, insert: firstText },
      { from: secondBlock.from, to: secondBlock.to, insert: secondText }
    ],
    effects: selectBlockEffect.of(targetIndex)
  });

  return true;
}

/**
 * Move the current line/block up
 */
function moveBlockUp(view) {
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
  const blocks = parseBlocks(view.state.doc);
  const blockIndex = getBlockIndexAtLine(blocks, cursorLine);

  if (blockIndex <= 0) return false;

  return swapBlock(view, blockIndex, -1);
}

/**
 * Move the current line/block down
 */
function moveBlockDown(view) {
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
  const blocks = parseBlocks(view.state.doc);
  const blockIndex = getBlockIndexAtLine(blocks, cursorLine);

  if (blockIndex < 0 || blockIndex >= blocks.length - 1) return false;

  return swapBlock(view, blockIndex, 1);
}

// ========================================
// Keyboard Shortcuts
// ========================================

/**
 * Keymap for block movement
 */
export const blockMovementKeymap = keymap.of([
  {
    key: 'Alt-ArrowUp',
    run: moveBlockUp
  },
  {
    key: 'Alt-ArrowDown',
    run: moveBlockDown
  }
]);

// ========================================
// Drag and Drop Handler
// ========================================

/**
 * ViewPlugin for drag-and-drop handling
 */
const blockDragPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.view = view;
    this.dropIndicator = null;
    this.draggedBlockIndex = -1;
    this.dropTargetIndex = -1;

    this.createDropIndicator();
    this.setupEventListeners();
  }

  /**
   * Create the drop indicator element
   */
  createDropIndicator() {
    this.dropIndicator = document.createElement('div');
    this.dropIndicator.className = 'cm-block-drop-indicator';
    this.dropIndicator.style.cssText = `
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--accent, #f97316);
      pointer-events: none;
      display: none;
      z-index: 100;
    `;

    requestAnimationFrame(() => {
      const scroller = this.view.scrollDOM;
      if (scroller && this.dropIndicator) {
        scroller.appendChild(this.dropIndicator);
      }
    });
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for custom drag events from block handles
    this.view.dom.addEventListener('block-drag-start', this.onBlockDragStart.bind(this));
    this.view.dom.addEventListener('block-drag-end', this.onBlockDragEnd.bind(this));

    // Standard drag events on the editor - use capture to intercept before CodeMirror
    this.view.dom.addEventListener('dragover', this.onDragOver.bind(this), true);
    this.view.dom.addEventListener('dragleave', this.onDragLeave.bind(this), true);
    this.view.dom.addEventListener('drop', this.onDrop.bind(this), true);
  }

  /**
   * Handle block drag start
   */
  onBlockDragStart(e) {
    this.draggedBlockIndex = e.detail.blockIndex;
    this.view.dom.classList.add('cm-block-dragging');
  }

  /**
   * Handle block drag end
   */
  onBlockDragEnd() {
    this.hideDropIndicator();
    this.draggedBlockIndex = -1;
    this.dropTargetIndex = -1;
    this.view.dom.classList.remove('cm-block-dragging');
  }

  /**
   * Handle drag over
   */
  onDragOver(e) {
    if (this.draggedBlockIndex < 0) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Find the block at the mouse position
    const pos = this.view.posAtCoords({ x: e.clientX, y: e.clientY });
    if (pos === null) return;

    const line = this.view.state.doc.lineAt(pos);
    const blocks = parseBlocks(this.view.state.doc);
    const targetIndex = getBlockIndexAtLine(blocks, line.number);

    if (targetIndex < 0) return;
    if (targetIndex === this.draggedBlockIndex) {
      this.hideDropIndicator();
      return;
    }

    this.dropTargetIndex = targetIndex;

    // Position drop indicator
    const targetBlock = blocks[targetIndex];
    const insertBefore = targetIndex < this.draggedBlockIndex;

    let indicatorLine;
    if (insertBefore) {
      indicatorLine = this.view.state.doc.line(targetBlock.startLine);
    } else {
      indicatorLine = this.view.state.doc.line(targetBlock.endLine);
    }

    const linePos = this.view.lineBlockAt(indicatorLine.from);
    const scrollTop = this.view.scrollDOM.scrollTop;
    const editorPadding = parseInt(getComputedStyle(this.view.contentDOM).paddingTop) || 0;

    let top;
    if (insertBefore) {
      top = linePos.top - scrollTop + editorPadding - 1;
    } else {
      top = linePos.top + linePos.height - scrollTop + editorPadding - 1;
    }

    this.showDropIndicator(top);
  }

  /**
   * Handle drag leave
   */
  onDragLeave(e) {
    // Only hide if we've actually left the editor
    if (!this.view.dom.contains(e.relatedTarget)) {
      this.hideDropIndicator();
    }
  }

  /**
   * Handle drop
   */
  onDrop(e) {
    // If we're not in a block drag operation, let CodeMirror handle it
    if (this.draggedBlockIndex < 0) {
      return;
    }

    // We're in a block drag - always prevent default to stop text pasting
    e.preventDefault();
    e.stopPropagation();

    const sourceIndex = this.draggedBlockIndex;
    const targetIndex = this.dropTargetIndex;

    this.onBlockDragEnd();

    // Only move if we have a valid target different from source
    if (targetIndex >= 0 && sourceIndex !== targetIndex) {
      moveBlock(this.view, sourceIndex, targetIndex);
    }
  }

  /**
   * Show drop indicator at a position
   */
  showDropIndicator(top) {
    if (this.dropIndicator) {
      this.dropIndicator.style.top = `${top}px`;
      this.dropIndicator.style.display = 'block';
    }
  }

  /**
   * Hide drop indicator
   */
  hideDropIndicator() {
    if (this.dropIndicator) {
      this.dropIndicator.style.display = 'none';
    }
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.dropIndicator) {
      this.dropIndicator.remove();
    }
  }
});

// ========================================
// Styles
// ========================================

/**
 * Styles for drag and drop
 */
const blockDragStyles = EditorView.baseTheme({
  // Drop indicator
  '.cm-block-drop-indicator': {
    boxShadow: '0 1px 3px rgba(249, 115, 22, 0.3)'
  },

  // Dragging state on editor
  '&.cm-block-dragging': {
    cursor: 'grabbing !important',
    userSelect: 'none',
    WebkitUserSelect: 'none'
  },

  '&.cm-block-dragging .cm-content': {
    cursor: 'grabbing !important',
    userSelect: 'none',
    WebkitUserSelect: 'none'
  },

  '&.cm-block-dragging .cm-line': {
    cursor: 'grabbing !important'
  }
});

// ========================================
// Combined Extension
// ========================================

/**
 * Complete block drag extension
 */
export const blockDragExtension = [
  blockMovementKeymap,
  blockDragPlugin,
  blockDragStyles
];

// ========================================
// Exports
// ========================================

export {
  moveBlock,
  swapBlock,
  moveBlockUp,
  moveBlockDown
};

export default blockDragExtension;
