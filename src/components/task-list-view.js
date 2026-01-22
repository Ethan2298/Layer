/**
 * Task List View Component
 *
 * Main view for displaying a task list with hierarchical tasks.
 * Supports:
 * - Task completion (with cascading to children)
 * - Task expand/collapse
 * - Inline editing of task names
 * - Adding/deleting tasks
 */

import * as Repository from '../data/repository.js';
import * as TabState from '../state/tab-state.js';
import * as TaskHelpers from '../utils/task-helpers.js';
import * as TaskListSortable from './task-list-sortable.js';
import { setupInlineEdit } from '../utils/inline-edit.js';

let currentTaskListId = null;
let currentTasks = [];

/**
 * Render the task list view
 * @param {HTMLElement} container - Container element
 * @param {Object} taskList - Task list object
 */
export async function renderTaskListView(container, taskList) {
  currentTaskListId = taskList.id;

  // Load tasks for this list
  currentTasks = await Repository.loadTasksForList(taskList.id);

  // Build task tree
  const taskTree = TaskHelpers.buildTaskTree(currentTasks);

  // Render header (editable name)
  const headerHtml = `
    <div class="task-list-header">
      <h1 contenteditable="true" spellcheck="true" class="task-list-name" data-task-list-id="${taskList.id}">${escapeHtml(taskList.name)}</h1>
      <button class="add-task-btn primary-btn">Add Task</button>
    </div>
  `;

  // Render task tree
  const tasksHtml = '<div class="tasks-container sortable-container">' + renderTaskTree(taskTree, 0) + '</div>';

  container.innerHTML = headerHtml + tasksHtml;

  // Wire event handlers
  wireEventHandlers(container, taskList);

  // Setup inline editing for task list name
  const taskListNameEl = container.querySelector('.task-list-name');
  if (taskListNameEl) {
    setupInlineEdit(taskListNameEl, {
      onSave: async (newValue) => {
        taskList.name = newValue;
        await Repository.saveTaskList(taskList);
        // Update in app state
        const taskLists = window.Layer?.AppState?.getTaskLists() || [];
        const tl = taskLists.find(t => t.id === taskList.id);
        if (tl) tl.name = newValue;
        // Update side list
        window.Layer?.renderSideList?.();
      },
      restoreOnEmpty: true,
      placeholder: 'Untitled Task List'
    });
  }

  // Setup inline editing for all task names
  container.querySelectorAll('.task-name').forEach(taskNameEl => {
    const taskId = taskNameEl.dataset.taskId;
    const task = currentTasks.find(t => t.id === taskId);
    if (task) {
      setupInlineEdit(taskNameEl, {
        onSave: async (newValue) => {
          task.name = newValue;
          await Repository.saveTask(task);
        },
        restoreOnEmpty: true,
        placeholder: 'Untitled Task'
      });
    }
  });

  // Initialize sortable drag-drop
  const tasksContainer = container.querySelector('.tasks-container');
  if (tasksContainer) {
    TaskListSortable.setRenderCallback(() => refreshView(container));
    TaskListSortable.setCurrentTasks(currentTasks);
    TaskListSortable.initSortable(tasksContainer);
  }
}

/**
 * Render task tree recursively
 * @param {Array} tasks - Tasks to render
 * @param {number} depth - Current depth level
 * @returns {string} HTML string
 */
function renderTaskTree(tasks, depth) {
  if (!tasks || tasks.length === 0) {
    if (depth === 0) {
      return '<div class="empty-message">No tasks yet. Click "Add Task" to create one.</div>';
    }
    return '';
  }

  return tasks.map(task => {
    const isExpanded = TabState.isTaskExpanded(task.id);
    const hasChildren = task.children && task.children.length > 0;
    const indent = depth * 24; // 24px per level
    const completedClass = task.completed ? 'completed' : '';

    let html = `
      <div class="task-item ${completedClass}"
           data-task-id="${task.id}"
           data-type="task"
           data-parent-task-id="${task.parentTaskId || ''}"
           data-sortable="true"
           data-depth="${depth}"
           style="padding-left: ${indent}px">
        ${hasChildren ? `
          <button class="task-toggle" title="${isExpanded ? 'Collapse' : 'Expand'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              ${isExpanded
                ? '<polyline points="6 9 12 15 18 9"></polyline>'
                : '<polyline points="9 18 15 12 9 6"></polyline>'}
            </svg>
          </button>
        ` : '<span class="task-spacer"></span>'}
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        <span contenteditable="true" spellcheck="true" class="task-name" data-task-id="${task.id}">${escapeHtml(task.name)}</span>
        <button class="add-subtask-btn" title="Add subtask">+</button>
        <button class="delete-task-btn" title="Delete task">×</button>
      </div>
    `;

    // Recursively render children if expanded
    if (hasChildren && isExpanded) {
      html += renderTaskTree(task.children, depth + 1);
    }

    return html;
  }).join('');
}

/**
 * Wire up event handlers
 * @param {HTMLElement} container - Container element
 * @param {Object} taskList - Task list object
 */
