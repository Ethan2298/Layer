---
id: task-17.4
title: 'Phase 1.4: Implement Projections (State from Events)'
status: To Do
assignee: []
created_date: '2026-01-10 06:41'
labels:
  - phase-1
  - event-sourcing
  - state-management
dependencies:
  - task-17.2
parent_task_id: task-17
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the projection system that computes current state from event history.

## Core Concept

Events are the source of truth. Current state is *derived*, not stored.

```
EVENTS (append-only)              PROJECTIONS (computed)
─────────────────────────────────────────────────────────
objective.created {id: "a"}   →   objectives: [{id: "a", name: "..."}]
objective.renamed {id: "a"}   →   
step.created {...}            →   
step.completed {...}          →   
```

## Projector Class

```typescript
// src/events/projector.ts

export interface AppState {
  objectives: Objective[];
  selectedObjectiveIndex: number;
  inbox: InboxItem[];
  settings: Settings;
  lastUpdated: string;
}

export class Projector {
  private state: AppState;
  
  constructor() {
    this.state = this.getInitialState();
  }
  
  /**
   * Apply an event to update state
   */
  apply(event: AnyEvent): void {
    switch (event.type) {
      // Objective events
      case 'objective.created':
        this.state.objectives.push({
          id: event.data.id,
          name: event.data.name || '',
          description: '',
          priorities: [],
          steps: [],
          createdAt: event.ts
        });
        break;
        
      case 'objective.renamed':
        const obj = this.findObjective(event.data.id);
        if (obj) obj.name = event.data.to;
        break;
        
      case 'objective.description_updated':
        const objDesc = this.findObjective(event.data.id);
        if (objDesc) objDesc.description = event.data.description;
        break;
        
      case 'objective.deleted':
        this.state.objectives = this.state.objectives.filter(
          o => o.id !== event.data.id
        );
        break;
        
      case 'objective.selected':
        this.state.selectedObjectiveIndex = this.state.objectives.findIndex(
          o => o.id === event.data.id
        );
        break;
      
      // Priority events
      case 'priority.created':
        const objP = this.findObjective(event.data.objectiveId);
        if (objP) {
          objP.priorities.push({
            id: event.data.id,
            name: event.data.name || '',
            description: '',
            createdAt: event.ts
          });
        }
        break;
        
      case 'priority.renamed':
        const priority = this.findPriority(event.data.objectiveId, event.data.id);
        if (priority) priority.name = event.data.to;
        break;
        
      case 'priority.deleted':
        const objPD = this.findObjective(event.data.objectiveId);
        if (objPD) {
          objPD.priorities = objPD.priorities.filter(p => p.id !== event.data.id);
        }
        break;
      
      // Step events
      case 'step.created':
        const objS = this.findObjective(event.data.objectiveId);
        if (objS) {
          objS.steps.push({
            id: event.data.id,
            name: event.data.name || '',
            status: 'pending',
            createdAt: event.ts,
            orderNumber: objS.steps.length + 1
          });
        }
        break;
        
      case 'step.started':
        const stepS = this.findStep(event.data.objectiveId, event.data.id);
        if (stepS) {
          stepS.status = 'active';
          stepS.startedAt = event.ts;
        }
        break;
        
      case 'step.completed':
        const stepC = this.findStep(event.data.objectiveId, event.data.id);
        if (stepC) {
          stepC.status = 'completed';
          stepC.completedAt = event.ts;
          stepC.duration = event.data.duration;
        }
        break;
        
      case 'step.deleted':
        const objSD = this.findObjective(event.data.objectiveId);
        if (objSD) {
          objSD.steps = objSD.steps.filter(s => s.id !== event.data.id);
        }
        break;
    }
    
    this.state.lastUpdated = event.ts;
  }
  
  /**
   * Apply multiple events
   */
  applyBatch(events: AnyEvent[]): void {
    for (const event of events) {
      this.apply(event);
    }
  }
  
  /**
   * Rebuild state from all events
   */
  async rebuild(eventStore: EventStore): Promise<AppState> {
    this.state = this.getInitialState();
    
    for await (const event of eventStore.streamEvents()) {
      this.apply(event);
    }
    
    return this.state;
  }
  
  /**
   * Get current state (immutable copy)
   */
  getState(): AppState {
    return JSON.parse(JSON.stringify(this.state));
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: AppState) => void): () => void {
    // Implementation with event emitter
  }
  
  private findObjective(id: string): Objective | undefined {
    return this.state.objectives.find(o => o.id === id);
  }
  
  private findPriority(objectiveId: string, priorityId: string): Priority | undefined {
    const obj = this.findObjective(objectiveId);
    return obj?.priorities.find(p => p.id === priorityId);
  }
  
  private findStep(objectiveId: string, stepId: string): Step | undefined {
    const obj = this.findObjective(objectiveId);
    return obj?.steps.find(s => s.id === stepId);
  }
  
  private getInitialState(): AppState {
    return {
      objectives: [],
      selectedObjectiveIndex: 0,
      inbox: [],
      settings: {},
      lastUpdated: new Date().toISOString()
    };
  }
}
```

## Snapshot Optimization

For fast startup, periodically snapshot the projected state:

```typescript
// src/events/snapshot.ts

export class SnapshotManager {
  /**
   * Save current state as snapshot
   */
  async saveSnapshot(state: AppState, vaultPath: string): Promise<void> {
    const snapshotPath = path.join(vaultPath, 'snapshots', `${Date.now()}.json`);
    await fs.writeJSON(snapshotPath, {
      state,
      timestamp: new Date().toISOString(),
      eventCount: await this.countEvents()
    });
  }
  
  /**
   * Load latest snapshot
   */
  async loadLatestSnapshot(vaultPath: string): Promise<SnapshotData | null> {
    const snapshotsDir = path.join(vaultPath, 'snapshots');
    const files = await fs.readdir(snapshotsDir);
    const latest = files.sort().pop();
    if (!latest) return null;
    return fs.readJSON(path.join(snapshotsDir, latest));
  }
  
  /**
   * Restore from snapshot + replay newer events
   */
  async restore(projector: Projector, eventStore: EventStore, vaultPath: string): Promise<void> {
    const snapshot = await this.loadLatestSnapshot(vaultPath);
    
    if (snapshot) {
      projector.setState(snapshot.state);
      
      // Replay events after snapshot
      for await (const event of eventStore.streamEvents(snapshot.timestamp)) {
        projector.apply(event);
      }
    } else {
      // Full rebuild
      await projector.rebuild(eventStore);
    }
  }
}
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Projector class that applies events to build state
- [ ] #2 Handles all event types (objectives, priorities, steps)
- [ ] #3 Snapshot system for fast startup
- [ ] #4 Rebuild capability from full event history
- [ ] #5 Immutable state access via getState()
- [ ] #6 Subscription system for reactive updates
- [ ] #7 Less than 1 second startup with snapshot + replay
<!-- AC:END -->
