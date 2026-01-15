/**
 * PDF Renderer
 *
 * Generates real PDFs using jsPDF and renders them using pdf.js
 * Displays as floating white pages with gaps between them.
 */

// PDF content templates for demo documents
const PDF_TEMPLATES = {
  'project-proposal': {
    title: 'Q1 2025 Project Proposal',
    sections: [
      { heading: 'Executive Summary', paragraphs: 3 },
      { heading: 'Project Objectives', paragraphs: 2, bullets: ['Increase user engagement by 40%', 'Reduce load times to under 2 seconds', 'Implement real-time collaboration features', 'Launch mobile companion app'] },
      { heading: 'Timeline & Milestones', paragraphs: 1, bullets: ['Phase 1: Research & Planning (Jan-Feb)', 'Phase 2: Development (Mar-May)', 'Phase 3: Testing & QA (Jun)', 'Phase 4: Launch (Jul)'] },
      { heading: 'Budget Breakdown', paragraphs: 2 },
      { heading: 'Risk Assessment', paragraphs: 2, bullets: ['Technical complexity', 'Resource availability', 'Market timing', 'Integration challenges'] },
      { heading: 'Conclusion', paragraphs: 2 }
    ]
  },
  'meeting-minutes': {
    title: 'Weekly Team Meeting Minutes',
    subtitle: 'January 10, 2025 - 10:00 AM',
    sections: [
      { heading: 'Attendees', bullets: ['Sarah Chen - Product Lead', 'Mike Rodriguez - Engineering', 'Alex Kim - Design', 'Jordan Lee - QA'] },
      { heading: 'Agenda Items Discussed', paragraphs: 1, bullets: ['Sprint retrospective', 'Q1 roadmap review', 'Resource allocation', 'Upcoming deadlines'] },
      { heading: 'Action Items', bullets: ['Sarah: Finalize spec by Friday', 'Mike: Set up staging environment', 'Alex: Complete design mockups', 'Jordan: Write test cases'] },
      { heading: 'Next Meeting', paragraphs: 1 }
    ]
  },
  'invoice': {
    title: 'INVOICE',
    subtitle: '#2025-001',
    isInvoice: true
  },
  'user-guide': {
    title: 'Objectiv User Guide',
    subtitle: 'Version 1.0',
    sections: [
      { heading: 'Introduction', paragraphs: 2 },
      { heading: 'Getting Started', paragraphs: 2, bullets: ['Installation', 'Initial setup', 'Creating your first objective', 'Understanding priorities'] },
      { heading: 'Core Concepts', paragraphs: 3 },
      { heading: 'Objectives', paragraphs: 2, bullets: ['Creating objectives', 'Setting clarity scores', 'Tracking progress', 'Archiving completed goals'] },
      { heading: 'Priorities', paragraphs: 2 },
      { heading: 'Steps & Logging', paragraphs: 2 },
      { heading: 'File Browser', paragraphs: 2, bullets: ['Navigating folders', 'Viewing files', 'Markdown support', 'PDF rendering'] },
      { heading: 'Keyboard Shortcuts', paragraphs: 1, bullets: ['j/k - Navigate up/down', 'Enter - Select/Edit', 'Escape - Cancel', 'n - New item', 'd - Delete'] },
      { heading: 'Tips & Best Practices', paragraphs: 3 },
      { heading: 'Troubleshooting', paragraphs: 2 }
    ]
  }
};

// Lorem ipsum generator for realistic text
const LOREM_WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum'.split(' ');

function generateSentence(wordCount = 12) {
  const words = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)]);
  }
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(' ') + '.';
}

function generateParagraph(sentenceCount = 4) {
  const sentences = [];
  for (let i = 0; i < sentenceCount; i++) {
    sentences.push(generateSentence(8 + Math.floor(Math.random() * 8)));
  }
  return sentences.join(' ');
}

/**
 * Generate a real PDF using jsPDF
 * @param {Object} metadata - PDF metadata from dummy data
 * @returns {ArrayBuffer} PDF data as ArrayBuffer
 */
