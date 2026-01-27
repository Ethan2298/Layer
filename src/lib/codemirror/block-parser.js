/**
 * Block Parser for CodeMirror 6
 *
 * Parses markdown documents into block boundaries for Notion-style
 * block manipulation. Blocks are derived from markdown structure,
 * keeping markdown as the source of truth.
 */

// ========================================
// Block Types
// ========================================

export const BlockType = {
  PARAGRAPH: 'paragraph',
  HEADING: 'heading',
  BULLET: 'bullet',
  NUMBERED: 'numbered',
  TODO: 'todo',
  QUOTE: 'quote',
  CALLOUT: 'callout',
  CODE: 'code',
  DIVIDER: 'divider',
  TOGGLE: 'toggle',
  EMPTY: 'empty'
};

// ========================================
// Block Structure
// ========================================

/**
 * Create a block object
 * @param {string} type - Block type from BlockType enum
 * @param {number} startLine - 1-indexed start line number
 * @param {number} endLine - 1-indexed end line number
 * @param {number} from - Document position start
 * @param {number} to - Document position end
 * @param {number} depth - Nesting depth (for lists)
 * @param {Object} metadata - Type-specific metadata
 * @returns {Object} Block object
 */
function createBlock(type, startLine, endLine, from, to, depth = 0, metadata = {}) {
  return {
    type,
    startLine,
    endLine,
    from,
    to,
    depth,
    metadata
  };
}

// ========================================
// Pattern Matchers
// ========================================

