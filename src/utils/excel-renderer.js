/**
 * Excel Renderer
 *
 * Renders Excel files using ExcelJS for parsing and HTML tables for display.
 * Supports .xlsx, .xls, .xlsm, .xlsb, and .csv files in read-only mode.
 */

// Track current state
let currentWorkbook = null;
let currentSheetIndex = 0;

/**
 * Parse Excel binary data using ExcelJS
 * @param {string} base64Data - Base64 encoded Excel file
 * @returns {Promise<Object>} Parsed workbook data
 */
async function parseExcelData(base64Data) {
  const ExcelJS = window.ExcelJS;
  if (!ExcelJS) {
    throw new Error('ExcelJS not loaded');
  }

  const workbook = new ExcelJS.Workbook();

  // Decode base64 to ArrayBuffer
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  await workbook.xlsx.load(bytes.buffer);

  // Convert to our internal format
  const sheets = [];
  workbook.eachSheet((worksheet, sheetId) => {
    const sheetData = {
      name: worksheet.name,
      id: sheetId,
      rows: [],
      merges: [],
      columnWidths: {},
      rowHeights: {}
    };

    // Get merged cells
    if (worksheet._merges) {
      Object.keys(worksheet._merges).forEach(key => {
        const merge = worksheet._merges[key];
        sheetData.merges.push({
          startRow: merge.top,
          startCol: merge.left,
          endRow: merge.bottom,
          endCol: merge.right
        });
      });
    }

    // Get column widths
    worksheet.columns.forEach((col, idx) => {
      if (col.width) {
        sheetData.columnWidths[idx + 1] = col.width;
      }
    });

    // Process rows
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const rowData = {
        rowNumber,
        height: row.height,
        cells: []
      };

      if (row.height) {
        sheetData.rowHeights[rowNumber] = row.height;
      }

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        rowData.cells.push({
          col: colNumber,
          value: getCellDisplayValue(cell),
          style: extractCellStyle(cell),
          formula: cell.formula || null,
          type: cell.type
        });
      });

      sheetData.rows.push(rowData);
    });

    sheets.push(sheetData);
  });

  return { sheets };
}

/**
 * Get display value for a cell (handles formulas, dates, etc.)
 */
function getCellDisplayValue(cell) {
  if (cell.value === null || cell.value === undefined) {
    return '';
  }

  // Handle formula results
  if (cell.formula && cell.result !== undefined) {
    return formatValue(cell.result, cell.numFmt);
  }

  // Handle rich text
  if (cell.value && cell.value.richText) {
    return cell.value.richText.map(rt => rt.text).join('');
  }

  // Handle hyperlinks
  if (cell.value && cell.value.hyperlink) {
    return cell.value.text || cell.value.hyperlink;
  }

  // Handle dates
  if (cell.value instanceof Date) {
    return formatDate(cell.value);
  }

  // Handle errors
  if (cell.value && cell.value.error) {
    return cell.value.error;
  }

  return formatValue(cell.value, cell.numFmt);
}

/**
 * Format value based on number format
 */
function formatValue(value, numFmt) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    // Basic number formatting
    if (numFmt && numFmt.includes('%')) {
      return (value * 100).toFixed(2) + '%';
    }
    if (numFmt && numFmt.includes('$')) {
      return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    // Round to reasonable precision
    if (Number.isInteger(value)) return String(value);
    return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }
  return String(value);
}

/**
 * Format date value
 */
