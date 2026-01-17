/**
 * Content View Component
 *
 * Renders the main content area (objective details, folder view).
 */

import AppState from '../state/app-state.js';
import { formatTimestamp, formatDuration } from '../utils.js';
import { renderContentNextStep } from './next-step-timer.js';

// ========================================
// Callbacks (set by app.js)
// ========================================

let _startAddPriority = () => {};
let _startLogStep = () => {};
let _refreshClarity = () => {};

export function setCallbacks({ startAddPriority, startLogStep, refreshClarity }) {
  if (startAddPriority) _startAddPriority = startAddPriority;
  if (startLogStep) _startLogStep = startLogStep;
  if (refreshClarity) _refreshClarity = refreshClarity;
}

// ========================================
// List Item Helper
// ========================================

/**
 * Create a modular list item element
 */
function createListItem(options = {}) {
  const {
    icon = '',
    iconClass = '',
    content = '',
    contentEditable = false,
    meta = '',
    metaClass = '',
    selected = false,
    onClick = null,
    dataAttrs = {}
  } = options;

  const div = document.createElement('div');
  div.className = 'list-item' + (selected ? ' selected' : '');

  // Set data attributes
  for (const [key, value] of Object.entries(dataAttrs)) {
    div.dataset[key] = value;
  }

  // Build inner HTML with three columns
  let html = '';

  // Icon column
  const iconClasses = ['list-item-icon', iconClass].filter(Boolean).join(' ');
  html += `<span class="${iconClasses}">${icon}</span>`;

  // Content column
  const contentAttrs = contentEditable ? ' contenteditable="true" spellcheck="false"' : '';
  const escapedContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html += `<span class="list-item-content"${contentAttrs}>${escapedContent}</span>`;

  // Meta column
  if (meta) {
    const metaClasses = ['list-item-meta', metaClass].filter(Boolean).join(' ');
    html += `<span class="${metaClasses}">${meta}</span>`;
  }

  div.innerHTML = html;

  if (onClick) {
    div.onclick = onClick;
  }

  return div;
}

/**
 * Create confirm row HTML
 */
function createConfirmRow(text) {
  return `
    <div class="confirm-row">
      <div class="confirm-text">${text}</div>
      <div class="confirm-hint">[y] Yes  [n] No  [Esc] Cancel</div>
    </div>
  `;
}

// ========================================
// Main Render Functions
// ========================================

/**
 * Render the content view (selected objective, folder, or home)
 */
export function renderContentView() {
  const viewMode = AppState.getViewMode();

  if (viewMode === 'home') {
    renderHomeView();
  } else if (viewMode === 'folder') {
    renderFolderView();
  } else {
    renderObjectiveView();
  }
}

/**
 * Render home view
 */
