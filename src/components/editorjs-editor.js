/**
 * Editor.js Component
 *
 * Provides a Notion-style block-based editing experience for notes.
 * Uses Editor.js with plugins for headings, lists, quotes, code, etc.
 */

// ========================================
// Editor.js Imports via ESM.sh CDN
// ========================================

let EditorJS = null;
let Header = null;
let NestedList = null;
let Checklist = null;
let Quote = null;
let CodeTool = null;
let Delimiter = null;
let InlineCode = null;
let Marker = null;
// New plugins
let Table = null;
let LinkTool = null;
let Embed = null;
let Warning = null;
let Toggle = null;
let Underline = null;
let Strikethrough = null;
let ColorPlugin = null;
let AlignmentTune = null;
let Undo = null;
let editorjsLoaded = false;
let loadPromise = null;

/**
 * Load Editor.js modules from CDN
 */
export async function loadEditorJs() {
  if (editorjsLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      console.log('Loading Editor.js from CDN...');

      const modules = await Promise.all([
        import('https://esm.sh/@editorjs/editorjs@2.29.0'),
        import('https://esm.sh/@editorjs/header@2.8.1'),
        import('https://esm.sh/@editorjs/nested-list@1.4.2'),
        import('https://esm.sh/@editorjs/checklist@1.6.0'),
        import('https://esm.sh/@editorjs/quote@2.6.0'),
        import('https://esm.sh/@editorjs/code@2.9.0'),
        import('https://esm.sh/@editorjs/delimiter@1.4.0'),
        import('https://esm.sh/@editorjs/inline-code@1.5.0'),
        import('https://esm.sh/@editorjs/marker@1.4.0'),
        // New plugins
        import('https://esm.sh/@editorjs/table@2.3.0'),
        import('https://esm.sh/@editorjs/link@2.6.2'),
        import('https://esm.sh/@editorjs/embed@2.7.4'),
        import('https://esm.sh/@editorjs/warning@1.4.0'),
        import('https://esm.sh/editorjs-toggle-block'),
        import('https://esm.sh/@editorjs/underline@1.1.0'),
        import('https://esm.sh/@sotaproject/strikethrough@1.0.1'),
        import('https://esm.sh/editorjs-text-color-plugin'),
        import('https://esm.sh/editorjs-text-alignment-blocktune'),
        import('https://esm.sh/editorjs-undo'),
      ]);

      EditorJS = modules[0].default;
      Header = modules[1].default;
      NestedList = modules[2].default;
      Checklist = modules[3].default;
      Quote = modules[4].default;
      CodeTool = modules[5].default;
      Delimiter = modules[6].default;
      InlineCode = modules[7].default;
      Marker = modules[8].default;
      // New plugins
      Table = modules[9].default;
      LinkTool = modules[10].default;
      Embed = modules[11].default;
      Warning = modules[12].default;
      Toggle = modules[13].default;
      Underline = modules[14].default;
      Strikethrough = modules[15].default;
      ColorPlugin = modules[16].default;
      AlignmentTune = modules[17].default;
      Undo = modules[18].default;

      editorjsLoaded = true;
      console.log('Editor.js loaded successfully');
    } catch (error) {
      console.error('Failed to load Editor.js:', error);
      throw error;
    }
  })();

  return loadPromise;
}

// ========================================
// Editor State
// ========================================

let editorInstance = null;
let autoSaveCallback = null;
let autoSaveTimeout = null;
const AUTOSAVE_DELAY = 1000; // 1 second debounce

// ========================================
// Editor Lifecycle
// ========================================

/**
 * Initialize the Editor.js editor for note content
 * @param {string} content - JSON string of Editor.js data or empty
 * @param {string} noteId - ID of the note being edited
 * @param {HTMLElement} container - Container element
 * @param {Function} onAutoSave - Callback when content changes (receives JSON string)
 */
