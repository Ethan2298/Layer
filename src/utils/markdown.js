/**
 * Simple Markdown Parser
 *
 * Converts markdown text to HTML for rendering notes.
 * Supports: headers, bold, italic, code, links, lists, blockquotes, horizontal rules
 */

/**
 * Parse markdown text to HTML
 * @param {string} text - Markdown text
 * @returns {string} HTML string
 */
export function parseMarkdown(text) {
  if (!text) return '';

  let html = escapeHtml(text);

  // Code blocks (fenced) - must be before other processing
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre class="md-code-block"><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // Headers (h1-h6)
  html = html.replace(/^######\s+(.+)$/gm, '<h6 class="md-h6">$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="md-h5">$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link">$1</a>');

  // Images ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-image">');

  // Blockquotes
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^(-{3,}|_{3,}|\*{3,})$/gm, '<hr class="md-hr">');

  // Unordered lists
  html = html.replace(/^[\*\-]\s+(.+)$/gm, '<li class="md-li">$1</li>');
  html = html.replace(/(<li class="md-li">.*<\/li>\n?)+/g, '<ul class="md-ul">$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="md-li-ordered">$1</li>');
  html = html.replace(/(<li class="md-li-ordered">.*<\/li>\n?)+/g, '<ol class="md-ol">$&</ol>');

  // Task lists
  html = html.replace(/<li class="md-li">\[x\]\s+(.+)<\/li>/gi, '<li class="md-task md-task-done"><span class="md-checkbox">☑</span> $1</li>');
  html = html.replace(/<li class="md-li">\[\s?\]\s+(.+)<\/li>/gi, '<li class="md-task"><span class="md-checkbox">☐</span> $1</li>');

  // Paragraphs (double newline = new paragraph)
  html = html.replace(/\n\n+/g, '</p><p class="md-p">');

  // Single newlines to <br> within paragraphs
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph if not starting with block element
  if (!html.match(/^<(h[1-6]|ul|ol|pre|blockquote|hr)/)) {
    html = `<p class="md-p">${html}</p>`;
  }

  // Clean up empty paragraphs
  html = html.replace(/<p class="md-p"><\/p>/g, '');
  html = html.replace(/<p class="md-p">(<(h[1-6]|ul|ol|pre|blockquote|hr))/g, '$1');
  html = html.replace(/(<\/(h[1-6]|ul|ol|pre|blockquote)>)<\/p>/g, '$1');

  return html;
}

/**
 * Escape HTML special characters
 * @param {string} text - Raw text
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Get file extension
 * @param {string} filename - File name or path
 * @returns {string} Extension without dot, lowercase
 */
export function getFileExtension(filename) {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * Check if file is markdown
 * @param {string} filename - File name or path
 * @returns {boolean} True if markdown file
 */
export function isMarkdownFile(filename) {
  const ext = getFileExtension(filename);
  return ['md', 'markdown', 'mdown', 'mkd', 'mkdn'].includes(ext);
}

/**
 * Check if file is plain text (viewable)
 * @param {string} filename - File name or path
 * @returns {boolean} True if text file
 */
export function isTextFile(filename) {
  const ext = getFileExtension(filename);
  const textExtensions = [
    'txt', 'md', 'markdown', 'mdown', 'mkd', 'mkdn',
    'json', 'js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'less',
    'html', 'htm', 'xml', 'svg', 'yaml', 'yml', 'toml',
    'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp',
    'sh', 'bash', 'zsh', 'fish', 'ps1',
    'sql', 'graphql', 'gql',
    'env', 'gitignore', 'dockerignore', 'editorconfig',
    'log', 'csv', 'tsv'
  ];
  return textExtensions.includes(ext) || !ext;
}

/**
 * Check if file is a PDF
 * @param {string} filename - File name or path
 * @returns {boolean} True if PDF file
 */
export function isPdfFile(filename) {
  return getFileExtension(filename) === 'pdf';
}

/**
 * Check if file is an image
 * @param {string} filename - File name or path
 * @returns {boolean} True if image file
 */
export function isImageFile(filename) {
  const ext = getFileExtension(filename);
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext);
}

/**
 * Check if file is an Excel spreadsheet
 * @param {string} filename - File name or path
 * @returns {boolean} True if Excel file
 */
export function isExcelFile(filename) {
  const ext = getFileExtension(filename);
  return ['xlsx', 'xls', 'xlsm', 'xlsb', 'csv'].includes(ext);
}

/**
 * Get MIME type for image file
 * @param {string} filename - File name or path
 * @returns {string} MIME type
 */
export function getImageMimeType(filename) {
  const ext = getFileExtension(filename);
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    'avif': 'image/avif'
  };
  return mimeTypes[ext] || 'image/png';
}

export default {
  parseMarkdown,
  getFileExtension,
  isMarkdownFile,
  isTextFile,
  isPdfFile,
  isImageFile,
  isExcelFile,
  getImageMimeType
};
