/**
 * Editor.js Drag & Drop Plugin
 * Enables block reordering via drag and drop
 *
 * Based on editorjs-drag-drop but with fixes for ghost image rendering
 */

// CSS for drop target indicator
const CSS = `
.ce-block--drop-target .ce-block__content:before {
  content: "";
  position: absolute;
  top: 50%;
  left: -20px;
  margin-top: -1px;
  height: 8px;
  width: 8px;
  border: solid #a0a0a0;
  border-width: 1px 1px 0 0;
  transform-origin: right;
  transform: rotate(45deg);
}

.ce-block--drop-target .ce-block__content:after {
  background: none;
}
`;

// Inject styles
function injectStyles() {
  if (document.getElementById('editorjs-drag-drop-styles')) return;

  const style = document.createElement('style');
  style.id = 'editorjs-drag-drop-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
}

class DragDrop {
  constructor({ configuration, blocks, toolbar, save }, borderStyle) {
    this.toolbar = toolbar;
    this.borderStyle = borderStyle || '1px dashed #aaa';
    this.api = blocks;
    this.holder = typeof configuration.holder === 'string'
      ? document.getElementById(configuration.holder)
      : configuration.holder;
    this.readOnly = configuration.readOnly;
    this.startBlock = null;
    this.endBlock = null;
    this.save = save;
    this.dragLayer = null;

    injectStyles();
    this.setDragListener();
    this.setDropListener();
  }

  static get isReadOnlySupported() {
    return true;
  }

  setElementCursor(element) {
    if (!element) return;

    const range = document.createRange();
    const selection = window.getSelection();

    if (element.childNodes[0]) {
      range.setStart(element.childNodes[0], 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      element.focus();
    }
  }

  setDragListener() {
    if (this.readOnly) return;

    const settingsBtn = this.holder.querySelector('.ce-toolbar__settings-btn');

    if (settingsBtn) {
      this.initializeDragListener(settingsBtn);
    } else {
      // Wait for toolbar to be created
      const observer = new MutationObserver((mutations, obs) => {
        const btn = this.holder.querySelector('.ce-toolbar__settings-btn');
        if (btn) {
          this.initializeDragListener(btn);
          obs.disconnect();
        }
      });
      observer.observe(this.holder, { childList: true, subtree: true });
    }
  }

  initializeDragListener(settingsBtn) {
    settingsBtn.setAttribute('draggable', 'true');

    settingsBtn.addEventListener('dragstart', (ev) => {
      this.startBlock = this.api.getCurrentBlockIndex();

      // Get block by index - more reliable than CSS class selectors
      const blocks = this.holder.querySelectorAll('.ce-block');
      const block = blocks[this.startBlock];

      if (block) {
        // Hide the default drag image
        const emptyImg = document.createElement('img');
        emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        ev.dataTransfer.setDragImage(emptyImg, 0, 0);

        // Create custom drag layer that follows cursor
        this.createDragLayer(block, ev.clientX, ev.clientY);
      }
    });

    settingsBtn.addEventListener('dragend', () => {
      this.removeDragLayer();
    });

    settingsBtn.addEventListener('drag', (ev) => {
      this.toolbar.close();

      // Update drag layer position - offset text to match handle distance in editor
      if (this.dragLayer && ev.clientX !== 0 && ev.clientY !== 0) {
        this.dragLayer.style.left = `${ev.clientX + 24}px`;
        this.dragLayer.style.top = `${ev.clientY - 8}px`;
      }

      if (this.isTheOnlyBlock()) return;

      const blocks = this.holder.querySelectorAll('.ce-block');
      const dropTarget = this.holder.querySelector('.ce-block--drop-target');

      this.setElementCursor(dropTarget);
      this.setBorderBlocks(blocks, dropTarget);
    });
  }

  createDragLayer(block, x, y) {
    const layer = document.createElement('div');
    // Offset text to the right of cursor by ~24px (same as handle distance in editor)
    layer.style.cssText = `
      position: fixed;
      left: ${x + 24}px;
      top: ${y - 8}px;
      max-width: ${block.offsetWidth}px;
      pointer-events: none;
      z-index: 10000;
      opacity: 0.5;
    `;

    // Clone the actual block content to preserve rendering (headers, lists, formatting)
    const contentEl = block.querySelector('.ce-block__content');
    if (contentEl) {
      const contentClone = contentEl.cloneNode(true);
      // Reset margins/padding that were for editor layout
      contentClone.style.cssText = `
        margin: 0 !important;
        padding: 0 !important;
        max-width: none !important;
      `;
      // Also reset padding/margin on immediate children
      contentClone.querySelectorAll('*').forEach(el => {
        el.style.marginTop = '0';
        el.style.paddingTop = '0';
      });
      layer.appendChild(contentClone);
    }

    document.body.appendChild(layer);
    this.dragLayer = layer;
  }

  removeDragLayer() {
    if (this.dragLayer) {
      this.dragLayer.remove();
      this.dragLayer = null;
    }
  }

  setBorderBlocks(blocks, dropTarget) {
    Object.values(blocks).forEach((block) => {
      const content = block.querySelector('.ce-block__content');

      if (block !== dropTarget) {
        content.style.removeProperty('border-top');
        content.style.removeProperty('border-bottom');
      } else {
        const targetIndex = Object.keys(blocks).find(key => blocks[key] === dropTarget);
        if (targetIndex > this.startBlock) {
          content.style.borderBottom = this.borderStyle;
        } else {
          content.style.borderTop = this.borderStyle;
        }
      }
    });
  }

  setDropListener() {
    document.addEventListener('drop', (event) => {
      const target = event.target;

      if (this.holder.contains(target) && this.startBlock !== null) {
        const dropTarget = this.getDropTarget(target);

        if (dropTarget) {
          const content = dropTarget.querySelector('.ce-block__content');
          content.style.removeProperty('border-top');
          content.style.removeProperty('border-bottom');

          this.endBlock = this.getTargetPosition(dropTarget);
          this.moveBlocks();
        }
      }

      this.startBlock = null;
    });
  }

  getDropTarget(element) {
    return element.classList.contains('ce-block')
      ? element
      : element.closest('.ce-block');
  }

  getTargetPosition(element) {
    return Array.from(element.parentNode.children).indexOf(element);
  }

  isTheOnlyBlock() {
    return this.api.getBlocksCount() === 1;
  }

  moveBlocks() {
    if (this.isTheOnlyBlock()) return;
    this.api.move(this.endBlock, this.startBlock);
  }
}

export default DragDrop;
