---
id: task-16
title: Refactor monolithic frontend architecture for separation of concerns
status: In Progress
assignee: []
created_date: '2026-01-10 05:33'
updated_date: '2026-01-10 05:51'
labels:
  - refactoring
  - architecture
  - tech-debt
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deep architecture analysis revealed significant technical debt in the codebase. The index.html contains ~2873 lines with 8+ distinct concerns mixed together. This refactoring will dramatically improve maintainability while preserving the app's minimalist philosophy.

## Problem Summary
- **Monolithic HTML**: 2200+ lines of JS handling data, state, rendering, events, and business logic
- **Duplicated data layer**: `lib/data.js` (Node) and `index.html` (browser) have separate implementations
- **State spaghetti**: 10+ module-level variables with unclear ownership and legacy remnants
- **Dead code**: ~200 lines of unused functions from previous architecture iterations
- **Incomplete abstraction**: `createListItem` pattern exists but inconsistently applied

## Approach
Use ES modules (native browser support) with no build step - keeping ~5 focused modules to match the app's simplicity philosophy.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CSS extracted to separate file (styles.css)
- [x] #2 Dead/legacy code removed (~200 lines): currentView, navigationStack, selectedIndex, keyboardMode, renderObjectivesList, renderObjectiveDetail, handleSelect, handleBack, showObjectives, showObjectiveDetail, duplicate updateStatusBar
- [ ] #3 Unified data layer module shared between Electron and browser modes
- [ ] #4 State management extracted to dedicated module with clear state machine
- [x] #5 JavaScript modularized into ES modules: data.js, state.js, render.js, events.js, clarity.js
- [ ] #6 Component abstraction extended to all list items (ObjectiveItem, PriorityItem, StepItem, AddButton)
- [ ] #7 Edit controller unified with single entry point replacing 7+ current entry points
- [ ] #8 All existing functionality preserved - no regressions
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Phase 1: Remove Dead Code (Low effort, immediate cleanup)
- [ ] Audit and remove unused variables: `currentView`, `navigationStack`, `selectedIndex`, `keyboardMode`
- [ ] Remove unused functions: `renderObjectivesList()`, `renderObjectiveDetail()`, `handleSelect()`, `handleBack()`, `showObjectives()`, `showObjectiveDetail()`, `updateHeader()`
- [ ] Remove duplicate `updateStatusBar()` definition (keep the one at bottom)
- [ ] Clean up unused state: `selectedContentIndex`, `contentSection`, `focusPane`

## Phase 2: Extract CSS (Low effort)
- [ ] Create `/src/styles.css` with all styles from index.html lines 7-598
- [ ] Link stylesheet in HTML head
- [ ] Verify styling unchanged

## Phase 3: Unify Data Layer (Medium effort)
- [ ] Create `/src/data/repository.js` with environment-agnostic interface
- [ ] Implement `load()` - file for Electron, localStorage for browser
- [ ] Implement `save()` - file for Electron, localStorage for browser
- [ ] Move shared functions: `generateId()`, `calculateProgress()`, `createItem()`
- [ ] Update `lib/data.js` to re-export from shared module (TUI compatibility)
- [ ] Remove duplicate implementations from index.html

## Phase 4: Extract State Module (Medium effort)
- [ ] Create `/src/state/store.js` with AppState object
- [ ] Define clear state shape: `{ selectedObjective, editing: { active, section, index, item } }`
- [ ] Create Actions object with state transitions: `selectObjective()`, `startEdit()`, `commitEdit()`, `cancelEdit()`
- [ ] Replace scattered state variables with store access
- [ ] Remove `skipBlurHandler` hack by proper state coordination

## Phase 5: Modularize JavaScript (Medium effort)
- [ ] Create `/src/clarity.js` - LLM clarity scoring, queue management
- [ ] Create `/src/render.js` - all render functions
- [ ] Create `/src/events.js` - keyboard, mouse, wheel handlers
- [ ] Create `/src/utils.js` - `formatTimestamp()`, `capitalize()`, `typeText()`
- [ ] Create `/src/app.js` - main entry point, imports and initializes
- [ ] Update index.html to use `<script type="module" src="/src/app.js">`