function wireEventHandlers(container, taskList) {
  // Note: Inline editing for names is handled by setupInlineEdit in renderTaskListView

  // Checkbox toggle
  container.addEventListener('change', async (e) => {
    if (e.target.classList.contains('task-checkbox')) {
      const taskId = e.target.closest('.task-item').dataset.taskId;
      await handleTaskToggle(taskId, e.target.checked);
    }
  });

  // Expand/collapse toggle
  container.addEventListener('click', async (e) => {
    if (e.target.closest('.task-toggle')) {
      const taskId = e.target.closest('.task-item').dataset.taskId;
      TabState.toggleTask(taskId);
      await refreshView(container);
    }
  });

  // Add root-level task
  container.addEventListener('click', async (e) => {
    if (e.target.classList.contains('add-task-btn')) {
      await handleAddTask(null); // null = root level
      await refreshView(container);
    }
  });

  // Add subtask
  container.addEventListener('click', async (e) => {
    if (e.target.classList.contains('add-subtask-btn')) {
      const parentTaskId = e.target.closest('.task-item').dataset.taskId;
      await handleAddTask(parentTaskId);
      // Expand parent automatically
      TabState.expandTask(parentTaskId);
      await refreshView(container);
    }
  });

  // Delete task
  container.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-task-btn')) {
      const taskId = e.target.closest('.task-item').dataset.taskId;
      await handleDeleteTask(taskId);
      await refreshView(container);
    }
  });
}


/**
 * Handle task completion toggle
 * @param {string} taskId - Task ID
 * @param {boolean} completed - New completion state
 */
async function handleTaskToggle(taskId, completed) {
  try {
    // Get all tasks that need to be updated (parent + descendants if completing)
    const toUpdate = TaskHelpers.cascadeCompletion(taskId, currentTasks, completed);

    // Update all tasks
    const promises = toUpdate.map(id =>
      Repository.updateTaskCompletion(id, completed)
    );
    await Promise.all(promises);

    console.log(`Updated ${toUpdate.length} tasks to ${completed ? 'completed' : 'incomplete'}`);

    // Reload tasks
    currentTasks = await Repository.loadTasksForList(currentTaskListId);

    // Re-render
    const container = document.querySelector('.content-view');
    if (container) {
      const taskLists = window.Layer?.AppState?.getTaskLists() || [];
      const taskList = taskLists.find(tl => tl.id === currentTaskListId);
      if (taskList) {
        await renderTaskListView(container, taskList);
      }
    }
  } catch (err) {
    console.error('Failed to toggle task:', err);
  }
}

/**
 * Handle adding a new task
 * @param {string|null} parentTaskId - Parent task ID or null for root
 */
async function handleAddTask(parentTaskId) {
  try {
    const newTask = Repository.createTask('New Task', currentTaskListId, parentTaskId);
    const saved = await Repository.saveTask(newTask);
    console.log('Created task:', saved.id);

    // Reload tasks
    currentTasks = await Repository.loadTasksForList(currentTaskListId);
  } catch (err) {
    console.error('Failed to add task:', err);
  }
}

/**
 * Handle deleting a task
 * @param {string} taskId - Task ID
 */
async function handleDeleteTask(taskId) {
  const task = currentTasks.find(t => t.id === taskId);
  const hasChildren = currentTasks.some(t => t.parentTaskId === taskId);

  const confirmMsg = hasChildren
    ? 'Delete this task and all subtasks?'
    : 'Delete this task?';

  if (confirm(confirmMsg)) {
    try {
      await Repository.deleteTask(taskId);
      console.log('Deleted task:', taskId);

      // Reload tasks
      currentTasks = await Repository.loadTasksForList(currentTaskListId);
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  }
}

/**
 * Refresh the current view
 * @param {HTMLElement} container - Container element
 */
async function refreshView(container) {
  // Reload current tasks
  currentTasks = await Repository.loadTasksForList(currentTaskListId);

  // Get task list
  const taskLists = window.Layer?.AppState?.getTaskLists() || [];
  const taskList = taskLists.find(tl => tl.id === currentTaskListId);

  if (taskList) {
    // Build task tree
    const taskTree = TaskHelpers.buildTaskTree(currentTasks);

    // Re-render tasks
    const tasksContainer = container.querySelector('.tasks-container');
    if (tasksContainer) {
      tasksContainer.innerHTML = renderTaskTree(taskTree, 0);
    }

    // Setup inline editing for all newly rendered task names
    container.querySelectorAll('.task-name').forEach(taskNameEl => {
      const taskId = taskNameEl.dataset.taskId;
      const task = currentTasks.find(t => t.id === taskId);
      if (task) {
        setupInlineEdit(taskNameEl, {
          onSave: async (newValue) => {
            task.name = newValue;
            await Repository.saveTask(task);
          },
          restoreOnEmpty: true,
          placeholder: 'Untitled Task'
        });
      }
    });

    // Update sortable with new task data
    TaskListSortable.setCurrentTasks(currentTasks);
    TaskListSortable.refreshSortable();
  }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default {
  renderTaskListView
};
