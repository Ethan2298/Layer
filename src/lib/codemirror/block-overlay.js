/**
 * Block Overlay Extension for CodeMirror 6
 *
 * Renders Notion-style block handles and manages block selection.
 * Handles are positioned absolutely over the editor content.
 */

import {
  EditorView,
  ViewPlugin,
  Decoration,
  StateField,
  StateEffect,
  RangeSetBuilder
} from './index.js';

import {
  parseBlocks,
  getBlockAtLine,
  getBlockIndexAtLine,
  getBlocksInViewport,
  shouldShowHandle,
  BlockType
} from './block-parser.js';

// ========================================
// State Effects
// ========================================

/**
 * Effect to select a block
 */
export const selectBlockEffect = StateEffect.define();

/**
 * Effect to clear block selection
 */
export const clearBlockSelectionEffect = StateEffect.define();

// ========================================
// State Field
// ========================================

/**
 * StateField to track the selected block index
 */
export const selectedBlockField = StateField.define({
  create() {
    return -1; // No selection
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(selectBlockEffect)) {
        return effect.value;
      }
      if (effect.is(clearBlockSelectionEffect)) {
        return -1;
      }
    }
    // Clear selection on document changes
    if (tr.docChanged) {
      return -1;
    }
    return value;
  }
});

// ========================================
// Block Selection Decorations
// ========================================

/**
 * Decoration for selected block background
 */
const selectedBlockDecoration = Decoration.line({ class: 'cm-block-selected' });

/**
 * Create decorations for selected block
 */
function createSelectionDecorations(view) {
  const builder = new RangeSetBuilder();
  const selectedIndex = view.state.field(selectedBlockField);

  if (selectedIndex < 0) {
    return builder.finish();
  }

  const blocks = parseBlocks(view.state.doc);
  const block = blocks[selectedIndex];

  if (!block) {
    return builder.finish();
  }

  // Add decoration for each line of the selected block
  for (let lineNum = block.startLine; lineNum <= block.endLine; lineNum++) {
    const line = view.state.doc.line(lineNum);
    builder.add(line.from, line.from, selectedBlockDecoration);
  }

  return builder.finish();
}

/**
 * ViewPlugin for selection decorations
 */
const selectionDecorationPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = createSelectionDecorations(view);
  }

  update(update) {
    if (update.docChanged ||
        update.transactions.some(tr =>
          tr.effects.some(e => e.is(selectBlockEffect) || e.is(clearBlockSelectionEffect))
        )) {
      this.decorations = createSelectionDecorations(update.view);
    }
  }
}, {
  decorations: v => v.decorations
});

// ========================================
// Block Handles Overlay
// ========================================

/**
 * ViewPlugin that renders block handles as an overlay
 */
const blockHandlesPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.view = view;
    this.blocks = [];
    this.overlay = null;
    this.handleElements = new Map();
    this.hoveredBlockIndex = -1; // Track which block is being hovered
    this.createOverlay();
    this.updateBlocks();
    this.renderHandles();
    this.setupBlockHoverTracking();
  }

  /**
   * Create the overlay container
   */
  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'cm-block-overlay';
    this.overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 10;
    `;

    // Use event delegation for handle interactions
    this.overlay.addEventListener('mousedown', this.handleMouseDown.bind(this), true);
    this.overlay.addEventListener('click', this.handleClick.bind(this), true);

    // Insert overlay into the scroller
    requestAnimationFrame(() => {
      const scroller = this.view.scrollDOM;
      if (scroller && this.overlay) {
        scroller.style.position = 'relative';
        scroller.appendChild(this.overlay);
      }
    });
  }

  /**
   * Set up mouse tracking to detect which block is being hovered
   */
  setupBlockHoverTracking() {
    // Track mouse movement over the editor content
    this.handleMouseMove = (e) => {
      const newHoveredIndex = this.getBlockIndexAtMousePosition(e);
      if (newHoveredIndex !== this.hoveredBlockIndex) {
        this.hoveredBlockIndex = newHoveredIndex;
        this.updateHoverState();
      }
    };

    // Clear hover when mouse leaves the editor
    this.handleMouseLeave = () => {
      if (this.hoveredBlockIndex !== -1) {
        this.hoveredBlockIndex = -1;
        this.updateHoverState();
      }
    };

    // Attach listeners to the scroll DOM (includes margins)
    this.view.scrollDOM.addEventListener('mousemove', this.handleMouseMove);
    this.view.scrollDOM.addEventListener('mouseleave', this.handleMouseLeave);
  }

  /**
   * Get the block index at the current mouse position
   */
  getBlockIndexAtMousePosition(e) {
    if (!this.blocks || this.blocks.length === 0) {
      return -1;
    }

    // Get mouse Y position relative to the editor content
    const contentRect = this.view.contentDOM.getBoundingClientRect();
    const scrollerRect = this.view.scrollDOM.getBoundingClientRect();
    const mouseY = e.clientY;

    // Check if mouse is within the editor area horizontally (including left margin)
    if (e.clientX < scrollerRect.left || e.clientX > contentRect.right) {
      return -1;
    }

    // Find which block the mouse is over based on line positions
    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i];
      const startLine = this.view.state.doc.line(block.startLine);
      const endLine = this.view.state.doc.line(block.endLine);

      const startPos = this.view.lineBlockAt(startLine.from);
      const endPos = this.view.lineBlockAt(endLine.from);

      const blockTop = startPos.top + contentRect.top - this.view.scrollDOM.scrollTop;
      const blockBottom = endPos.top + endPos.height + contentRect.top - this.view.scrollDOM.scrollTop;

      if (mouseY >= blockTop && mouseY < blockBottom) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Update hover state on handle elements
   */
  updateHoverState() {
    for (const [blockIndex, wrapper] of this.handleElements) {
      wrapper.classList.toggle('hovered', blockIndex === this.hoveredBlockIndex);
    }
  }

  /**
   * Update blocks from document
   */
  updateBlocks() {
    this.blocks = parseBlocks(this.view.state.doc);
  }

  /**
   * Get visible line range
   */
  getVisibleLines() {
    const { from, to } = this.view.viewport;
    const fromLine = this.view.state.doc.lineAt(from).number;
    const toLine = this.view.state.doc.lineAt(to).number;
    return { fromLine, toLine };
  }

  /**
   * Get the block index where the cursor is located
   * Returns -1 if no valid block found
   */
  getCursorBlockIndex() {
    if (!this.blocks || this.blocks.length === 0) {
      return -1;
    }
    const cursorPos = this.view.state.selection.main.head;
    const cursorLine = this.view.state.doc.lineAt(cursorPos).number;
    return getBlockIndexAtLine(this.blocks, cursorLine);
  }

  /**
   * Render handles for visible blocks
   */
  renderHandles() {
    if (!this.overlay) return;

    const { fromLine, toLine } = this.getVisibleLines();
    const visibleBlocks = getBlocksInViewport(this.blocks, fromLine, toLine);
    const selectedIndex = this.view.state.field(selectedBlockField);
    const cursorBlockIndex = this.getCursorBlockIndex();

    // Track which blocks we've rendered
    const renderedBlocks = new Set();

    for (let i = 0; i < visibleBlocks.length; i++) {
      const block = visibleBlocks[i];
      const blockIndex = this.blocks.indexOf(block);

      if (!shouldShowHandle(block.type)) {
        continue;
      }

      renderedBlocks.add(blockIndex);

      // Get or create handle element
      let wrapper = this.handleElements.get(blockIndex);
      if (!wrapper) {
        wrapper = this.createHandleElement(blockIndex);
        this.handleElements.set(blockIndex, wrapper);
        this.overlay.appendChild(wrapper);
      }

      // Position the handle and update state classes
      // Only match if blockIndex is valid (>= 0) to avoid -1 === -1 matching all
      const isSelected = blockIndex >= 0 && blockIndex === selectedIndex;
      const hasCursor = blockIndex >= 0 && blockIndex === cursorBlockIndex;
      this.positionHandle(wrapper, block, isSelected, hasCursor);
    }

    // Remove handles for blocks no longer visible
    for (const [blockIndex, element] of this.handleElements) {
      if (!renderedBlocks.has(blockIndex)) {
        element.remove();
        this.handleElements.delete(blockIndex);
      }
    }
  }

  /**
   * Create a handle element for a block
   */
  createHandleElement(blockIndex) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-block-handle-wrapper';
    wrapper.dataset.blockIndex = blockIndex;
    wrapper.style.cssText = `
      position: absolute;
      display: flex;
      align-items: center;
      gap: 2px;
      padding-right: 8px;
      pointer-events: auto;
    `;

    // Add button (shown on hover before handle) - Lucide Plus icon
    const addBtn = document.createElement('button');
    addBtn.className = 'cm-block-add-btn';
    addBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>`;
    addBtn.title = 'Add block below';
    addBtn.dataset.action = 'add';
    wrapper.appendChild(addBtn);

    // Drag handle - Lucide GripVertical icon
    const handle = document.createElement('div');
    handle.className = 'cm-block-handle';
    handle.draggable = true;
    handle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="9" cy="12" r="1"/>
      <circle cx="9" cy="5" r="1"/>
      <circle cx="9" cy="19" r="1"/>
      <circle cx="15" cy="12" r="1"/>
      <circle cx="15" cy="5" r="1"/>
      <circle cx="15" cy="19" r="1"/>
    </svg>`;
    handle.title = 'Drag to move';
    handle.dataset.action = 'drag';
    wrapper.appendChild(handle);

    // Drag events
    handle.addEventListener('dragstart', (e) => {
      // Clear any text selection to prevent dragging selected text
      window.getSelection()?.removeAllRanges();

      e.dataTransfer.setData('text/plain', blockIndex.toString());
      e.dataTransfer.effectAllowed = 'move';

      // Set a drag image to prevent browser from using text selection
      const dragImage = wrapper.cloneNode(true);
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 12, 12);
      setTimeout(() => dragImage.remove(), 0);

      wrapper.classList.add('dragging');

      // Dispatch custom event for drag manager
      this.view.dom.dispatchEvent(new CustomEvent('block-drag-start', {
        detail: { blockIndex, block: this.blocks[blockIndex] }
      }));
    });

    handle.addEventListener('dragend', () => {
      wrapper.classList.remove('dragging');
      this.view.dom.dispatchEvent(new CustomEvent('block-drag-end'));
    });

    return wrapper;
  }

  /**
   * Position a handle element
   */
  positionHandle(wrapper, block, isSelected, hasCursor) {
    // Get the position of the first line of the block
    const line = this.view.state.doc.line(block.startLine);
    const linePos = this.view.lineBlockAt(line.from);

    // Account for scroll position
    const scrollTop = this.view.scrollDOM.scrollTop;
    const editorPadding = parseInt(getComputedStyle(this.view.contentDOM).paddingTop) || 0;
    const editorLeft = parseInt(getComputedStyle(this.view.contentDOM).paddingLeft) || 0;

    // Get the computed line-height from the editor for single line height
    const lineHeightStyle = getComputedStyle(this.view.contentDOM).lineHeight;
    const singleLineHeight = parseFloat(lineHeightStyle) || 24;

    // Position at first line, use single line height for wrapped paragraphs
    const top = linePos.top - scrollTop + editorPadding;
    const left = editorLeft + 30;

    wrapper.style.top = `${top}px`;
    wrapper.style.left = `${left}px`;
    wrapper.style.height = `${singleLineHeight}px`;

    // Update state classes
    wrapper.classList.toggle('selected', isSelected);
    wrapper.classList.toggle('cursor-block', hasCursor);
  }

  /**
   * Handle mousedown on overlay elements
   */
  handleMouseDown(e) {
    const wrapper = e.target.closest('.cm-block-handle-wrapper');
    if (!wrapper) return;

    const action = e.target.dataset.action;
    if (action === 'drag') {
      // Let drag events handle this
      return;
    }

    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Handle click on overlay elements
   */
  handleClick(e) {
    const wrapper = e.target.closest('.cm-block-handle-wrapper');
    if (!wrapper) return;

    const blockIndex = parseInt(wrapper.dataset.blockIndex, 10);
    const action = e.target.dataset.action;

    e.preventDefault();
    e.stopPropagation();

    if (action === 'add') {
      // Insert new line after this block
      const block = this.blocks[blockIndex];
      if (block) {
        this.view.dispatch({
          changes: { from: block.to, insert: '\n' },
          selection: { anchor: block.to + 1 }
        });
        this.view.focus();
      }
    } else {
      // Select the block
      this.view.dispatch({
        effects: selectBlockEffect.of(blockIndex)
      });
    }
  }

  /**
   * Update on editor changes
   */
  update(update) {
    if (update.docChanged || update.viewportChanged || update.geometryChanged) {
      this.updateBlocks();
      this.renderHandles();
      return;
    }

    // Re-render on cursor movement or block selection changes
    if (update.selectionSet || update.transactions.some(tr =>
      tr.effects.some(e => e.is(selectBlockEffect) || e.is(clearBlockSelectionEffect))
    )) {
      this.renderHandles();
    }
  }

  /**
   * Clean up
   */
  destroy() {
    // Remove hover tracking listeners
    if (this.handleMouseMove) {
      this.view.scrollDOM.removeEventListener('mousemove', this.handleMouseMove);
    }
    if (this.handleMouseLeave) {
      this.view.scrollDOM.removeEventListener('mouseleave', this.handleMouseLeave);
    }

    if (this.overlay) {
      this.overlay.remove();
    }
    this.handleElements.clear();
  }
});

// ========================================
// Click Handler to Clear Selection
// ========================================

/**
 * Clear block selection when clicking in editor content
 */
const clickToClearSelection = EditorView.domEventHandlers({
  mousedown(event, view) {
    // Don't clear if clicking on a handle
    if (event.target.closest('.cm-block-handle-wrapper')) {
      return false;
    }

    const selectedIndex = view.state.field(selectedBlockField);
    if (selectedIndex >= 0) {
      view.dispatch({
        effects: clearBlockSelectionEffect.of(null)
      });
    }
    return false;
  }
});

// ========================================
// Styles
// ========================================

/**
 * Base styles for block overlay
 */
const blockOverlayStyles = EditorView.baseTheme({
  // Handle wrapper - hidden by default, only visible on hover or when selected
  '& .cm-block-handle-wrapper': {
    opacity: '0',
    transition: 'opacity 0.15s ease'
  },

  // Show handles when block is hovered (entire block area)
  '& .cm-block-handle-wrapper.hovered': {
    opacity: '1'
  },


  // Keep selected block's handle visible
  '& .cm-block-handle-wrapper.selected': {
    opacity: '1'
  },

  // Selected block highlight
  '& .cm-block-selected': {
    backgroundColor: 'rgba(249, 115, 22, 0.08)'
  },

  // Add button
  '& .cm-block-add-btn': {
    width: '24px',
    height: '24px',
    padding: '2px',
    margin: '0',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: '0',
    transition: 'opacity 0.15s ease, background-color 0.15s ease'
  },

  '& .cm-block-add-btn svg': {
    width: '18px',
    height: '18px',
    pointerEvents: 'none'
  },

  '& .cm-block-handle-wrapper.hovered .cm-block-add-btn': {
    opacity: '1'
  },

  '& .cm-block-add-btn:hover': {
    backgroundColor: 'var(--bg-hover)'
  },

  // Drag handle
  '& .cm-block-handle': {
    width: '24px',
    height: '24px',
    padding: '2px',
    margin: '0',
    borderRadius: '4px',
    background: 'transparent',
    color: 'var(--text-dim)',
    cursor: 'grab',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.15s ease',
    userSelect: 'none',
    WebkitUserSelect: 'none'
  },

  '& .cm-block-handle svg': {
    width: '18px',
    height: '18px',
    pointerEvents: 'none'
  },

  '& .cm-block-handle:hover': {
    backgroundColor: 'var(--bg-hover)'
  },

  '& .cm-block-handle:active': {
    cursor: 'grabbing'
  },

  // Dragging state
  '& .cm-block-handle-wrapper.dragging': {
    opacity: '0.5'
  }
});

// ========================================
// Combined Extension
// ========================================

/**
 * Complete block overlay extension
 */
export const blockOverlayExtension = [
  selectedBlockField,
  selectionDecorationPlugin,
  blockHandlesPlugin,
  clickToClearSelection,
  blockOverlayStyles
];

// ========================================
// Exports
// ========================================

export {
  parseBlocks,
  getBlockAtLine,
  getBlockIndexAtLine,
  BlockType
};

export default blockOverlayExtension;
