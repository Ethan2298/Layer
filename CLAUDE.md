# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Objectiv.go is an Electron-based goal/objective tracking application. It has two modes:
- **Desktop GUI**: Frameless Electron window with split-pane layout
- **Terminal TUI**: blessed-based terminal interface

## Commands

```bash
npm start          # Run Electron desktop app
npm run terminal   # Run terminal TUI (life.js)
```

No test or lint commands are currently configured.

## Architecture

### Dual Entry Points

1. **Electron App** (`main.js` → `index.html` → `src/app.js`)
   - Frameless window with custom titlebar
   - Groq LLM integration for clarity scoring (requires `GROQ_API_KEY` in `.env`)
   - IPC handlers for filesystem operations via `preload.js`

2. **Terminal TUI** (`life.js` with `lib/data.js` + `lib/ui.js`)
   - blessed-based interface with Dreams→Goals→Projects→Tasks hierarchy
   - Data stored in `life.json`

### Frontend Modules (src/)

All frontend code uses ES modules. Entry point `src/app.js` wires everything together and exposes `window.Objectiv` for legacy compatibility.

- **Data Layer** (`data/`)
  - `repository.js` - CRUD operations with in-memory cache, factory functions (`createObjective`, `createPriority`, `createStep`)
  - `markdown-storage.js` - Persists objectives as .md files in user-selected folder
  - `markdown-format.js` - Serialization/deserialization

- **State** (`state/`)
  - `store.js` - Centralized state: selected index, edit mode, clarity queue
  - `side-list-state.js` - Navigation state for sidebar

- **Components** (`components/`)
  - `list-item.js` - Reusable list row component
  - `folder-explorer.js` - Folder picker integration

- **Controllers** (`controllers/`)
  - `edit-controller.js` - Edit mode logic

### Data Model

```
Objective
├── name, description, clarityScore
├── priorities[] (name, description)
└── steps[] (name, status, elapsed, orderNumber)
```

Step status lifecycle: `pending` → `active` → `paused` → `completed` (active is runtime-only, never persisted)

### Clarity Scoring

Uses Groq LLM to rate objectives 0-100:
- 0-40: fuzzy
- 41-60: less fuzzy
- 61-80: clear
- 81-100: very clear

## Design Philosophy

"Ergonomic Minimalism" - see `backlog/docs/doc-1` for details:
- Dual-purpose elements (e.g., step number becomes drag handle on hover)
- Progressive disclosure (UI reveals through interaction)
- Transformation over addition

<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management activities.

**CRITICAL GUIDANCE**

- If your client supports MCP resources, read `backlog://workflow/overview` to understand when and how to use Backlog for this project.
- If your client only supports tools or the above request fails, call `backlog.get_workflow_overview()` tool to load the tool-oriented overview (it lists the matching guide tools).

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:
- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and completion
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->