## Phase 6: Component Abstraction (Medium effort)
- [ ] Create `/src/components/list-item.js` - enhance existing `createListItem()`
- [ ] Create component factories: `ObjectiveItem()`, `PriorityItem()`, `StepItem()`, `AddButton()`
- [ ] Refactor `renderSideList()` to use `ObjectiveItem`
- [ ] Refactor `renderContentPriorities()` to use `PriorityItem`
- [ ] Refactor `renderContentSteps()` to use `StepItem`
- [ ] Ensure consistent DOM structure across all list types

## Phase 7: Unified Edit Controller (High effort)
- [ ] Create `/src/controllers/edit-controller.js`
- [ ] Implement single `EditController.start(section, index, options)` entry point
- [ ] Consolidate: `startAddObjective`, `startAddPriority`, `startLogStep`, `startEdit`, `startInlineEdit`, `startInlineEditInPlace`, `startEditInPlace`
- [ ] Implement `EditController.commit()` and `EditController.cancel()`
- [ ] Add `EditController.isEditing(section, index)` for render checks
- [ ] Remove redundant edit functions
- [ ] Wire mousedown and keyboard handlers to controller

## Target File Structure
```
/src
  /components
    list-item.js
  /controllers
    edit-controller.js
  /data
    repository.js
  /state
    store.js
  app.js
  clarity.js
  events.js
  render.js
  utils.js
  styles.css
index.html (minimal - just structure + module import)
main.js (Electron main - unchanged)
preload.js (unchanged)
```
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Key Code References

### Dead Code Locations (Phase 1)
- `currentView`, `navigationStack`: lines 1278, 1935
- `selectedIndex`, `keyboardMode`: lines 1936, 1689
- `renderObjectivesList()`: lines 1659-1714
- `renderObjectiveDetail()`: lines 1717-1853
- `handleSelect()`, `handleBack()`: lines 1909-1955
- `showObjectives()`, `showObjectiveDetail()`: lines 1933-1946
- `updateHeader()`: lines 1278-1298
- Duplicate `updateStatusBar()`: lines 1874-1892 (remove) vs 2854-2861 (keep)
- Unused state: `selectedContentIndex`, `contentSection`, `focusPane` at lines 756-758

### Current State Variables to Consolidate (Phase 4)
```javascript
// Lines 753-766 - primary state
let selectedObjectiveIndex = 0;
let promptMode = null;
let promptStep = 0;
let promptData = {};
let promptTargetIndex = -1;
let promptTargetSection = null;
let skipBlurHandler = false;

// Clarity queue state - lines 1072-1073
let clarityQueue = [];
let clarityProcessing = false;
```

### Edit Entry Points to Consolidate (Phase 7)
1. `startAddObjective()` - line 1965
2. `startAddPriority()` - line 1991
3. `startLogStep()` - line 2018
4. `startEdit()` - line 2233
5. `startInlineEdit()` - line 2199
6. `startInlineEditInPlace()` - line 2101
7. `startEditInPlace()` - line 2620

### Good Pattern to Extend (Phase 6)
The `createListItem()` function at lines 987-1046 is well-designed:
```javascript
function createListItem(options = {}) {
  const { icon, iconClass, content, contentEditable, meta, metaClass, selected, onClick, dataAttrs } = options;
  // Three-column layout: icon | content | meta
}
```

## Risk Mitigation
- Test each phase independently before moving to next
- Keep backup of working index.html before major changes
- Phase 1 (dead code removal) is safest starting point
- Phase 7 (edit controller) is highest risk - test all edit flows thoroughly

## Progress Update (Phase 1-7)

### Completed:
- **Phase 1**: Removed ~465 lines of dead code (unused variables, functions)
- **Phase 2**: Extracted CSS to src/styles.css (539 lines)
- **Phase 3**: Created src/data/repository.js (253 lines)
- **Phase 4**: Created src/state/store.js (244 lines)
- **Phase 5**: Created ES module entry point src/app.js
- **Phase 6**: Created src/components/list-item.js (107 lines)
- **Phase 7**: Created src/controllers/edit-controller.js (364 lines)

### Stats:
- index.html: 2703 -> 1648 lines (-39%)
- 8 modular files in src/ totaling ~1850 lines
- Renamed storage key: 'life-data' -> 'objectiv-data'

### Remaining:
- Wire up modules to replace inline code (gradual migration)
- Unify data layer between Electron and browser
- Full component abstraction for all list types
<!-- SECTION:NOTES:END -->