function formatDate(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Extract cell styling information
 */
function extractCellStyle(cell) {
  const style = {};

  if (!cell.style) return style;

  // Font styling
  if (cell.style.font) {
    if (cell.style.font.bold) style.fontWeight = 'bold';
    if (cell.style.font.italic) style.fontStyle = 'italic';
    if (cell.style.font.underline) style.textDecoration = 'underline';
    if (cell.style.font.strike) style.textDecoration = (style.textDecoration || '') + ' line-through';
    if (cell.style.font.color && cell.style.font.color.argb) {
      style.color = argbToHex(cell.style.font.color.argb);
    }
    if (cell.style.font.size) {
      style.fontSize = cell.style.font.size + 'pt';
    }
  }

  // Background color
  if (cell.style.fill && cell.style.fill.fgColor && cell.style.fill.fgColor.argb) {
    style.backgroundColor = argbToHex(cell.style.fill.fgColor.argb);
  }

  // Alignment
  if (cell.style.alignment) {
    if (cell.style.alignment.horizontal) {
      style.textAlign = cell.style.alignment.horizontal;
    }
    if (cell.style.alignment.vertical) {
      style.verticalAlign = cell.style.alignment.vertical === 'middle' ? 'middle' : cell.style.alignment.vertical;
    }
    if (cell.style.alignment.wrapText) {
      style.whiteSpace = 'pre-wrap';
      style.wordWrap = 'break-word';
    }
  }

  // Border styling
  if (cell.style.border) {
    const borderStyle = (b) => b ? '1px solid #d0d0d0' : '';
    if (cell.style.border.top) style.borderTop = borderStyle(cell.style.border.top);
    if (cell.style.border.bottom) style.borderBottom = borderStyle(cell.style.border.bottom);
    if (cell.style.border.left) style.borderLeft = borderStyle(cell.style.border.left);
    if (cell.style.border.right) style.borderRight = borderStyle(cell.style.border.right);
  }

  return style;
}

/**
 * Convert ARGB color to hex
 */
function argbToHex(argb) {
  if (!argb || argb.length < 6) return null;
  // ARGB format: first 2 chars are alpha, rest is RGB
  const rgb = argb.length === 8 ? argb.slice(2) : argb;
  return '#' + rgb;
}

/**
 * Build HTML table from sheet data
 */
function buildSheetHTML(sheet) {
  if (!sheet.rows.length) {
    return '<div class="excel-empty">This sheet is empty</div>';
  }

  // Find max column
  let maxCol = 0;
  sheet.rows.forEach(row => {
    row.cells.forEach(cell => {
      if (cell.col > maxCol) maxCol = cell.col;
    });
  });

  // Build merge map for quick lookup
  const mergeMap = {};
  const skipCells = new Set();

  sheet.merges.forEach(merge => {
    const key = `${merge.startRow}-${merge.startCol}`;
    mergeMap[key] = {
      rowSpan: merge.endRow - merge.startRow + 1,
      colSpan: merge.endCol - merge.startCol + 1
    };
    // Mark cells to skip
    for (let r = merge.startRow; r <= merge.endRow; r++) {
      for (let c = merge.startCol; c <= merge.endCol; c++) {
        if (r !== merge.startRow || c !== merge.startCol) {
          skipCells.add(`${r}-${c}`);
        }
      }
    }
  });

  // Build HTML
  let html = '<table class="excel-table"><thead><tr><th class="excel-row-header"></th>';

  // Column headers (A, B, C, ...)
  for (let col = 1; col <= maxCol; col++) {
    const width = sheet.columnWidths[col] ? `width: ${sheet.columnWidths[col] * 7}px;` : '';
    html += `<th class="excel-col-header" style="${width}">${getColumnLetter(col)}</th>`;
  }
  html += '</tr></thead><tbody>';

  // Data rows
  sheet.rows.forEach(row => {
    const height = row.height ? `height: ${row.height}px;` : '';
    html += `<tr style="${height}"><td class="excel-row-header">${row.rowNumber}</td>`;

    // Build cell map for this row
    const cellMap = {};
    row.cells.forEach(cell => {
      cellMap[cell.col] = cell;
    });

    for (let col = 1; col <= maxCol; col++) {
      const cellKey = `${row.rowNumber}-${col}`;

      // Skip merged cells
      if (skipCells.has(cellKey)) continue;

      const cell = cellMap[col] || { value: '', style: {} };
      const mergeInfo = mergeMap[cellKey];

      let tdAttrs = '';
      if (mergeInfo) {
        if (mergeInfo.rowSpan > 1) tdAttrs += ` rowspan="${mergeInfo.rowSpan}"`;
        if (mergeInfo.colSpan > 1) tdAttrs += ` colspan="${mergeInfo.colSpan}"`;
      }

      // Build inline styles
      const styleStr = buildStyleString(cell.style);
      const width = sheet.columnWidths[col] ? `min-width: ${sheet.columnWidths[col] * 7}px;` : '';

      html += `<td${tdAttrs} style="${width}${styleStr}" title="${cell.formula ? 'Formula: =' + cell.formula : ''}">${escapeHtml(String(cell.value))}</td>`;
    }

    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

/**
 * Convert column number to letter (1=A, 2=B, ..., 27=AA)
 */
function getColumnLetter(col) {
  let letter = '';
  while (col > 0) {
    const remainder = (col - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

/**
 * Build CSS style string from style object
 */
function buildStyleString(style) {
  if (!style || Object.keys(style).length === 0) return '';
  return Object.entries(style)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value}`;
    })
    .join('; ') + ';';
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render sheet tabs
 */
function renderSheetTabs(sheets, activeIndex, onTabClick) {
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'excel-sheet-tabs';

  sheets.forEach((sheet, index) => {
    const tab = document.createElement('button');
    tab.className = `excel-sheet-tab${index === activeIndex ? ' active' : ''}`;
    tab.textContent = sheet.name;
    tab.addEventListener('click', () => onTabClick(index));
    tabsContainer.appendChild(tab);
  });

  return tabsContainer;
}

/**
 * Render Excel file in container
 * @param {HTMLElement} container - Container element
 * @param {string} base64Data - Base64 encoded Excel data
 * @param {string} fileName - Original file name
 */
export async function renderExcel(container, base64Data, fileName) {
  container.innerHTML = '<div class="excel-loading">Loading spreadsheet...</div>';
  container.className = 'excel-container';

  try {
    // Parse Excel data
    const workbook = await parseExcelData(base64Data);
    currentWorkbook = workbook;
    currentSheetIndex = 0;

    if (!workbook.sheets.length) {
      container.innerHTML = '<div class="excel-error">No sheets found in file</div>';
      return;
    }

    // Render the workbook
    renderWorkbook(container, workbook);

  } catch (error) {
    console.error('Excel render error:', error);
    container.innerHTML = `<div class="excel-error">Error loading spreadsheet: ${error.message}</div>`;
  }
}

/**
 * Render CSV file in container
 * @param {HTMLElement} container - Container element
 * @param {string} csvContent - CSV text content
 * @param {string} fileName - Original file name
 */
export function renderCsv(container, csvContent, fileName) {
  container.innerHTML = '<div class="excel-loading">Loading CSV...</div>';
  container.className = 'excel-container';

  try {
    // Parse CSV
    const rows = parseCSV(csvContent);

    // Convert to sheet format
    const sheet = {
      name: fileName.replace(/\.csv$/i, ''),
      id: 1,
      rows: rows.map((rowData, rowIndex) => ({
        rowNumber: rowIndex + 1,
        cells: rowData.map((value, colIndex) => ({
          col: colIndex + 1,
          value: value,
          style: {},
          formula: null
        }))
      })),
      merges: [],
      columnWidths: {},
      rowHeights: {}
    };

    const workbook = { sheets: [sheet] };
    currentWorkbook = workbook;
    currentSheetIndex = 0;

    renderWorkbook(container, workbook);

  } catch (error) {
    console.error('CSV render error:', error);
    container.innerHTML = `<div class="excel-error">Error loading CSV: ${error.message}</div>`;
  }
}

/**
 * Parse CSV content
 */
function parseCSV(content) {
  const rows = [];
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;

    const row = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Render workbook with tabs and table
 */
function renderWorkbook(container, workbook) {
  container.innerHTML = '';

  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'excel-wrapper';

  // Sheet tabs (only if multiple sheets)
  if (workbook.sheets.length > 1) {
    const tabs = renderSheetTabs(workbook.sheets, currentSheetIndex, (index) => {
      currentSheetIndex = index;
      renderWorkbook(container, workbook);
    });
    wrapper.appendChild(tabs);
  }

  // Table container with scroll
  const tableContainer = document.createElement('div');
  tableContainer.className = 'excel-table-container';
  tableContainer.innerHTML = buildSheetHTML(workbook.sheets[currentSheetIndex]);
  wrapper.appendChild(tableContainer);

  // Info bar
  const infoBar = document.createElement('div');
  infoBar.className = 'excel-info-bar';
  const sheet = workbook.sheets[currentSheetIndex];
  const rowCount = sheet.rows.length;
  const colCount = Math.max(...sheet.rows.map(r => Math.max(...r.cells.map(c => c.col), 0)), 0);
  infoBar.textContent = `${rowCount} rows x ${colCount} columns`;
  wrapper.appendChild(infoBar);

  container.appendChild(wrapper);
}

/**
 * Check if file is an Excel file
 */
export function isExcelFile(filename) {
  const ext = filename?.split('.').pop()?.toLowerCase();
  return ['xlsx', 'xls', 'csv', 'xlsm', 'xlsb'].includes(ext);
}

/**
 * Cleanup function (for future use)
 */
export function destroyExcel() {
  currentWorkbook = null;
  currentSheetIndex = 0;
}

export default {
  renderExcel,
  renderCsv,
  destroyExcel,
  isExcelFile
};
