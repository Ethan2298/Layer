/**
 * HTML to Editor.js Converter
 *
 * Converts HTML content (from Tiptap/legacy notes) to Editor.js JSON format.
 * Used for lazy migration of existing notes.
 */

/**
 * Convert HTML string to Editor.js JSON format
 * @param {string} html - HTML content from Tiptap or legacy editor
 * @returns {string} JSON string in Editor.js format
 */
export function convert(html) {
  if (!html || typeof html !== 'string') {
    return JSON.stringify({ blocks: [] });
  }

  // Create a temporary DOM element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  const blocks = [];

  // Process each top-level element
  for (const node of temp.childNodes) {
    const block = convertNode(node);
    if (block) {
      if (Array.isArray(block)) {
        blocks.push(...block);
      } else {
        blocks.push(block);
      }
    }
  }

  // If no blocks were created, create an empty paragraph
  if (blocks.length === 0) {
    blocks.push({
      type: 'paragraph',
      data: { text: '' }
    });
  }

  return JSON.stringify({
    time: Date.now(),
    blocks,
    version: '2.29.0'
  });
}

/**
 * Convert a DOM node to Editor.js block(s)
 * @param {Node} node - DOM node to convert
 * @returns {Object|Array|null} Editor.js block(s) or null
 */
function convertNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.trim();
    if (text) {
      return {
        type: 'paragraph',
        data: { text }
      };
    }
    return null;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const tag = node.tagName.toLowerCase();

  switch (tag) {
    case 'h1':
      return {
        type: 'header',
        data: {
          text: getInnerHTML(node),
          level: 1
        }
      };

    case 'h2':
      return {
        type: 'header',
        data: {
          text: getInnerHTML(node),
          level: 2
        }
      };

    case 'h3':
      return {
        type: 'header',
        data: {
          text: getInnerHTML(node),
          level: 3
        }
      };

    case 'h4':
      return {
        type: 'header',
        data: {
          text: getInnerHTML(node),
          level: 4
        }
      };

    case 'h5':
      return {
        type: 'header',
        data: {
          text: getInnerHTML(node),
          level: 5
        }
      };

    case 'h6':
      return {
        type: 'header',
        data: {
          text: getInnerHTML(node),
          level: 6
        }
      };

    case 'p':
      const pText = getInnerHTML(node);
      if (!pText.trim()) return null;
      return {
        type: 'paragraph',
        data: { text: pText }
      };

    case 'ul':
      return convertList(node, 'unordered');

    case 'ol':
      return convertList(node, 'ordered');

    case 'blockquote':
      return {
        type: 'quote',
        data: {
          text: getInnerHTML(node),
          caption: ''
        }
      };

    case 'pre':
      const codeEl = node.querySelector('code');
      const codeText = codeEl ? codeEl.textContent : node.textContent;
      return {
        type: 'code',
        data: {
          code: codeText
        }
      };

    case 'hr':
      return {
        type: 'delimiter',
        data: {}
      };

    case 'div':
      // Process div contents as multiple blocks
      const divBlocks = [];
      for (const child of node.childNodes) {
        const childBlock = convertNode(child);
        if (childBlock) {
          if (Array.isArray(childBlock)) {
            divBlocks.push(...childBlock);
          } else {
            divBlocks.push(childBlock);
          }
        }
      }
      return divBlocks.length > 0 ? divBlocks : null;

    case 'br':
      return null;

    default:
      // For any other element, try to extract text content
      const text = getInnerHTML(node);
      if (text.trim()) {
        return {
          type: 'paragraph',
          data: { text }
        };
      }
      return null;
  }
}

/**
 * Convert a list element to Editor.js list block
 * @param {HTMLElement} listNode - UL or OL element
 * @param {string} style - 'ordered' or 'unordered'
 * @returns {Object} Editor.js list block
 */
function convertList(listNode, style) {
  const items = [];

  for (const li of listNode.children) {
    if (li.tagName.toLowerCase() !== 'li') continue;

    // Check if this LI has a checkbox input (task list)
    const checkbox = li.querySelector('input[type="checkbox"]');
    if (checkbox) {
      // This is a task list item - we'll handle the whole list as a checklist
      return convertToChecklist(listNode);
    }

    const item = convertListItem(li);
    if (item) {
      items.push(item);
    }
  }

  return {
    type: 'list',
    data: {
      style,
      items
    }
  };
}

/**
 * Convert a list item to Editor.js nested list item format
 * @param {HTMLElement} li - LI element
 * @returns {Object} Editor.js list item
 */
function convertListItem(li) {
  // Get direct text content (not from nested lists)
  let content = '';
  const items = [];

  for (const child of li.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      content += child.textContent;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childTag = child.tagName.toLowerCase();
      if (childTag === 'ul' || childTag === 'ol') {
        // Nested list - convert children
        for (const nestedLi of child.children) {
          if (nestedLi.tagName.toLowerCase() === 'li') {
            const nestedItem = convertListItem(nestedLi);
            if (nestedItem) {
              items.push(nestedItem);
            }
          }
        }
      } else {
        // Inline element - get its HTML
        content += getInnerHTML(child);
      }
    }
  }

  return {
    content: content.trim(),
    items
  };
}

/**
 * Convert a task list to Editor.js checklist block
 * @param {HTMLElement} listNode - UL element with checkbox inputs
 * @returns {Object} Editor.js checklist block
 */
function convertToChecklist(listNode) {
  const items = [];

  for (const li of listNode.children) {
    if (li.tagName.toLowerCase() !== 'li') continue;

    const checkbox = li.querySelector('input[type="checkbox"]');
    const checked = checkbox ? checkbox.checked : false;

    // Get text content without the checkbox
    let text = '';
    for (const child of li.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() !== 'input') {
        text += child.textContent;
      }
    }

    items.push({
      text: text.trim(),
      checked
    });
  }

  return {
    type: 'checklist',
    data: {
      items
    }
  };
}

/**
 * Get inner HTML while preserving inline formatting
 * Converts inline elements to Editor.js-compatible format
 * @param {HTMLElement} node - Element to get inner HTML from
 * @returns {string} HTML string with inline formatting
 */
function getInnerHTML(node) {
  // Clone node to avoid modifying original
  const clone = node.cloneNode(true);

  // Remove any script tags for safety
  const scripts = clone.querySelectorAll('script');
  scripts.forEach(s => s.remove());

  // Get innerHTML - Editor.js handles inline formatting (b, i, a, code, mark)
  return clone.innerHTML;
}

/**
 * Check if content is already in Editor.js format
 * @param {string} content - Content string to check
 * @returns {boolean} True if content is Editor.js JSON format
 */
export function isEditorJsFormat(content) {
  if (!content || typeof content !== 'string') return false;
  try {
    const parsed = JSON.parse(content);
    return parsed && Array.isArray(parsed.blocks);
  } catch {
    return false;
  }
}

// ========================================
// Exports
// ========================================

export default {
  convert,
  isEditorJsFormat
};