export async function initNoteEditor(content, noteId, container, onAutoSave) {
  // Load Editor.js if not already loaded
  await loadEditorJs();

  // Destroy existing editor
  destroyNoteEditor();

  // Store auto-save callback
  autoSaveCallback = onAutoSave;

  // Create editor container
  container.innerHTML = `
    <div class="editorjs-editor-wrapper">
      <div id="editorjs-note-editor"></div>
    </div>
  `;

  const editorElement = container.querySelector('#editorjs-note-editor');

  // Parse content - could be JSON or empty
  let initialData = null;
  if (content) {
    try {
      initialData = JSON.parse(content);
    } catch (e) {
      // Not valid JSON - might be old HTML format
      // Will be handled by migration layer before calling this
      console.warn('Content is not valid Editor.js JSON:', e);
      initialData = { blocks: [] };
    }
  }

  // Create Editor.js instance
  editorInstance = new EditorJS({
    holder: editorElement,
    placeholder: 'Press "/" for commands...',
    autofocus: true,
    tools: {
      header: {
        class: Header,
        inlineToolbar: true,
        config: {
          levels: [1, 2, 3, 4, 5, 6],
          defaultLevel: 2
        },
        shortcut: 'CMD+SHIFT+H',
        tunes: ['alignmentTune']
      },
      list: {
        class: NestedList,
        inlineToolbar: true,
        config: {
          defaultStyle: 'unordered'
        },
        shortcut: 'CMD+SHIFT+L'
      },
      checklist: {
        class: Checklist,
        inlineToolbar: true,
        shortcut: 'CMD+SHIFT+C'
      },
      quote: {
        class: Quote,
        inlineToolbar: true,
        config: {
          quotePlaceholder: 'Enter a quote',
          captionPlaceholder: 'Quote author'
        },
        shortcut: 'CMD+SHIFT+Q'
      },
      code: {
        class: CodeTool,
        shortcut: 'CMD+SHIFT+P'
      },
      delimiter: {
        class: Delimiter,
        shortcut: 'CMD+SHIFT+D'
      },
      inlineCode: {
        class: InlineCode,
        shortcut: 'CMD+SHIFT+M'
      },
      marker: {
        class: Marker,
        shortcut: 'CMD+SHIFT+H'
      },
      // New block tools
      table: {
        class: Table,
        inlineToolbar: true,
        config: {
          rows: 2,
          cols: 3
        }
      },
      linkTool: {
        class: LinkTool,
        config: {
          endpoint: '' // No backend, just stores URL metadata
        }
      },
      embed: {
        class: Embed,
        config: {
          services: {
            youtube: true,
            vimeo: true,
            twitter: true,
            codepen: true,
            github: true
          }
        }
      },
      warning: {
        class: Warning,
        inlineToolbar: true,
        config: {
          titlePlaceholder: 'Title',
          messagePlaceholder: 'Message'
        }
      },
      toggle: {
        class: Toggle,
        inlineToolbar: true
      },
      // New inline tools
      underline: {
        class: Underline
      },
      strikethrough: {
        class: Strikethrough
      },
      Color: {
        class: ColorPlugin,
        config: {
          colorCollections: [
            '#FF1300', '#EC7878', '#9C27B0', '#673AB7',
            '#3F51B5', '#0070FF', '#03A9F4', '#00BCD4',
            '#4CAF50', '#8BC34A', '#CDDC39', '#FFFFFF'
          ],
          defaultColor: '#FF1300',
          type: 'text'
        }
      },
      Marker: {
        class: ColorPlugin,
        config: {
          defaultColor: '#FFBF00',
          type: 'marker'
        }
      },
      // Alignment block tune
      alignmentTune: {
        class: AlignmentTune
      }
    },
    tunes: ['alignmentTune'],
    data: initialData || { blocks: [] },
    onChange: async () => {
      // Debounced auto-save
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
      autoSaveTimeout = setTimeout(() => {
        triggerAutoSave();
      }, AUTOSAVE_DELAY);
    },
    onReady: () => {
      // Initialize undo/redo functionality
      new Undo({ editor: editorInstance });
      console.log('Editor.js is ready with undo/redo');
    }
  });

  return editorInstance;
}

/**
 * Trigger auto-save for note editor
 */
async function triggerAutoSave() {
  if (!editorInstance || !autoSaveCallback) return;

  try {
    const data = await editorInstance.save();
    const jsonContent = JSON.stringify(data);
    autoSaveCallback(jsonContent);
  } catch (error) {
    console.error('Failed to save editor content:', error);
  }
}

/**
 * Destroy note editor instance
 */
export function destroyNoteEditor() {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
  if (editorInstance) {
    editorInstance.destroy();
    editorInstance = null;
  }
  autoSaveCallback = null;
}

/**
 * Get current editor content as JSON string
 * @returns {Promise<string>} JSON string of Editor.js data
 */
export async function getContent() {
  if (!editorInstance) return '';

  try {
    const data = await editorInstance.save();
    return JSON.stringify(data);
  } catch (error) {
    console.error('Failed to get editor content:', error);
    return '';
  }
}

/**
 * Check if editor is currently active
 */
export function isEditorActive() {
  return editorInstance !== null;
}

// ========================================
// Exports
// ========================================

export default {
  loadEditorJs,
  initNoteEditor,
  destroyNoteEditor,
  getContent,
  isEditorActive
};