export function renderHomeView() {
  const headerTitle = document.getElementById('content-header-title');
  const headerDesc = document.getElementById('content-header-description');
  const body = document.getElementById('content-body');

  if (!headerTitle || !body) return;

  headerTitle.textContent = 'Home';
  if (headerDesc) headerDesc.textContent = 'Welcome to Objectiv';

  const data = AppState.getData();
  const objectiveCount = data.objectives.length;
  const folderCount = data.folders.length;

  body.innerHTML = `
    <div class="home-view">
      <div class="home-stats">
        <div class="home-stat">
          <span class="home-stat-value">${objectiveCount}</span>
          <span class="home-stat-label">Objective${objectiveCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="home-stat">
          <span class="home-stat-value">${folderCount}</span>
          <span class="home-stat-label">Folder${folderCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render objective view
 */
export function renderObjectiveView() {
  const headerTitle = document.getElementById('content-header-title');
  const headerDesc = document.getElementById('content-header-description');
  const body = document.getElementById('content-body');

  if (!headerTitle || !body) return;

  const data = AppState.getData();
  let selectedIdx = AppState.getSelectedObjectiveIndex();

  if (data.objectives.length === 0) {
    headerTitle.textContent = 'No objectives yet';
    if (headerDesc) headerDesc.textContent = 'Add your first objective to get started';
    body.innerHTML = '';
    return;
  }

  // Clamp index to valid range
  if (selectedIdx < 0) {
    selectedIdx = 0;
    AppState.setSelectedObjectiveIndex(0);
  }
  if (selectedIdx >= data.objectives.length) {
    selectedIdx = data.objectives.length - 1;
    AppState.setSelectedObjectiveIndex(selectedIdx);
  }

  const obj = data.objectives[selectedIdx];
  headerTitle.textContent = obj.name;
  if (headerDesc) headerDesc.textContent = obj.description || '';

  // Render priorities, next step, and steps
  body.innerHTML = '';
  renderContentPriorities(body, obj);
  renderContentNextStep(body, obj);
  renderContentSteps(body, obj);

  // Refresh clarity scores (if enabled)
  _refreshClarity(obj);
  obj.priorities.forEach(p => _refreshClarity(p));
}

/**
 * Render folder view
 */
export function renderFolderView() {
  const SideListState = window.Objectiv?.SideListState;
  const selectedItem = SideListState?.getSelectedItem();
  const folder = selectedItem?.data;

  const headerTitle = document.getElementById('content-header-title');
  const headerDesc = document.getElementById('content-header-description');
  const body = document.getElementById('content-body');

  if (!headerTitle || !body) return;

  if (!folder) {
    headerTitle.textContent = 'Select a folder';
    if (headerDesc) headerDesc.textContent = '';
    body.innerHTML = '';
    return;
  }

  const data = AppState.getData();

  // Get objectives in this folder
  const folderObjectives = data.objectives.filter(obj => obj.folderId === folder.id);

  headerTitle.textContent = folder.name || 'Unnamed Folder';
  if (headerDesc) {
    headerDesc.textContent = folderObjectives.length === 1
      ? '1 objective'
      : `${folderObjectives.length} objectives`;
  }

  body.innerHTML = '';

  // Render objectives list
  if (folderObjectives.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'folder-empty-state';
    emptyState.style.cssText = 'color: var(--text-secondary); padding: 2rem 0; text-align: center;';
    emptyState.textContent = 'No objectives in this folder';
    body.appendChild(emptyState);
  } else {
    const header = document.createElement('div');
    header.className = 'section-header';
    header.textContent = 'OBJECTIVES';
    body.appendChild(header);

    folderObjectives.forEach((obj) => {
      const objectiveItem = document.createElement('div');
      objectiveItem.className = 'list-item folder-objective-item';
      objectiveItem.style.cssText = 'cursor: pointer;';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'list-item-content';
      nameSpan.textContent = obj.name;
      objectiveItem.appendChild(nameSpan);

      // Click to navigate to the objective
      objectiveItem.onclick = () => {
        const objIndex = data.objectives.indexOf(obj);
        if (objIndex >= 0) {
          AppState.setSelectedObjectiveIndex(objIndex);
          AppState.setViewMode('objective');

          // Update side list selection
          const flatList = SideListState.getFlatList?.() || SideListState.getItems();
          const sideListIndex = flatList.findIndex(item =>
            item.type === SideListState.ItemType.OBJECTIVE && item.objectiveId === obj.id
          );
          if (sideListIndex >= 0) {
            SideListState.setSelectedIndex(sideListIndex);
          }

          // This would trigger re-render via navigation controller
          renderContentView();

          // Handle mobile view
          const Mobile = window.Objectiv?.Mobile;
          if (AppState.isMobile() && Mobile?.setMobileView) {
            Mobile.setMobileView('detail');
          }
        }
      };

      body.appendChild(objectiveItem);
    });
  }
}

// ========================================
// Section Render Functions
// ========================================

/**
 * Render priorities section
 */
export function renderContentPriorities(container, obj) {
  const promptMode = AppState.getPromptMode();
  const promptTargetSection = AppState.getPromptTargetSection();
  const promptTargetIndex = AppState.getPromptTargetIndex();

  const header = document.createElement('div');
  header.className = 'section-header';
  header.textContent = 'PRIORITIES';
  container.appendChild(header);

  obj.priorities.forEach((priority, index) => {
    // Handle confirm mode
    if (promptMode === 'confirm' && promptTargetSection === 'priorities' && promptTargetIndex === index) {
      const div = document.createElement('div');
      div.innerHTML = createConfirmRow(`Delete "${priority.name}"?`);
      container.appendChild(div.firstElementChild);
      return;
    }

    const isAdding = promptMode === 'add' && promptTargetSection === 'priorities' && promptTargetIndex === index;
    const isEditing = promptMode === 'edit' && promptTargetSection === 'priorities' && promptTargetIndex === index;
    const isRefining = promptMode === 'refine' && promptTargetSection === 'priorities' && promptTargetIndex === index;
    const isInEditMode = isAdding || isEditing || isRefining;

    let textContent = priority.name;
    if (isRefining) textContent = priority.description || '';

    const listItem = createListItem({
      icon: '',
      iconClass: '',
      content: textContent,
      contentEditable: isInEditMode,
      meta: '',
      selected: false
    });

    // Add data attributes for edit controller
    listItem.dataset.section = 'priorities';
    listItem.dataset.index = index;

    // Add placeholder for new items
    if (isAdding) {
      const contentEl = listItem.querySelector('.list-item-content');
      if (contentEl) {
        contentEl.dataset.placeholder = 'Name your priority';
      }
    }

    container.appendChild(listItem);
  });

  // Add priority button
  if (!(promptMode === 'add' && promptTargetSection === 'priorities') && obj.priorities.length < 3) {
    const addDiv = document.createElement('div');
    addDiv.className = 'add-option';
    addDiv.innerHTML = '+ Add priority';
    addDiv.onclick = () => _startAddPriority();
    container.appendChild(addDiv);
  }
}

/**
 * Render steps section
 */
export function renderContentSteps(container, obj) {
  const promptMode = AppState.getPromptMode();
  const promptTargetSection = AppState.getPromptTargetSection();
  const promptTargetIndex = AppState.getPromptTargetIndex();

  const header = document.createElement('div');
  header.className = 'section-header';
  header.textContent = 'STEPS';
  container.appendChild(header);

  const isAddingStep = promptMode === 'add' && promptTargetSection === 'steps';

  // Add step button at top
  if (!isAddingStep) {
    const addDiv = document.createElement('div');
    addDiv.className = 'add-option';
    addDiv.innerHTML = '+ Log a step';
    addDiv.onclick = () => _startLogStep();
    container.appendChild(addDiv);
  }

  // Display steps newest-first
  for (let displayIdx = 0; displayIdx < obj.steps.length; displayIdx++) {
    const actualIdx = obj.steps.length - 1 - displayIdx;
    const step = obj.steps[actualIdx];

    if (promptMode === 'confirm' && promptTargetSection === 'steps' && promptTargetIndex === actualIdx) {
      const div = document.createElement('div');
      div.innerHTML = createConfirmRow(`Delete "${step.name}"?`);
      container.appendChild(div.firstElementChild);
      continue;
    }

    const timestamp = formatTimestamp(step.loggedAt);
    const durationStr = step.duration ? ` (${formatDuration(step.duration)})` : '';
    const orderNum = step.orderNumber || (actualIdx + 1);
    const isAdding = promptMode === 'add' && promptTargetSection === 'steps' && promptTargetIndex === actualIdx;
    const isEditing = promptMode === 'edit' && promptTargetSection === 'steps' && promptTargetIndex === actualIdx;
    const isInEditMode = isAdding || isEditing;

    const listItem = createListItem({
      icon: orderNum.toString(),
      iconClass: '',
      content: step.name,
      contentEditable: isInEditMode,
      meta: `<span class="step-timestamp">${timestamp}${durationStr}</span>`,
      metaClass: 'compact',
      selected: false
    });

    // Add data attributes
    listItem.dataset.section = 'steps';
    listItem.dataset.index = actualIdx;

    // Add placeholder for new items
    if (isAdding) {
      const contentEl = listItem.querySelector('.list-item-content');
      if (contentEl) {
        contentEl.dataset.placeholder = 'What did you do?';
      }
    }

    container.appendChild(listItem);
  }
}

// ========================================
// Hover Preview
// ========================================

/**
 * Start hover preview (shows content without changing selection)
 */
export function startHoverPreview(itemData) {
  const SideListState = window.Objectiv?.SideListState;
  const ItemType = SideListState?.ItemType || {};

  if (itemData.type !== ItemType.OBJECTIVE) {
    return;
  }

  AppState.setHoverPreviewActive(true);
  AppState.setHoverPreviewItemData(itemData);

  const data = AppState.getData();
  const obj = data.objectives[itemData.index];
  if (!obj) return;

  const headerTitle = document.getElementById('content-header-title');
  const headerDesc = document.getElementById('content-header-description');
  const body = document.getElementById('content-body');

  if (!headerTitle || !body) return;

  headerTitle.textContent = obj.name;
  if (headerDesc) headerDesc.textContent = obj.description || '';

  body.innerHTML = '';
  renderContentPriorities(body, obj);
  renderContentNextStep(body, obj);
  renderContentSteps(body, obj);
}

/**
 * End hover preview (restore selected content)
 */
export function endHoverPreview() {
  if (!AppState.isHoverPreviewActive()) return;

  AppState.setHoverPreviewActive(false);
  AppState.setHoverPreviewItemData(null);

  renderContentView();
}

// ========================================
// Default Export
// ========================================

export default {
  setCallbacks,
  renderContentView,
  renderObjectiveView,
  renderFolderView,
  renderContentPriorities,
  renderContentSteps,
  startHoverPreview,
  endHoverPreview,
  createListItem,
  createConfirmRow
};
