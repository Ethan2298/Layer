/**
 * Task List Storage Module
 *
 * Supabase CRUD operations for task lists and tasks.
 * Task lists are top-level items (like notes/objectives), tasks are nested within them.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

let supabase = null;

// Track recently saved IDs to ignore our own realtime updates
const recentlySavedTaskListIds = new Set();
const recentlySavedTaskIds = new Set();
const RECENT_SAVE_EXPIRY_MS = 2000; // Ignore realtime updates for 2 seconds after local save

/**
 * Check if a task list was recently saved locally (to ignore our own realtime updates)
 * @param {string} taskListId - Task list ID to check
 * @returns {boolean} True if this task list was saved locally recently
 */
export function wasRecentlySavedLocally(taskListId) {
  return recentlySavedTaskListIds.has(taskListId);
}

/**
 * Initialize the Supabase client
 */
function initClient() {
  if (supabase) return supabase;

  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
  } catch (err) {
    console.error('Failed to initialize Supabase for task lists:', err);
    return null;
  }
}

// ========================================
// Task List Operations
// ========================================

/**
 * Load all task lists from Supabase
 * @returns {Promise<Array>} Array of task list objects
 */
export async function loadAllTaskLists() {
  const client = initClient();

  if (!client) {
    console.log('Supabase not available for task lists');
    return [];
  }

  try {
    const { data, error } = await client
      .from('task_lists')
      .select('*')
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Failed to load task lists:', error);
      return [];
    }

    // Transform database rows to app format
    const taskLists = data.map(row => ({
      id: row.id,
      name: row.name || '',
      folderId: row.folder_id || null,
      orderIndex: row.order_index || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    console.log(`Loaded ${taskLists.length} task lists from Supabase`);
    return taskLists;

  } catch (err) {
    console.error('Error loading task lists:', err);
    return [];
  }
}

/**
 * Save a task list (insert or update)
 * @param {Object} taskList - Task list data
 * @returns {Promise<Object>} Saved task list with ID
 */
export async function saveTaskList(taskList) {
  const client = initClient();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const record = {
    name: taskList.name || '',
    folder_id: taskList.folderId || null,
    order_index: taskList.orderIndex || 0,
    updated_at: new Date().toISOString()
  };

  // Check if this is an existing record
  if (taskList.id) {
    // Update existing record
    record.id = taskList.id;

    const { data, error } = await client
      .from('task_lists')
      .upsert(record)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save task list: ${error.message}`);
    }

    console.log('Updated task list:', data.id);

    // Track this save to ignore our own realtime updates
    recentlySavedTaskListIds.add(data.id);
    setTimeout(() => recentlySavedTaskListIds.delete(data.id), RECENT_SAVE_EXPIRY_MS);

    return {
      id: data.id,
      name: data.name,
      folderId: data.folder_id,
      orderIndex: data.order_index,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

  } else {
    // New task list - let Supabase generate UUID
    const { data, error } = await client
      .from('task_lists')
      .insert(record)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create task list: ${error.message}`);
    }

    console.log('Created task list:', data.id);

    // Track this save to ignore our own realtime updates
    recentlySavedTaskListIds.add(data.id);
    setTimeout(() => recentlySavedTaskListIds.delete(data.id), RECENT_SAVE_EXPIRY_MS);

    return {
      id: data.id,
      name: data.name,
      folderId: data.folder_id,
      orderIndex: data.order_index,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
}

/**
 * Delete a task list (CASCADE deletes all tasks)
 * @param {string} taskListId - Task list ID to delete
 */
export async function deleteTaskList(taskListId) {
  const client = initClient();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { error } = await client
    .from('task_lists')
    .delete()
    .eq('id', taskListId);

  if (error) {
    throw new Error(`Failed to delete task list: ${error.message}`);
  }

  console.log('Deleted task list:', taskListId);
}

/**
 * Update a task list's order index and optionally folder
 * @param {string} id - Task list ID
 * @param {number} orderIndex - New order index
 * @param {string|null} folderId - Optional folder ID to move to
 */
export async function updateTaskListOrder(id, orderIndex, folderId = undefined) {
  const client = initClient();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const record = {
    order_index: orderIndex,
    updated_at: new Date().toISOString()
  };

  // Only update folder_id if explicitly provided
  if (folderId !== undefined) {
    record.folder_id = folderId;
  }

  const { error } = await client
    .from('task_lists')
    .update(record)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update task list order: ${error.message}`);
  }

  console.log('Updated task list order:', id, 'to index', orderIndex);
}

/**
 * Subscribe to realtime changes on the task_lists table
 * @param {Function} onChangeCallback - Called with payload when changes occur
 * @returns {Object|null} Subscription object
 */
export function subscribeToTaskListChanges(onChangeCallback) {
  const client = initClient();
  if (!client) {
    console.warn('Cannot subscribe: Supabase client not available');
    return null;
  }

  const subscription = client
    .channel('task-lists-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'task_lists' },
      (payload) => {
        console.log('Task list realtime change:', payload.eventType, payload);
        onChangeCallback(payload);
      }
    )
    .subscribe((status) => {
      console.log('Task lists realtime subscription status:', status);
    });

  return subscription;
}

// ========================================
// Task Operations
// ========================================

/**
 * Load all tasks for a specific task list
 * @param {string} taskListId - Task list ID
 * @returns {Promise<Array>} Array of task objects
 */
export async function loadTasksForList(taskListId) {
  const client = initClient();

  if (!client) {
    console.log('Supabase not available for tasks');
    return [];
  }

  try {
    const { data, error } = await client
      .from('tasks')
      .select('*')
      .eq('task_list_id', taskListId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Failed to load tasks:', error);
      return [];
    }

    // Transform database rows to app format
    const tasks = data.map(row => ({
      id: row.id,
      taskListId: row.task_list_id,
      parentTaskId: row.parent_task_id || null,
      name: row.name || '',
      completed: row.completed || false,
      orderIndex: row.order_index || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    console.log(`Loaded ${tasks.length} tasks for list ${taskListId}`);
    return tasks;

  } catch (err) {
    console.error('Error loading tasks:', err);
    return [];
  }
}

/**
 * Save a task (insert or update)
 * @param {Object} task - Task data
 * @returns {Promise<Object>} Saved task with ID
 */
export async function saveTask(task) {
  const client = initClient();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const record = {
    task_list_id: task.taskListId,
    parent_task_id: task.parentTaskId || null,
    name: task.name || '',
    completed: task.completed || false,
    order_index: task.orderIndex || 0,
    updated_at: new Date().toISOString()
  };

  // Check if this is an existing record
  if (task.id) {
    // Update existing record
    record.id = task.id;

    const { data, error } = await client
      .from('tasks')
      .upsert(record)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save task: ${error.message}`);
    }

    console.log('Updated task:', data.id);

    // Track this save to ignore our own realtime updates
    recentlySavedTaskIds.add(data.id);
    setTimeout(() => recentlySavedTaskIds.delete(data.id), RECENT_SAVE_EXPIRY_MS);

    return {
      id: data.id,
      taskListId: data.task_list_id,
      parentTaskId: data.parent_task_id,
      name: data.name,
      completed: data.completed,
      orderIndex: data.order_index,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

  } else {
    // New task - let Supabase generate UUID
    const { data, error } = await client
      .from('tasks')
      .insert(record)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    console.log('Created task:', data.id);

    // Track this save to ignore our own realtime updates
    recentlySavedTaskIds.add(data.id);
    setTimeout(() => recentlySavedTaskIds.delete(data.id), RECENT_SAVE_EXPIRY_MS);

    return {
      id: data.id,
      taskListId: data.task_list_id,
      parentTaskId: data.parent_task_id,
      name: data.name,
      completed: data.completed,
      orderIndex: data.order_index,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
}

/**
 * Delete a task (CASCADE deletes children)
 * @param {string} taskId - Task ID to delete
 */
export async function deleteTask(taskId) {
  const client = initClient();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { error } = await client
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    throw new Error(`Failed to delete task: ${error.message}`);
  }

  console.log('Deleted task:', taskId);
}

/**
 * Update a task's order index and optionally parent
 * @param {string} taskId - Task ID
 * @param {number} orderIndex - New order index
 * @param {string|null} parentTaskId - Optional parent task ID
 */
export async function updateTaskOrder(taskId, orderIndex, parentTaskId = undefined) {
  const client = initClient();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const record = {
    order_index: orderIndex,
    updated_at: new Date().toISOString()
  };

  // Only update parent_task_id if explicitly provided
  if (parentTaskId !== undefined) {
    record.parent_task_id = parentTaskId;
  }

  const { error } = await client
    .from('tasks')
    .update(record)
    .eq('id', taskId);

  if (error) {
    throw new Error(`Failed to update task order: ${error.message}`);
  }

  console.log('Updated task order:', taskId, 'to index', orderIndex);
}

/**
 * Update a task's completion status
 * @param {string} taskId - Task ID
 * @param {boolean} completed - Completion state
 */
export async function updateTaskCompletion(taskId, completed) {
  const client = initClient();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { error } = await client
    .from('tasks')
    .update({
      completed,
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId);

  if (error) {
    throw new Error(`Failed to update task completion: ${error.message}`);
  }

  console.log('Updated task completion:', taskId, completed);
}

/**
 * Subscribe to realtime changes on the tasks table
 * @param {Function} onChangeCallback - Called with payload when changes occur
 * @returns {Object|null} Subscription object
 */
export function subscribeToTaskChanges(onChangeCallback) {
  const client = initClient();
  if (!client) {
    console.warn('Cannot subscribe: Supabase client not available');
    return null;
  }

  const subscription = client
    .channel('tasks-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      (payload) => {
        console.log('Task realtime change:', payload.eventType, payload);
        onChangeCallback(payload);
      }
    )
    .subscribe((status) => {
      console.log('Tasks realtime subscription status:', status);
    });

  return subscription;
}

// ========================================
// Exports
// ========================================

export default {
  // Task List operations
  loadAllTaskLists,
  saveTaskList,
  deleteTaskList,
  updateTaskListOrder,
  subscribeToTaskListChanges,
  wasRecentlySavedLocally,

  // Task operations
  loadTasksForList,
  saveTask,
  deleteTask,
  updateTaskOrder,
  updateTaskCompletion,
  subscribeToTaskChanges
};