const patterns = {
  // Headers: # through ######
  heading: /^(#{1,6})\s+(.*)$/,

  // Unordered list: - * +
  bullet: /^(\s*)([-*+])\s+(.*)$/,

  // Ordered list: 1. 2. etc
  numbered: /^(\s*)(\d+)\.\s+(.*)$/,

  // Task list: - [ ] or - [x]
  todo: /^(\s*)([-*+])\s+\[([ xX])\]\s*(.*)$/,

  // Blockquote: >
  quote: /^>\s*(.*)$/,

  // Callout: > [!type]
  callout: /^>\s*\[!(\w+)\]\s*(.*)$/,

  // Code fence: ```
  codeFence: /^(`{3,}|~{3,})(\w*)$/,

  // Horizontal rule: ---, ***, ___
  divider: /^([-*_])\1{2,}\s*$/,

  // Toggle/details: <details>
  toggleStart: /^<details[^>]*>/i,
  toggleEnd: /^<\/details>/i,

  // Empty line
  empty: /^\s*$/
};

// ========================================
// Block Parser
// ========================================

/**
 * Parse a document into blocks
 * @param {Text} doc - CodeMirror document
 * @returns {Array} Array of block objects
 */
export function parseBlocks(doc) {
  const blocks = [];
  const totalLines = doc.lines;

  let lineNum = 1;
  let inCodeBlock = false;
  let codeFenceMarker = null;
  let codeBlockStart = null;
  let codeBlockStartLine = null;

  let inToggle = false;
  let toggleStart = null;
  let toggleStartLine = null;

  let quoteStart = null;
  let quoteStartLine = null;

  while (lineNum <= totalLines) {
    const line = doc.line(lineNum);
    const text = line.text;
    const from = line.from;
    const to = line.to;

    // ========================================
    // Code Block Handling (multi-line)
    // ========================================

    if (inCodeBlock) {
      // Check for closing fence
      const fenceMatch = text.match(patterns.codeFence);
      if (fenceMatch && text.startsWith(codeFenceMarker.charAt(0))) {
        // End of code block
        blocks.push(createBlock(
          BlockType.CODE,
          codeBlockStartLine,
          lineNum,
          codeBlockStart,
          to,
          0,
          { language: '' }
        ));
        inCodeBlock = false;
        codeFenceMarker = null;
        codeBlockStart = null;
        codeBlockStartLine = null;
        lineNum++;
        continue;
      }
      // Still in code block, continue
      lineNum++;
      continue;
    }

    // Check for code fence start
    const codeFenceMatch = text.match(patterns.codeFence);
    if (codeFenceMatch) {
      // Flush any pending quote block
      if (quoteStart !== null) {
        blocks.push(createBlock(
          BlockType.QUOTE,
          quoteStartLine,
          lineNum - 1,
          quoteStart,
          doc.line(lineNum - 1).to,
          0
        ));
        quoteStart = null;
        quoteStartLine = null;
      }

      inCodeBlock = true;
      codeFenceMarker = codeFenceMatch[1];
      codeBlockStart = from;
      codeBlockStartLine = lineNum;
      lineNum++;
      continue;
    }

    // ========================================
    // Toggle/Details Handling (multi-line)
    // ========================================

    if (inToggle) {
      if (patterns.toggleEnd.test(text)) {
        // End of toggle
        blocks.push(createBlock(
          BlockType.TOGGLE,
          toggleStartLine,
          lineNum,
          toggleStart,
          to,
          0
        ));
        inToggle = false;
        toggleStart = null;
        toggleStartLine = null;
        lineNum++;
        continue;
      }
      // Still in toggle, continue
      lineNum++;
      continue;
    }

    if (patterns.toggleStart.test(text)) {
      // Flush any pending quote block
      if (quoteStart !== null) {
        blocks.push(createBlock(
          BlockType.QUOTE,
          quoteStartLine,
          lineNum - 1,
          quoteStart,
          doc.line(lineNum - 1).to,
          0
        ));
        quoteStart = null;
        quoteStartLine = null;
      }

      inToggle = true;
      toggleStart = from;
      toggleStartLine = lineNum;
      lineNum++;
      continue;
    }

    // ========================================
    // Quote Block Handling (consecutive lines)
    // ========================================

    const quoteMatch = text.match(patterns.quote);
    const calloutMatch = text.match(patterns.callout);

    if (quoteMatch || calloutMatch) {
      if (quoteStart === null) {
        quoteStart = from;
        quoteStartLine = lineNum;
      }
      // Continue accumulating quote lines
      lineNum++;
      continue;
    } else if (quoteStart !== null) {
      // End of quote block
      blocks.push(createBlock(
        BlockType.QUOTE,
        quoteStartLine,
        lineNum - 1,
        quoteStart,
        doc.line(lineNum - 1).to,
        0
      ));
      quoteStart = null;
      quoteStartLine = null;
      // Don't increment lineNum - process current line
    }

    // ========================================
    // Single-Line Block Types
    // ========================================

    // Empty line
    if (patterns.empty.test(text)) {
      blocks.push(createBlock(BlockType.EMPTY, lineNum, lineNum, from, to, 0));
      lineNum++;
      continue;
    }

    // Divider
    if (patterns.divider.test(text)) {
      blocks.push(createBlock(BlockType.DIVIDER, lineNum, lineNum, from, to, 0));
      lineNum++;
      continue;
    }

    // Heading
    const headingMatch = text.match(patterns.heading);
    if (headingMatch) {
      blocks.push(createBlock(
        BlockType.HEADING,
        lineNum,
        lineNum,
        from,
        to,
        0,
        { level: headingMatch[1].length }
      ));
      lineNum++;
      continue;
    }

    // Task list (check before bullet)
    const todoMatch = text.match(patterns.todo);
    if (todoMatch) {
      const indent = todoMatch[1].length;
      const depth = Math.floor(indent / 2);
      blocks.push(createBlock(
        BlockType.TODO,
        lineNum,
        lineNum,
        from,
        to,
        depth,
        { checked: todoMatch[3].toLowerCase() === 'x' }
      ));
      lineNum++;
      continue;
    }

    // Bullet list
    const bulletMatch = text.match(patterns.bullet);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const depth = Math.floor(indent / 2);
      blocks.push(createBlock(
        BlockType.BULLET,
        lineNum,
        lineNum,
        from,
        to,
        depth
      ));
      lineNum++;
      continue;
    }

    // Numbered list
    const numberedMatch = text.match(patterns.numbered);
    if (numberedMatch) {
      const indent = numberedMatch[1].length;
      const depth = Math.floor(indent / 2);
      blocks.push(createBlock(
        BlockType.NUMBERED,
        lineNum,
        lineNum,
        from,
        to,
        depth,
        { number: parseInt(numberedMatch[2], 10) }
      ));
      lineNum++;
      continue;
    }

    // Default: paragraph
    blocks.push(createBlock(BlockType.PARAGRAPH, lineNum, lineNum, from, to, 0));
    lineNum++;
  }

  // Flush any remaining multi-line blocks
  if (inCodeBlock && codeBlockStart !== null) {
    blocks.push(createBlock(
      BlockType.CODE,
      codeBlockStartLine,
      totalLines,
      codeBlockStart,
      doc.line(totalLines).to,
      0
    ));
  }

  if (inToggle && toggleStart !== null) {
    blocks.push(createBlock(
      BlockType.TOGGLE,
      toggleStartLine,
      totalLines,
      toggleStart,
      doc.line(totalLines).to,
      0
    ));
  }

  if (quoteStart !== null) {
    blocks.push(createBlock(
      BlockType.QUOTE,
      quoteStartLine,
      totalLines,
      quoteStart,
      doc.line(totalLines).to,
      0
    ));
  }

  return blocks;
}

// ========================================
// Block Utilities
// ========================================

/**
 * Find block at a given document position
 * @param {Array} blocks - Array of blocks
 * @param {number} pos - Document position
 * @returns {Object|null} Block at position or null
 */
export function getBlockAtPosition(blocks, pos) {
  for (const block of blocks) {
    if (pos >= block.from && pos <= block.to) {
      return block;
    }
  }
  return null;
}

/**
 * Find block at a given line number
 * @param {Array} blocks - Array of blocks
 * @param {number} lineNum - 1-indexed line number
 * @returns {Object|null} Block at line or null
 */
export function getBlockAtLine(blocks, lineNum) {
  for (const block of blocks) {
    if (lineNum >= block.startLine && lineNum <= block.endLine) {
      return block;
    }
  }
  return null;
}

/**
 * Find block index at a given line number
 * @param {Array} blocks - Array of blocks
 * @param {number} lineNum - 1-indexed line number
 * @returns {number} Index of block or -1
 */
export function getBlockIndexAtLine(blocks, lineNum) {
  for (let i = 0; i < blocks.length; i++) {
    if (lineNum >= blocks[i].startLine && lineNum <= blocks[i].endLine) {
      return i;
    }
  }
  return -1;
}

/**
 * Get blocks visible in viewport
 * @param {Array} blocks - Array of blocks
 * @param {number} fromLine - Start line of viewport
 * @param {number} toLine - End line of viewport
 * @returns {Array} Blocks visible in viewport
 */
export function getBlocksInViewport(blocks, fromLine, toLine) {
  return blocks.filter(block =>
    block.endLine >= fromLine && block.startLine <= toLine
  );
}

/**
 * Check if block type should show a drag handle
 * @param {string} type - Block type
 * @returns {boolean}
 */
export function shouldShowHandle(type) {
  // Show handles for all block types including empty lines
  return true;
}

export default {
  BlockType,
  parseBlocks,
  getBlockAtPosition,
  getBlockAtLine,
  getBlockIndexAtLine,
  getBlocksInViewport,
  shouldShowHandle
};
