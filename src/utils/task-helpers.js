/**
 * Task Helpers
 *
 * Utilities for working with hierarchical tasks:
 * - Building task trees from flat arrays
 * - Finding descendants
 * - Cascading completion status
 */

/**
 * Build a hierarchical tree from flat tasks array
 * @param {Array} tasks - Flat array of tasks
 * @returns {Array} Root-level tasks with children nested
 */
export function buildTaskTree(tasks) {
  const taskMap = new Map();
  const roots = [];

  // First pass: create map
  tasks.forEach(task => {
    taskMap.set(task.id, { ...task, children: [] });
  });

  // Second pass: build hierarchy
  tasks.forEach(task => {
    const node = taskMap.get(task.id);
    if (task.parentTaskId && taskMap.has(task.parentTaskId)) {
      taskMap.get(task.parentTaskId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

/**
 * Get all descendant task IDs for a given task
 * @param {Array} tasks - Flat tasks array
 * @param {string} taskId - Parent task ID
 * @returns {Array<string>} Array of descendant IDs
 */
export function getTaskDescendants(tasks, taskId) {
  const descendants = [];
  const children = tasks.filter(t => t.parentTaskId === taskId);

  children.forEach(child => {
    descendants.push(child.id);
    descendants.push(...getTaskDescendants(tasks, child.id));
  });

  return descendants;
}

/**
 * Mark a task and all descendants as completed/incomplete
 * @param {string} taskId - Task to mark
 * @param {Array} tasks - All tasks (flat)
 * @param {boolean} completed - Target completion state
 * @returns {Array<string>} Task IDs that need to be updated
 */
export function cascadeCompletion(taskId, tasks, completed) {
  const toUpdate = [taskId];

  if (completed) {
    // When marking complete, mark all descendants complete
    toUpdate.push(...getTaskDescendants(tasks, taskId));
  }
  // When marking incomplete, only mark self (keep descendants as-is)

  return toUpdate;
}

/**
 * Check if a task is a descendant of another task (for drag-drop validation)
 * @param {Array} tasks - Flat tasks array
 * @param {string} potentialDescendantId - ID of task that might be a descendant
 * @param {string} potentialAncestorId - ID of task that might be an ancestor
 * @returns {boolean} True if potentialDescendantId is a descendant of potentialAncestorId
 */
export function isTaskDescendantOf(tasks, potentialDescendantId, potentialAncestorId) {
  if (potentialDescendantId === potentialAncestorId) return true;

  const descendants = getTaskDescendants(tasks, potentialAncestorId);
  return descendants.includes(potentialDescendantId);
}

/**
 * Flatten task tree to array (for rendering)
 * @param {Array} taskTree - Hierarchical task tree
 * @param {Set} expandedTasks - Set of expanded task IDs
 * @returns {Array} Flat array with depth metadata
 */
export function flattenTaskTree(taskTree, expandedTasks = new Set()) {
  const items = [];

  function traverse(nodes, depth = 0) {
    nodes.forEach(node => {
      const item = {
        ...node,
        depth,
        hasChildren: node.children && node.children.length > 0,
        isExpanded: expandedTasks.has(node.id)
      };

      items.push(item);

      // Recurse into expanded tasks
      if (node.children && expandedTasks.has(node.id)) {
        traverse(node.children, depth + 1);
      }
    });
  }

  traverse(taskTree);
  return items;
}

export default {
  buildTaskTree,
  getTaskDescendants,
  cascadeCompletion,
  isTaskDescendantOf,
  flattenTaskTree
};
