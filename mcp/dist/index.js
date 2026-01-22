#!/usr/bin/env node
/**
 * Layer MCP Server
 *
 * Read-only MCP server for accessing Layer goal tracking data.
 * Provides tools to list and view objectives, priorities, and steps.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
// Supabase configuration (matches main app)
const SUPABASE_URL = "https://uajcwhcfrcqqpgvvfrpz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhamN3aGNmcmNxcXBndnZmcnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjg2MDYsImV4cCI6MjA4MzY0NDYwNn0.1K6ttNixMSs_QW-_UiWmlB56AXxxt1W2oZKm_ewzxnI";
// Supabase client
let supabase = null;
function getClient() {
    if (!supabase) {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabase;
}
// Data access functions
async function loadAllObjectives() {
    const client = getClient();
    const { data, error } = await client
        .from("objectives")
        .select("*")
        .order("created_at", { ascending: true });
    if (error) {
        throw new Error(`Failed to load objectives: ${error.message}`);
    }
    return (data || []).map((row) => ({
        id: row.id,
        name: row.name || "",
        description: row.description || "",
        priorities: row.priorities || [],
        steps: row.steps || [],
        nextStep: row.next_step || null,
        folderId: row.folder_id || null,
        orderIndex: row.order_index || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));
}
async function getObjectiveById(id) {
    const client = getClient();
    const { data, error } = await client
        .from("objectives")
        .select("*")
        .eq("id", id)
        .single();
    if (error) {
        if (error.code === "PGRST116") {
            return null; // Not found
        }
        throw new Error(`Failed to load objective: ${error.message}`);
    }
    return {
        id: data.id,
        name: data.name || "",
        description: data.description || "",
        priorities: data.priorities || [],
        steps: data.steps || [],
        nextStep: data.next_step || null,
        folderId: data.folder_id || null,
        orderIndex: data.order_index || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}
async function createNewObjective(name, description, folderId = null) {
    const client = getClient();
    const now = new Date().toISOString();
    const { data, error } = await client
        .from("objectives")
        .insert({
        name,
        description,
        priorities: [],
        steps: [],
        next_step: null,
        folder_id: folderId,
        order_index: 0,
        created_at: now,
        updated_at: now,
    })
        .select()
        .single();
    if (error) {
        throw new Error(`Failed to create objective: ${error.message}`);
    }
    return {
        id: data.id,
        name: data.name,
        description: data.description || "",
        priorities: [],
        steps: [],
        nextStep: null,
        folderId: data.folder_id || null,
        orderIndex: data.order_index || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}
async function saveObjective(objective) {
    const client = getClient();
    const { error } = await client
        .from("objectives")
        .update({
        name: objective.name,
        description: objective.description,
        priorities: objective.priorities,
        steps: objective.steps,
        next_step: objective.nextStep,
        folder_id: objective.folderId,
        order_index: objective.orderIndex,
        updated_at: new Date().toISOString(),
    })
        .eq("id", objective.id);
    if (error) {
        throw new Error(`Failed to save objective: ${error.message}`);
    }
}
// ========================================
// Note Data Access Functions
// ========================================
async function loadAllNotes() {
    const client = getClient();
    const { data, error } = await client
        .from("notes")
        .select("*")
        .order("order_index", { ascending: true });
    if (error) {
        throw new Error(`Failed to load notes: ${error.message}`);
    }
    return (data || []).map((row) => ({
        id: row.id,
        name: row.name || "",
        content: row.content || "",
        folderId: row.folder_id || null,
        orderIndex: row.order_index || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));
}
async function getNoteById(id) {
    const client = getClient();
    const { data, error } = await client
        .from("notes")
        .select("*")
        .eq("id", id)
        .single();
    if (error) {
        if (error.code === "PGRST116") {
            return null;
        }
        throw new Error(`Failed to load note: ${error.message}`);
    }
    return {
        id: data.id,
        name: data.name || "",
        content: data.content || "",
        folderId: data.folder_id || null,
        orderIndex: data.order_index || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}
async function createNewNote(name, content, folderId = null) {
    const client = getClient();
    const now = new Date().toISOString();
    const { data, error } = await client
        .from("notes")
        .insert({
        name,
        content,
        folder_id: folderId,
        order_index: 0,
        updated_at: now,
    })
        .select()
        .single();
    if (error) {
        throw new Error(`Failed to create note: ${error.message}`);
    }
    return {
        id: data.id,
        name: data.name || "",
        content: data.content || "",
        folderId: data.folder_id || null,
        orderIndex: data.order_index || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}
async function saveNote(note) {
    const client = getClient();
    const { error } = await client
        .from("notes")
        .update({
        name: note.name,
        content: note.content,
        folder_id: note.folderId,
        order_index: note.orderIndex,
        updated_at: new Date().toISOString(),
    })
        .eq("id", note.id);
    if (error) {
        throw new Error(`Failed to save note: ${error.message}`);
    }
}
async function deleteNoteById(id) {
    const client = getClient();
    const { error } = await client
        .from("notes")
        .delete()
        .eq("id", id);
    if (error) {
        throw new Error(`Failed to delete note: ${error.message}`);
    }
}
// ========================================
// Folder Data Access Functions
// ========================================
async function loadAllFolders() {
    const client = getClient();
    const { data, error } = await client
        .from("folders")
        .select("*")
        .order("order_index", { ascending: true });
    if (error) {
        throw new Error(`Failed to load folders: ${error.message}`);
    }
    return (data || []).map((row) => ({
        id: row.id,
        name: row.name || "",
        parentId: row.parent_id || null,
        orderIndex: row.order_index || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));
}
async function getFolderById(id) {
    const client = getClient();
    const { data, error } = await client
        .from("folders")
        .select("*")
        .eq("id", id)
        .single();
    if (error) {
        if (error.code === "PGRST116") {
            return null;
        }
        throw new Error(`Failed to load folder: ${error.message}`);
    }
    return {
        id: data.id,
        name: data.name || "",
        parentId: data.parent_id || null,
        orderIndex: data.order_index || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}
async function createNewFolder(name, parentId = null) {
    const client = getClient();
    const now = new Date().toISOString();
    const { data, error } = await client
        .from("folders")
        .insert({
        name,
        parent_id: parentId,
        order_index: 0,
        updated_at: now,
    })
        .select()
        .single();
    if (error) {
        throw new Error(`Failed to create folder: ${error.message}`);
    }
    return {
        id: data.id,
        name: data.name || "",
        parentId: data.parent_id || null,
        orderIndex: data.order_index || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}
async function saveFolder(folder) {
    const client = getClient();
    const { error } = await client
        .from("folders")
        .update({
        name: folder.name,
        parent_id: folder.parentId,
        order_index: folder.orderIndex,
        updated_at: new Date().toISOString(),
    })
        .eq("id", folder.id);
    if (error) {
        throw new Error(`Failed to save folder: ${error.message}`);
    }
}
async function deleteFolderById(id) {
    const client = getClient();
    // First, unfile all items in this folder (set folder_id to null)
    await client.from("objectives").update({ folder_id: null }).eq("folder_id", id);
    await client.from("notes").update({ folder_id: null }).eq("folder_id", id);
    // Move child folders to root (set parent_id to null)
    await client.from("folders").update({ parent_id: null }).eq("parent_id", id);
    // Now delete the folder
    const { error } = await client
        .from("folders")
        .delete()
        .eq("id", id);
    if (error) {
        throw new Error(`Failed to delete folder: ${error.message}`);
    }
}
// Helper functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
function formatDuration(seconds) {
    if (seconds < 60)
        return `${seconds}s`;
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
// Create MCP server
const server = new McpServer({
    name: "layer-mcp-server",
    version: "1.0.0",
});
// Input schemas
const ListObjectivesSchema = z.object({
    include_steps: z.boolean()
        .default(false)
        .describe("Include step details in the response"),
}).strict();
const GetObjectiveSchema = z.object({
    id: z.string()
        .min(1, "Objective ID is required")
        .describe("The UUID of the objective to retrieve"),
}).strict();
// Register tools
server.registerTool("layer_list_objectives", {
    title: "List Objectives",
    description: `List all objectives in Layer with summary information.

Returns a list of all objectives including their name, description,
number of priorities, number of steps, and active step if any.

Args:
  - include_steps (boolean): Include step details in response (default: false)

Returns:
  Array of objectives with:
  - id: Objective UUID
  - name: Objective title
  - description: Objective description
  - priorityCount: Number of priorities
  - stepCount: Number of logged steps
  - totalTimeSpent: Total elapsed time across all steps
  - nextStep: Current in-progress step (if any)
  - steps: Array of steps (if include_steps is true)`,
    inputSchema: ListObjectivesSchema,
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const objectives = await loadAllObjectives();
        const result = objectives.map((obj) => {
            const totalTime = obj.steps.reduce((sum, s) => sum + (s.elapsed || 0), 0);
            const summary = {
                id: obj.id,
                name: obj.name,
                description: obj.description,
                priorityCount: obj.priorities.length,
                stepCount: obj.steps.length,
                totalTimeSpent: formatDuration(totalTime),
                nextStep: obj.nextStep ? obj.nextStep.text : null,
            };
            if (params.include_steps) {
                summary.steps = obj.steps;
            }
            return summary;
        });
        const output = {
            count: result.length,
            objectives: result,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
        };
    }
});
server.registerTool("layer_get_objective", {
    title: "Get Objective",
    description: `Get full details of a single objective by ID.

Returns complete objective data including all priorities and steps.

Args:
  - id (string): The UUID of the objective

Returns:
  Complete objective with:
  - id, name, description
  - createdAt, updatedAt timestamps
  - priorities: Array of {id, name, description}
  - steps: Array of {id, name, status, elapsed, loggedAt, completedAt}
  - nextStep: Current in-progress step (if any)
  - stats: Summary statistics (totalTime, completedSteps, etc.)`,
    inputSchema: GetObjectiveSchema,
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const objective = await getObjectiveById(params.id);
        if (!objective) {
            return {
                content: [{
                        type: "text",
                        text: `Error: Objective not found with ID '${params.id}'`
                    }],
            };
        }
        const totalTime = objective.steps.reduce((sum, s) => sum + (s.elapsed || 0), 0);
        const completedSteps = objective.steps.filter((s) => s.status === "completed").length;
        const output = {
            ...objective,
            stats: {
                totalTimeSpent: formatDuration(totalTime),
                totalTimeSeconds: totalTime,
                totalSteps: objective.steps.length,
                completedSteps,
                pendingSteps: objective.steps.length - completedSteps,
                priorityCount: objective.priorities.length,
            },
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
        };
    }
});
server.registerTool("layer_get_stats", {
    title: "Get Statistics",
    description: `Get aggregate statistics across all objectives.

Returns summary metrics about your objectives, priorities, and time tracking.

Returns:
  - totalObjectives: Number of objectives
  - totalPriorities: Sum of priorities across all objectives
  - totalSteps: Sum of all logged steps
  - totalTimeSpent: Formatted total time
  - objectivesByActivity: Objectives sorted by recent activity`,
    inputSchema: z.object({}).strict(),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async () => {
    try {
        const objectives = await loadAllObjectives();
        let totalPriorities = 0;
        let totalSteps = 0;
        let totalTime = 0;
        for (const obj of objectives) {
            totalPriorities += obj.priorities.length;
            totalSteps += obj.steps.length;
            totalTime += obj.steps.reduce((sum, s) => sum + (s.elapsed || 0), 0);
        }
        // Sort by most recently updated
        const byActivity = [...objectives]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 5)
            .map((obj) => ({
            id: obj.id,
            name: obj.name,
            updatedAt: obj.updatedAt,
            hasActiveStep: obj.nextStep !== null,
        }));
        const output = {
            totalObjectives: objectives.length,
            totalPriorities,
            totalSteps,
            totalTimeSpent: formatDuration(totalTime),
            totalTimeSeconds: totalTime,
            recentlyActive: byActivity,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
        };
    }
});
// ========================================
// Write Tools
// ========================================
// Create Objective
server.registerTool("layer_create_objective", {
    title: "Create Objective",
    description: `Create a new objective.

Args:
  - name (string): The name/title of the objective
  - description (string, optional): Detailed description

Returns:
  The newly created objective with its generated ID`,
    inputSchema: z.object({
        name: z.string().min(1, "Name is required").describe("The name of the objective"),
        description: z.string().default("").describe("Optional description"),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const objective = await createNewObjective(params.name, params.description);
        return {
            content: [{ type: "text", text: JSON.stringify(objective, null, 2) }],
            structuredContent: objective,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
        };
    }
});
// Update Objective
server.registerTool("layer_update_objective", {
    title: "Update Objective",
    description: `Update an objective's name and/or description.

Args:
  - id (string): The objective UUID
  - name (string, optional): New name
  - description (string, optional): New description

Returns:
  The updated objective`,
    inputSchema: z.object({
        id: z.string().min(1, "Objective ID is required"),
        name: z.string().optional().describe("New name"),
        description: z.string().optional().describe("New description"),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const objective = await getObjectiveById(params.id);
        if (!objective) {
            return { content: [{ type: "text", text: `Error: Objective not found` }] };
        }
        if (params.name !== undefined)
            objective.name = params.name;
        if (params.description !== undefined)
            objective.description = params.description;
        await saveObjective(objective);
        return {
            content: [{ type: "text", text: JSON.stringify(objective, null, 2) }],
            structuredContent: objective,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }] };
    }
});
// Set Next Step
server.registerTool("layer_set_next_step", {
    title: "Set Next Step",
    description: `Set or clear the next step for an objective.

Args:
  - objective_id (string): The objective UUID
  - text (string): The next step text. Pass empty string to clear.

Returns:
  The updated objective`,
    inputSchema: z.object({
        objective_id: z.string().min(1, "Objective ID is required"),
        text: z.string().describe("Next step text (empty to clear)"),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const objective = await getObjectiveById(params.objective_id);
        if (!objective) {
            return { content: [{ type: "text", text: `Error: Objective not found` }] };
        }
        if (params.text === "") {
            objective.nextStep = null;
        }
        else {
            objective.nextStep = {
                text: params.text,
                elapsedSeconds: objective.nextStep?.elapsedSeconds || 0,
            };
        }
        await saveObjective(objective);
        return {
            content: [{ type: "text", text: JSON.stringify(objective, null, 2) }],
            structuredContent: objective,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }] };
    }
});
// Add Step
server.registerTool("layer_add_step", {
    title: "Add Step",
    description: `Add a new step to an objective.

Args:
  - objective_id (string): The objective UUID
  - name (string): The step name/description
  - status (string, optional): pending, paused, or completed (default: pending)

Returns:
  The updated objective with the new step`,
    inputSchema: z.object({
        objective_id: z.string().min(1, "Objective ID is required"),
        name: z.string().min(1, "Step name is required"),
        status: z.enum(["pending", "paused", "completed"]).default("pending"),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const objective = await getObjectiveById(params.objective_id);
        if (!objective) {
            return { content: [{ type: "text", text: `Error: Objective not found` }] };
        }
        const now = new Date().toISOString();
        const newStep = {
            id: generateId(),
            name: params.name,
            loggedAt: now,
            orderNumber: objective.steps.length + 1,
            status: params.status,
            elapsed: 0,
            startedAt: null,
            completedAt: params.status === "completed" ? now : null,
        };
        objective.steps.push(newStep);
        await saveObjective(objective);
        return {
            content: [{ type: "text", text: JSON.stringify({ step: newStep, objective }, null, 2) }],
            structuredContent: { step: newStep, objective },
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }] };
    }
});
// Update Step
server.registerTool("layer_update_step", {
    title: "Update Step",
    description: `Update a step's name or status.

Args:
  - objective_id (string): The objective UUID
  - step_id (string): The step ID
  - name (string, optional): New name
  - status (string, optional): pending, paused, or completed

Returns:
  The updated objective`,
    inputSchema: z.object({
        objective_id: z.string().min(1, "Objective ID is required"),
        step_id: z.string().min(1, "Step ID is required"),
        name: z.string().optional(),
        status: z.enum(["pending", "paused", "completed"]).optional(),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const objective = await getObjectiveById(params.objective_id);
        if (!objective) {
            return { content: [{ type: "text", text: `Error: Objective not found` }] };
        }
        const step = objective.steps.find((s) => s.id === params.step_id);
        if (!step) {
            return { content: [{ type: "text", text: `Error: Step not found` }] };
        }
        if (params.name !== undefined)
            step.name = params.name;
        if (params.status !== undefined) {
            step.status = params.status;
            if (params.status === "completed" && !step.completedAt) {
                step.completedAt = new Date().toISOString();
            }
        }
        await saveObjective(objective);
        return {
            content: [{ type: "text", text: JSON.stringify({ step, objective }, null, 2) }],
            structuredContent: { step, objective },
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }] };
    }
});
// Delete Step
server.registerTool("layer_delete_step", {
    title: "Delete Step",
    description: `Remove a step from an objective.

Args:
  - objective_id (string): The objective UUID
  - step_id (string): The step ID to delete

Returns:
  The updated objective`,
    inputSchema: z.object({
        objective_id: z.string().min(1, "Objective ID is required"),
        step_id: z.string().min(1, "Step ID is required"),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const objective = await getObjectiveById(params.objective_id);
        if (!objective) {
            return { content: [{ type: "text", text: `Error: Objective not found` }] };
        }
        const stepIndex = objective.steps.findIndex((s) => s.id === params.step_id);
        if (stepIndex === -1) {
            return { content: [{ type: "text", text: `Error: Step not found` }] };
        }
        objective.steps.splice(stepIndex, 1);
        // Renumber remaining steps
        objective.steps.forEach((s, i) => (s.orderNumber = i + 1));
        await saveObjective(objective);
        return {
            content: [{ type: "text", text: JSON.stringify(objective, null, 2) }],
            structuredContent: objective,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }] };
    }
});
// Add Priority
server.registerTool("layer_add_priority", {
    title: "Add Priority",
    description: `Add a new priority to an objective.

Args:
  - objective_id (string): The objective UUID
  - name (string): The priority name
  - description (string, optional): Priority description

Returns:
  The updated objective with the new priority`,
    inputSchema: z.object({
        objective_id: z.string().min(1, "Objective ID is required"),
        name: z.string().min(1, "Priority name is required"),
        description: z.string().default(""),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const objective = await getObjectiveById(params.objective_id);
        if (!objective) {
            return { content: [{ type: "text", text: `Error: Objective not found` }] };
        }
        const newPriority = {
            id: generateId(),
            name: params.name,
            description: params.description,
        };
        objective.priorities.push(newPriority);
        await saveObjective(objective);
        return {
            content: [{ type: "text", text: JSON.stringify({ priority: newPriority, objective }, null, 2) }],
            structuredContent: { priority: newPriority, objective },
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }] };
    }
});
// Update Priority
server.registerTool("layer_update_priority", {
    title: "Update Priority",
    description: `Update a priority's name or description.

Args:
  - objective_id (string): The objective UUID
  - priority_id (string): The priority ID
  - name (string, optional): New name
  - description (string, optional): New description

Returns:
  The updated objective`,
    inputSchema: z.object({
        objective_id: z.string().min(1, "Objective ID is required"),
        priority_id: z.string().min(1, "Priority ID is required"),
        name: z.string().optional(),
        description: z.string().optional(),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const objective = await getObjectiveById(params.objective_id);
        if (!objective) {
            return { content: [{ type: "text", text: `Error: Objective not found` }] };
        }
        const priority = objective.priorities.find((p) => p.id === params.priority_id);
        if (!priority) {
            return { content: [{ type: "text", text: `Error: Priority not found` }] };
        }
        if (params.name !== undefined)
            priority.name = params.name;
        if (params.description !== undefined)
            priority.description = params.description;
        await saveObjective(objective);
        return {
            content: [{ type: "text", text: JSON.stringify({ priority, objective }, null, 2) }],
            structuredContent: { priority, objective },
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }] };
    }
});
// Delete Priority
server.registerTool("layer_delete_priority", {
    title: "Delete Priority",
    description: `Remove a priority from an objective.

Args:
  - objective_id (string): The objective UUID
  - priority_id (string): The priority ID to delete

Returns:
  The updated objective`,
    inputSchema: z.object({
        objective_id: z.string().min(1, "Objective ID is required"),
        priority_id: z.string().min(1, "Priority ID is required"),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const objective = await getObjectiveById(params.objective_id);
        if (!objective) {
            return { content: [{ type: "text", text: `Error: Objective not found` }] };
        }
        const priorityIndex = objective.priorities.findIndex((p) => p.id === params.priority_id);
        if (priorityIndex === -1) {
            return { content: [{ type: "text", text: `Error: Priority not found` }] };
        }
        objective.priorities.splice(priorityIndex, 1);
        await saveObjective(objective);
        return {
            content: [{ type: "text", text: JSON.stringify(objective, null, 2) }],
            structuredContent: objective,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }] };
    }
});
// ========================================
// Note Tools
// ========================================
server.registerTool("layer_list_notes", {
    title: "List Notes",
    description: `List all notes in Layer with summary information.

Returns a list of all notes including their name and folder.

Args:
  - folder_id (string, optional): Filter by folder ID. Use "null" for unfiled notes.
  - include_content (boolean): Include note content in response (default: false)

Returns:
  Array of notes with id, name, folderId, orderIndex, timestamps`,
    inputSchema: z.object({
        folder_id: z.string().optional().describe("Filter by folder ID. Use 'null' for unfiled notes."),
        include_content: z.boolean().default(false).describe("Include note content in response"),
    }).strict(),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        let notes = await loadAllNotes();
        // Filter by folder if specified
        if (params.folder_id !== undefined) {
            const targetFolderId = params.folder_id === "null" ? null : params.folder_id;
            notes = notes.filter((n) => n.folderId === targetFolderId);
        }
        const result = notes.map((note) => {
            const summary = {
                id: note.id,
                name: note.name,
                folderId: note.folderId,
                orderIndex: note.orderIndex,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt,
            };
            if (params.include_content) {
                summary.content = note.content;
            }
            return summary;
        });
        const output = {
            count: result.length,
            notes: result,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
        };
    }
});
server.registerTool("layer_get_note", {
    title: "Get Note",
    description: `Get full details of a single note by ID.

Returns complete note data including content.

Args:
  - id (string): The UUID of the note

Returns:
  Complete note with id, name, content, folderId, orderIndex, timestamps`,
    inputSchema: z.object({
        id: z.string().min(1, "Note ID is required").describe("The UUID of the note to retrieve"),
    }).strict(),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const note = await getNoteById(params.id);
        if (!note) {
            return {
                content: [{
                        type: "text",
                        text: `Error: Note not found with ID '${params.id}'`
                    }],
            };
        }
        return {
            content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
            structuredContent: note,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
        };
    }
});
server.registerTool("layer_create_note", {
    title: "Create Note",
    description: `Create a new note.

Args:
  - name (string): The name/title of the note
  - content (string, optional): Note content (HTML)
  - folder_id (string, optional): Folder to place the note in

Returns:
  The newly created note with its generated ID`,
    inputSchema: z.object({
        name: z.string().min(1, "Name is required").describe("The name of the note"),
        content: z.string().default("").describe("Note content (HTML)"),
        folder_id: z.string().nullable().optional().describe("Folder ID to place the note in"),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const note = await createNewNote(params.name, params.content, params.folder_id || null);
        return {
            content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
            structuredContent: note,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
        };
    }
});
server.registerTool("layer_update_note", {
    title: "Update Note",
    description: `Update a note's name and/or content.

Args:
  - id (string): The note UUID
  - name (string, optional): New name
  - content (string, optional): New content (HTML)

Returns:
  The updated note`,
    inputSchema: z.object({
        id: z.string().min(1, "Note ID is required"),
        name: z.string().optional().describe("New name"),
        content: z.string().optional().describe("New content (HTML)"),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const note = await getNoteById(params.id);
        if (!note) {
            return { content: [{ type: "text", text: `Error: Note not found` }] };
        }
        if (params.name !== undefined)
            note.name = params.name;
        if (params.content !== undefined)
            note.content = params.content;
        await saveNote(note);
        return {
            content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
            structuredContent: note,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }] };
    }
});
server.registerTool("layer_delete_note", {
    title: "Delete Note",
    description: `Delete a note.

Args:
  - id (string): The note UUID to delete

Returns:
  Confirmation of deletion`,
    inputSchema: z.object({
        id: z.string().min(1, "Note ID is required"),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const note = await getNoteById(params.id);
        if (!note) {
            return { content: [{ type: "text", text: `Error: Note not found` }] };
        }
        await deleteNoteById(params.id);
        return {
            content: [{ type: "text", text: JSON.stringify({ deleted: true, id: params.id }, null, 2) }],
            structuredContent: { deleted: true, id: params.id },
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }] };
    }
});
// ========================================
// Folder Tools
// ========================================
server.registerTool("layer_list_folders", {
    title: "List Folders",
    description: `List all folders in Layer with hierarchy information.

Returns a list of all folders including their parent-child relationships.

Returns:
  Array of folders with id, name, parentId, orderIndex, timestamps`,
    inputSchema: z.object({}).strict(),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async () => {
    try {
        const folders = await loadAllFolders();
        const output = {
            count: folders.length,
            folders: folders,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
        };
    }
});
server.registerTool("layer_get_folder", {
    title: "Get Folder",
    description: `Get folder details with optional contents.

Args:
  - id (string): The folder UUID
  - include_contents (boolean): Include objectives and notes in the folder (default: false)

Returns:
  Folder with optional contents (objectives, notes, child folders)`,
    inputSchema: z.object({
        id: z.string().min(1, "Folder ID is required"),
        include_contents: z.boolean().default(false).describe("Include folder contents"),
    }).strict(),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const folder = await getFolderById(params.id);
        if (!folder) {
            return {
                content: [{
                        type: "text",
                        text: `Error: Folder not found with ID '${params.id}'`
                    }],
            };
        }
        const output = { ...folder };
        if (params.include_contents) {
            const [objectives, notes, folders] = await Promise.all([
                loadAllObjectives(),
                loadAllNotes(),
                loadAllFolders(),
            ]);
            output.objectives = objectives.filter((o) => o.folderId === params.id).map((o) => ({
                id: o.id,
                name: o.name,
                description: o.description,
                orderIndex: o.orderIndex,
            }));
            output.notes = notes.filter((n) => n.folderId === params.id).map((n) => ({
                id: n.id,
                name: n.name,
                orderIndex: n.orderIndex,
            }));
            output.childFolders = folders.filter((f) => f.parentId === params.id).map((f) => ({
                id: f.id,
                name: f.name,
                orderIndex: f.orderIndex,
            }));
        }
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
        };
    }
});
server.registerTool("layer_create_folder", {
    title: "Create Folder",
    description: `Create a new folder.

Args:
  - name (string): The folder name
  - parent_id (string, optional): Parent folder ID for nesting

Returns:
  The newly created folder with its generated ID`,
    inputSchema: z.object({
        name: z.string().min(1, "Name is required").describe("The folder name"),
        parent_id: z.string().nullable().optional().describe("Parent folder ID for nesting"),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const folder = await createNewFolder(params.name, params.parent_id || null);
        return {
            content: [{ type: "text", text: JSON.stringify(folder, null, 2) }],
            structuredContent: folder,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
        };
    }
});
server.registerTool("layer_update_folder", {
    title: "Update Folder",
    description: `Update a folder's name.

Args:
  - id (string): The folder UUID
  - name (string, optional): New name

Returns:
  The updated folder`,
    inputSchema: z.object({
        id: z.string().min(1, "Folder ID is required"),
        name: z.string().optional().describe("New name"),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const folder = await getFolderById(params.id);
        if (!folder) {
            return { content: [{ type: "text", text: `Error: Folder not found` }] };
        }
        if (params.name !== undefined)
            folder.name = params.name;
        await saveFolder(folder);
        return {
            content: [{ type: "text", text: JSON.stringify(folder, null, 2) }],
            structuredContent: folder,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }] };
    }
});
server.registerTool("layer_delete_folder", {
    title: "Delete Folder",
    description: `Delete a folder. Contents (objectives/notes) become unfiled. Child folders move to root.

Args:
  - id (string): The folder UUID to delete

Returns:
  Confirmation of deletion`,
    inputSchema: z.object({
        id: z.string().min(1, "Folder ID is required"),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const folder = await getFolderById(params.id);
        if (!folder) {
            return { content: [{ type: "text", text: `Error: Folder not found` }] };
        }
        await deleteFolderById(params.id);
        return {
            content: [{ type: "text", text: JSON.stringify({ deleted: true, id: params.id }, null, 2) }],
            structuredContent: { deleted: true, id: params.id },
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }] };
    }
});
// ========================================
// Hierarchy/Arrangement Tools
// ========================================
server.registerTool("layer_move_item", {
    title: "Move Item",
    description: `Move any item (objective/note/folder) to a new folder and/or reorder.

Args:
  - item_type (string): Type of item: "objective", "note", or "folder"
  - item_id (string): The item's UUID
  - target_folder_id (string, optional): Target folder ID. Use null for root/unfiled.
  - order_index (number, optional): Position within the folder

Returns:
  The updated item`,
    inputSchema: z.object({
        item_type: z.enum(["objective", "note", "folder"]).describe("Type of item to move"),
        item_id: z.string().min(1, "Item ID is required"),
        target_folder_id: z.string().nullable().optional().describe("Target folder ID, null for root/unfiled"),
        order_index: z.number().optional().describe("Position within the folder"),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const client = getClient();
        const targetFolderId = params.target_folder_id === undefined ? undefined : params.target_folder_id;
        if (params.item_type === "objective") {
            const objective = await getObjectiveById(params.item_id);
            if (!objective) {
                return { content: [{ type: "text", text: `Error: Objective not found` }] };
            }
            if (targetFolderId !== undefined)
                objective.folderId = targetFolderId;
            if (params.order_index !== undefined)
                objective.orderIndex = params.order_index;
            await saveObjective(objective);
            return {
                content: [{ type: "text", text: JSON.stringify(objective, null, 2) }],
                structuredContent: objective,
            };
        }
        else if (params.item_type === "note") {
            const note = await getNoteById(params.item_id);
            if (!note) {
                return { content: [{ type: "text", text: `Error: Note not found` }] };
            }
            if (targetFolderId !== undefined)
                note.folderId = targetFolderId;
            if (params.order_index !== undefined)
                note.orderIndex = params.order_index;
            await saveNote(note);
            return {
                content: [{ type: "text", text: JSON.stringify(note, null, 2) }],
                structuredContent: note,
            };
        }
        else if (params.item_type === "folder") {
            const folder = await getFolderById(params.item_id);
            if (!folder) {
                return { content: [{ type: "text", text: `Error: Folder not found` }] };
            }
            // Prevent moving folder into itself or its descendants
            if (targetFolderId === params.item_id) {
                return { content: [{ type: "text", text: `Error: Cannot move folder into itself` }] };
            }
            if (targetFolderId !== undefined)
                folder.parentId = targetFolderId;
            if (params.order_index !== undefined)
                folder.orderIndex = params.order_index;
            await saveFolder(folder);
            return {
                content: [{ type: "text", text: JSON.stringify(folder, null, 2) }],
                structuredContent: folder,
            };
        }
        return { content: [{ type: "text", text: `Error: Invalid item type` }] };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }] };
    }
});
server.registerTool("layer_get_hierarchy", {
    title: "Get Hierarchy",
    description: `Get complete tree structure of all items in one call.

Args:
  - include_note_content (boolean): Include note content (default: false)
  - include_objective_steps (boolean): Include objective steps (default: false)

Returns:
  Nested structure with root items and folder contents`,
    inputSchema: z.object({
        include_note_content: z.boolean().default(false).describe("Include note content"),
        include_objective_steps: z.boolean().default(false).describe("Include objective steps"),
    }).strict(),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const [objectives, notes, folders] = await Promise.all([
            loadAllObjectives(),
            loadAllNotes(),
            loadAllFolders(),
        ]);
        // Build folder tree
        const folderMap = new Map();
        // Initialize all folders
        for (const folder of folders) {
            folderMap.set(folder.id, {
                id: folder.id,
                type: "folder",
                name: folder.name,
                parentId: folder.parentId,
                orderIndex: folder.orderIndex,
                children: [],
            });
        }
        // Helper to format objective
        const formatObjective = (o) => {
            const obj = {
                id: o.id,
                type: "objective",
                name: o.name,
                description: o.description,
                folderId: o.folderId,
                orderIndex: o.orderIndex,
                priorityCount: o.priorities.length,
                stepCount: o.steps.length,
                nextStep: o.nextStep?.text || null,
            };
            if (params.include_objective_steps) {
                obj.steps = o.steps;
                obj.priorities = o.priorities;
            }
            return obj;
        };
        // Helper to format note
        const formatNote = (n) => {
            const note = {
                id: n.id,
                type: "note",
                name: n.name,
                folderId: n.folderId,
                orderIndex: n.orderIndex,
            };
            if (params.include_note_content) {
                note.content = n.content;
            }
            return note;
        };
        // Root items (no folder)
        const rootItems = [];
        // Add objectives to folders or root
        for (const obj of objectives) {
            const formatted = formatObjective(obj);
            if (obj.folderId && folderMap.has(obj.folderId)) {
                folderMap.get(obj.folderId).children.push(formatted);
            }
            else {
                rootItems.push(formatted);
            }
        }
        // Add notes to folders or root
        for (const note of notes) {
            const formatted = formatNote(note);
            if (note.folderId && folderMap.has(note.folderId)) {
                folderMap.get(note.folderId).children.push(formatted);
            }
            else {
                rootItems.push(formatted);
            }
        }
        // Build folder hierarchy - nest child folders
        const rootFolders = [];
        for (const folder of folders) {
            const folderNode = folderMap.get(folder.id);
            if (folder.parentId && folderMap.has(folder.parentId)) {
                folderMap.get(folder.parentId).children.push(folderNode);
            }
            else {
                rootFolders.push(folderNode);
            }
        }
        // Sort items by orderIndex
        const sortByOrder = (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0);
        rootItems.sort(sortByOrder);
        rootFolders.sort(sortByOrder);
        // Sort children within each folder
        for (const folder of folderMap.values()) {
            folder.children.sort(sortByOrder);
        }
        const output = {
            rootItems,
            rootFolders,
            stats: {
                totalObjectives: objectives.length,
                totalNotes: notes.length,
                totalFolders: folders.length,
            },
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
        };
    }
});
server.registerTool("layer_reorder_items", {
    title: "Reorder Items",
    description: `Batch reorder items within a folder.

Args:
  - folder_id (string, optional): Folder ID, or null for root/unfiled items
  - item_order (array): Array of {item_type, item_id, order_index}

Returns:
  Confirmation with updated items`,
    inputSchema: z.object({
        folder_id: z.string().nullable().optional().describe("Folder ID, null for root/unfiled"),
        item_order: z.array(z.object({
            item_type: z.enum(["objective", "note", "folder"]),
            item_id: z.string(),
            order_index: z.number(),
        })).describe("Array of items with new order indices"),
    }).strict(),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
}, async (params) => {
    try {
        const results = [];
        for (const item of params.item_order) {
            try {
                if (item.item_type === "objective") {
                    const objective = await getObjectiveById(item.item_id);
                    if (objective) {
                        objective.orderIndex = item.order_index;
                        await saveObjective(objective);
                        results.push({ ...item, success: true });
                    }
                    else {
                        results.push({ ...item, success: false });
                    }
                }
                else if (item.item_type === "note") {
                    const note = await getNoteById(item.item_id);
                    if (note) {
                        note.orderIndex = item.order_index;
                        await saveNote(note);
                        results.push({ ...item, success: true });
                    }
                    else {
                        results.push({ ...item, success: false });
                    }
                }
                else if (item.item_type === "folder") {
                    const folder = await getFolderById(item.item_id);
                    if (folder) {
                        folder.orderIndex = item.order_index;
                        await saveFolder(folder);
                        results.push({ ...item, success: true });
                    }
                    else {
                        results.push({ ...item, success: false });
                    }
                }
            }
            catch {
                results.push({ ...item, success: false });
            }
        }
        const output = {
            reordered: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            results,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }] };
    }
});
// Run server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Layer MCP server running via stdio");
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
