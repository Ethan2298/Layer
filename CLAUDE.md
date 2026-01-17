# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Objectiv.go is a web-based goal/objective tracking application. It has two modes:
- **Web App**: Static web application served via `npx serve`
- **Terminal TUI**: blessed-based terminal interface (separate app)

## Commands

```bash
npm start          # Run web app (serves static files)
npm run dev        # Run web app in dev mode
npm run terminal   # Run terminal TUI (life.js)
```

No test or lint commands are currently configured.

## Architecture

### Dual Entry Points

1. **Web App** (`index.html` → `src/app.js`)
   - Static web application using ES modules
   - Supabase backend for data persistence
   - Real-time sync via Supabase subscriptions

2. **Terminal TUI** (`life.js` with `lib/data.js` + `lib/ui.js`)
   - blessed-based interface with Dreams→Goals→Projects→Tasks hierarchy
   - Data stored in `life.json` (separate from web app)

### Frontend Modules (src/)

All frontend code uses ES modules. Entry point `src/app.js` wires everything together.

**Note:** `window.Objectiv` exposes modules globally for use by inline scripts in `index.html`. This is a migration artifact - future work should move inline scripts to ES modules.

- **Data Layer** (`data/`)
  - `repository.js` - CRUD operations with in-memory cache, factory functions (`createObjective`, `createPriority`, `createStep`)
  - `supabase-storage.js` - Supabase persistence for objectives
  - `folder-storage.js` - Supabase persistence for folders

- **State** (`state/`)
  - `side-list-state.js` - Navigation state, folder expansion, selection

- **Controllers** (`controllers/`)
  - `edit-controller.js` - Unified edit/add operations with data mutations

- **Components** (`components/`)
  - `list-item.js` - Reusable list row component
  - `folder-explorer.js` - Folder picker integration

- **Root Modules** (`src/`)
  - `constants.js` - Centralized constants (Section, StepStatus, EditMode)
  - `config.js` - External service configuration (Supabase)

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
