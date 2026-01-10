---
id: task-17.1
title: 'Phase 1.1: Define Event Type System'
status: To Do
assignee: []
created_date: '2026-01-10 06:39'
labels:
  - phase-1
  - event-sourcing
  - types
dependencies: []
parent_task_id: task-17
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design and implement the complete event type system that will capture all user actions and system events.

## Event Categories

### 1. Objective Events
```typescript
interface ObjectiveEvent {
  ts: string;           // ISO timestamp
  type: 
    | "objective.created"
    | "objective.renamed"
    | "objective.description_updated"
    | "objective.selected"
    | "objective.deleted"
    | "objective.archived";
  data: {
    id: string;
    name?: string;
    from?: string;      // for renames
    to?: string;
    description?: string;
  };
}
```

### 2. Priority Events
```typescript
interface PriorityEvent {
  ts: string;
  type:
    | "priority.created"
    | "priority.renamed"
    | "priority.description_updated"
    | "priority.reordered"
    | "priority.deleted";
  data: {
    id: string;
    objectiveId: string;
    name?: string;
    from?: string;
    to?: string;
    fromIndex?: number;
    toIndex?: number;
  };
}
```

### 3. Step Events
```typescript
interface StepEvent {
  ts: string;
  type:
    | "step.created"
    | "step.renamed"
    | "step.started"
    | "step.paused"
    | "step.resumed"
    | "step.completed"
    | "step.deleted";
  data: {
    id: string;
    objectiveId: string;
    priorityId?: string;
    name?: string;
    elapsed?: number;     // ms spent on step
    duration?: number;    // total duration
  };
}
```

### 4. App Tracking Events
```typescript
interface AppEvent {
  ts: string;
  type:
    | "app.focused"
    | "app.idle_start"
    | "app.idle_end"
    | "app.session_start"
    | "app.session_end";
  data: {
    app: string;          // "VS Code", "Chrome", etc.
    bundleId?: string;    // "com.microsoft.VSCode"
    title?: string;       // Window title
    duration?: number;
    idle?: boolean;
  };
}
```

### 5. UI/Behavioral Events
```typescript
interface UIEvent {
  ts: string;
  type:
    | "ui.suggestion.generated"
    | "ui.suggestion.accepted"
    | "ui.suggestion.rejected"
    | "ui.suggestion.regenerated"
    | "ui.clarity.requested"
    | "ui.clarity.received"
    | "ui.edit.started"
    | "ui.edit.cancelled"
    | "ui.edit.committed";
  data: {
    section?: string;
    index?: number;
    text?: string;
    attempt?: number;
    score?: number;
  };
}
```

### 6. Session Events
```typescript
interface SessionEvent {
  ts: string;
  type:
    | "session.started"
    | "session.ended"
    | "session.day_changed";
  data: {
    date: string;         // YYYY-MM-DD
    duration?: number;
    eventsCount?: number;
  };
}
```

## Implementation Files

```
src/
├── events/
│   ├── types.ts          # All event type definitions
│   ├── schema.ts         # Validation schemas (zod)
│   ├── factory.ts        # Event creation helpers
│   └── index.ts          # Re-exports
```

## Event Factory Examples

```typescript
// src/events/factory.ts
export function objectiveCreated(id: string, name: string): ObjectiveEvent {
  return {
    ts: new Date().toISOString(),
    type: "objective.created",
    data: { id, name }
  };
}

export function stepStarted(id: string, objectiveId: string): StepEvent {
  return {
    ts: new Date().toISOString(),
    type: "step.started",
    data: { id, objectiveId }
  };
}
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All event types defined with TypeScript interfaces
- [ ] #2 Zod schemas for runtime validation
- [ ] #3 Factory functions for creating each event type
- [ ] #4 Events are serializable to JSON
- [ ] #5 Timestamp format is ISO 8601
- [ ] #6 Each event has unique type discriminator
<!-- AC:END -->