export function generatePdf(metadata) {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) {
    console.error('jsPDF not loaded');
    return null;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 60;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  // Get template based on title
  let template = null;
  const titleLower = (metadata.title || '').toLowerCase();
  if (titleLower.includes('proposal')) template = PDF_TEMPLATES['project-proposal'];
  else if (titleLower.includes('meeting') || titleLower.includes('minutes')) template = PDF_TEMPLATES['meeting-minutes'];
  else if (titleLower.includes('invoice')) template = PDF_TEMPLATES['invoice'];
  else if (titleLower.includes('guide')) template = PDF_TEMPLATES['user-guide'];

  // Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(template?.title || metadata.title || 'Document', pageWidth / 2, y, { align: 'center' });
  y += 35;

  // Subtitle if exists
  if (template?.subtitle) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(template.subtitle, pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 30;
  }

  // Horizontal line
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 30;

  // Special handling for invoice
  if (template?.isInvoice) {
    renderInvoice(doc, margin, y, contentWidth, pageWidth);
    return doc.output('arraybuffer');
  }

  // Render sections
  if (template?.sections) {
    for (const section of template.sections) {
      // Check if we need a new page
      if (y > pageHeight - 150) {
        doc.addPage();
        y = margin;
      }

      // Section heading
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(section.heading, margin, y);
      y += 22;

      // Paragraphs
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      if (section.paragraphs) {
        for (let i = 0; i < section.paragraphs; i++) {
          const para = generateParagraph(3 + Math.floor(Math.random() * 2));
          const lines = doc.splitTextToSize(para, contentWidth);

          // Check page break
          if (y + (lines.length * 14) > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }

          doc.text(lines, margin, y);
          y += lines.length * 14 + 12;
        }
      }

      // Bullet points
      if (section.bullets) {
        for (const bullet of section.bullets) {
          if (y > pageHeight - 50) {
            doc.addPage();
            y = margin;
          }
          doc.text(`•  ${bullet}`, margin + 15, y);
          y += 18;
        }
        y += 10;
      }

      y += 15;
    }
  } else {
    // Generic content for PDFs without template
    const targetPages = metadata.pageCount || 1;
    for (let page = 0; page < targetPages; page++) {
      if (page > 0) {
        doc.addPage();
        y = margin;
      }

      // Add some content to each page
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Section ${page + 1}`, margin, y);
      y += 25;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');

      for (let i = 0; i < 4; i++) {
        const para = generateParagraph(4);
        const lines = doc.splitTextToSize(para, contentWidth);

        if (y + (lines.length * 14) > pageHeight - margin) break;

        doc.text(lines, margin, y);
        y += lines.length * 14 + 15;
      }
    }
  }

  // Add page numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    doc.text(`${i} / ${totalPages}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
    doc.setTextColor(0);
  }

  return doc.output('arraybuffer');
}

/**
 * Render invoice content
 */
function renderInvoice(doc, margin, startY, contentWidth, pageWidth) {
  let y = startY;

  // From/To section
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('FROM:', margin, y);
  doc.text('TO:', pageWidth / 2 + 20, y);
  y += 15;

  doc.setFont('helvetica', 'normal');
  doc.text('Objectiv Solutions Inc.', margin, y);
  doc.text('Acme Corporation', pageWidth / 2 + 20, y);
  y += 12;
  doc.text('123 Innovation Drive', margin, y);
  doc.text('456 Business Avenue', pageWidth / 2 + 20, y);
  y += 12;
  doc.text('San Francisco, CA 94102', margin, y);
  doc.text('New York, NY 10001', pageWidth / 2 + 20, y);
  y += 30;

  // Invoice details
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Date:', margin, y);
  doc.text('Due Date:', margin + 200, y);
  y += 15;
  doc.setFont('helvetica', 'normal');
  doc.text('January 10, 2025', margin, y);
  doc.text('January 25, 2025', margin + 200, y);
  y += 35;

  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 5, contentWidth, 25, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Description', margin + 10, y + 10);
  doc.text('Qty', margin + 300, y + 10);
  doc.text('Rate', margin + 360, y + 10);
  doc.text('Amount', margin + 430, y + 10);
  y += 30;

  // Table rows
  const items = [
    { desc: 'Software Development Services', qty: 40, rate: 150 },
    { desc: 'UI/UX Design Consultation', qty: 8, rate: 125 },
    { desc: 'Project Management', qty: 10, rate: 100 }
  ];

  doc.setFont('helvetica', 'normal');
  for (const item of items) {
    doc.text(item.desc, margin + 10, y);
    doc.text(item.qty.toString(), margin + 300, y);
    doc.text(`$${item.rate.toFixed(2)}`, margin + 360, y);
    doc.text(`$${(item.qty * item.rate).toFixed(2)}`, margin + 430, y);
    y += 20;
    doc.setDrawColor(230);
    doc.line(margin, y - 5, margin + contentWidth, y - 5);
  }

  y += 20;
  const subtotal = items.reduce((sum, i) => sum + i.qty * i.rate, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  // Totals
  doc.text('Subtotal:', margin + 330, y);
  doc.text(`$${subtotal.toFixed(2)}`, margin + 430, y);
  y += 18;
  doc.text('Tax (8%):', margin + 330, y);
  doc.text(`$${tax.toFixed(2)}`, margin + 430, y);
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', margin + 330, y);
  doc.text(`$${total.toFixed(2)}`, margin + 430, y);
  y += 40;

  // Payment info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text('Payment Terms: Net 15 | Please make checks payable to Objectiv Solutions Inc.', margin, y);
}

/**
 * Render a real PDF to the container using pdf.js
 * @param {HTMLElement} container - Container element
 * @param {Object} metadata - PDF metadata from dummy data
 */
export async function renderPdf(container, metadata) {
  container.innerHTML = '<div class="pdf-loading">Generating PDF...</div>';
  container.className = 'pdf-container';

  try {
    // Generate the PDF
    const pdfData = generatePdf(metadata);
    if (!pdfData) {
      container.innerHTML = '<div class="pdf-error">Failed to generate PDF</div>';
      return;
    }

    // Load with pdf.js
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) {
      container.innerHTML = '<div class="pdf-error">PDF.js not loaded</div>';
      return;
    }

    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;

    container.innerHTML = '';

    // Render each page
    const scale = 1.5;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Create page container
      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdf-page';
      pageDiv.style.width = `${viewport.width}px`;
      pageDiv.style.height = `${viewport.height}px`;
      pageDiv.style.maxWidth = '100%';
      pageDiv.style.aspectRatio = 'auto';

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      const context = canvas.getContext('2d');
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      pageDiv.appendChild(canvas);
      container.appendChild(pageDiv);
    }
  } catch (error) {
    console.error('PDF render error:', error);
    container.innerHTML = `<div class="pdf-error">Error rendering PDF: ${error.message}</div>`;
  }
}

/**
 * Check if content is PDF metadata (for dummy mode)
 * @param {*} content - File content to check
 * @returns {boolean} True if PDF metadata object
 */
export function isPdfMetadata(content) {
  return content && typeof content === 'object' && content.type === 'pdf';
}

export default {
  renderPdf,
  generatePdf,
  isPdfMetadata
};
