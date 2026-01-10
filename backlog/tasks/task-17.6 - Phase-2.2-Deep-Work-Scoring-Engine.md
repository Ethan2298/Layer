---
id: task-17.6
title: 'Phase 2.2: Deep Work Scoring Engine'
status: To Do
assignee: []
created_date: '2026-01-10 06:43'
labels:
  - phase-2
  - scoring
  - analytics
dependencies:
  - task-17.5
parent_task_id: task-17
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Calculate focus quality scores from event patterns.

## Scoring Model

Each work batch (continuous work on an objective) gets a 0-100 score based on weighted signals.

## Score Components

```typescript
interface DeepWorkScore {
  total: number;                    // 0-100
  breakdown: {
    focusDuration: number;          // 0-30 points
    appConcentration: number;       // 0-25 points
    completionRate: number;         // 0-20 points
    lowInterruptions: number;       // 0-15 points
    sustainedActivity: number;      // 0-10 points
  };
  metrics: {
    durationMinutes: number;
    appSwitches: number;
    primaryAppPercent: number;
    stepsStarted: number;
    stepsCompleted: number;
    longestFocusStreak: number;     // minutes
    idleGaps: number;
    distractorApps: string[];       // Slack, Twitter, etc.
    distractorPercent: number;
  };
}
```

## Scoring Algorithm

```typescript
// src/scoring/deep-work.ts

const DISTRACTOR_APPS = ['Slack', 'Discord', 'Twitter', 'Messages', 'Mail'];
const FOCUS_APPS = ['VS Code', 'Xcode', 'Terminal', 'iTerm', 'Sublime', 'IntelliJ'];

export function calculateDeepWorkScore(
  batch: WorkBatch,
  appEvents: AppEvent[]
): DeepWorkScore {
  const metrics = computeMetrics(batch, appEvents);
  
  const breakdown = {
    // Focus Duration (0-30)
    // 30+ min = 30 points, scales linearly below
    focusDuration: Math.min(30, Math.floor(metrics.durationMinutes)),
    
    // App Concentration (0-25)
    // Single app focus = 25 points
    appConcentration: Math.floor(
      (metrics.primaryAppPercent / 100) * 25 * 
      (metrics.appSwitches < 5 ? 1 : 0.5)  // Penalty for many switches
    ),
    
    // Completion Rate (0-20)
    // All started steps completed = 20 points
    completionRate: metrics.stepsStarted === 0 
      ? 0 
      : Math.floor((metrics.stepsCompleted / metrics.stepsStarted) * 20),
    
    // Low Interruptions (0-15)
    // No distractors = 15 points
    lowInterruptions: Math.max(0, 
      15 - (metrics.distractorPercent * 0.5) - (metrics.idleGaps * 2)
    ),
    
    // Sustained Activity (0-10)
    // Long focus streak = 10 points
    sustainedActivity: Math.min(10, Math.floor(metrics.longestFocusStreak / 6))
  };
  
  return {
    total: Object.values(breakdown).reduce((a, b) => a + b, 0),
    breakdown,
    metrics
  };
}

function computeMetrics(batch: WorkBatch, appEvents: AppEvent[]): Metrics {
  const batchEvents = appEvents.filter(e => 
    e.ts >= batch.startTime && e.ts <= batch.endTime
  );
  
  // Calculate app usage
  const appUsage = new Map<string, number>();
  let lastApp = '';
  let lastTime = new Date(batch.startTime);
  
  for (const event of batchEvents) {
    if (lastApp) {
      const duration = new Date(event.ts).getTime() - lastTime.getTime();
      appUsage.set(lastApp, (appUsage.get(lastApp) || 0) + duration);
    }
    lastApp = event.data.app;
    lastTime = new Date(event.ts);
  }
  
  // Find primary app
  let primaryApp = '';
  let primaryTime = 0;
  for (const [app, time] of appUsage) {
    if (time > primaryTime) {
      primaryApp = app;
      primaryTime = time;
    }
  }
  
  const totalTime = batch.endTime - batch.startTime;
  
  // Count distractor usage
  let distractorTime = 0;
  for (const [app, time] of appUsage) {
    if (DISTRACTOR_APPS.some(d => app.includes(d))) {
      distractorTime += time;
    }
  }
  
  // Count focus streaks
  let longestStreak = 0;
  let currentStreak = 0;
  let lastWasFocus = false;
  
  for (const event of batchEvents) {
    const isFocus = FOCUS_APPS.some(f => event.data.app.includes(f));
    if (isFocus) {
      if (lastWasFocus) {
        currentStreak += 5; // Assuming 5-second polling
      } else {
        currentStreak = 5;
      }
      longestStreak = Math.max(longestStreak, currentStreak);
    }
    lastWasFocus = isFocus;
  }
  
  return {
    durationMinutes: Math.floor(totalTime / 60000),
    appSwitches: batchEvents.length,
    primaryAppPercent: Math.floor((primaryTime / totalTime) * 100),
    stepsStarted: batch.steps.filter(s => s.startedAt).length,
    stepsCompleted: batch.steps.filter(s => s.completedAt).length,
    longestFocusStreak: Math.floor(longestStreak / 60),
    idleGaps: batchEvents.filter(e => e.type === 'app.idle_start').length,
    distractorApps: [...new Set(
      batchEvents
        .filter(e => DISTRACTOR_APPS.some(d => e.data.app.includes(d)))
        .map(e => e.data.app)
    )],
    distractorPercent: Math.floor((distractorTime / totalTime) * 100)
  };
}
```

## Work Batch Detection

```typescript
// src/scoring/batch-detector.ts

export interface WorkBatch {
  id: string;
  objectiveId: string;
  objectiveName: string;
  startTime: string;
  endTime: string;
  steps: Step[];
  deepWorkScore?: DeepWorkScore;
}

const BATCH_GAP_THRESHOLD = 15 * 60 * 1000; // 15 minutes

export function detectWorkBatches(
  objectiveEvents: AnyEvent[],
  appEvents: AppEvent[]
): WorkBatch[] {
  const batches: WorkBatch[] = [];
  let currentBatch: Partial<WorkBatch> | null = null;
  
  for (const event of objectiveEvents.sort((a, b) => a.ts.localeCompare(b.ts))) {
    if (event.type === 'objective.selected' || event.type === 'step.started') {
      const objectiveId = event.data.objectiveId || event.data.id;
      
      // Check if continuing same objective or starting new
      if (currentBatch && currentBatch.objectiveId === objectiveId) {
        const gap = new Date(event.ts).getTime() - new Date(currentBatch.endTime!).getTime();
        if (gap < BATCH_GAP_THRESHOLD) {
          currentBatch.endTime = event.ts;
          continue;
        }
      }
      
      // Finalize previous batch
      if (currentBatch) {
        batches.push(finalizeBatch(currentBatch, appEvents));
      }
      
      // Start new batch
      currentBatch = {
        id: generateId(),
        objectiveId,
        startTime: event.ts,
        endTime: event.ts,
        steps: []
      };
    }
    
    if (currentBatch && event.type.startsWith('step.')) {
      // Track steps in current batch
    }
  }
  
  if (currentBatch) {
    batches.push(finalizeBatch(currentBatch, appEvents));
  }
  
  return batches;
}

function finalizeBatch(batch: Partial<WorkBatch>, appEvents: AppEvent[]): WorkBatch {
  const complete = batch as WorkBatch;
  complete.deepWorkScore = calculateDeepWorkScore(complete, appEvents);
  return complete;
}
```

## Daily/Weekly Aggregation

```typescript
export function getDailyDeepWorkSummary(date: string, batches: WorkBatch[]): DailySummary {
  const dayBatches = batches.filter(b => b.startTime.startsWith(date));
  
  return {
    date,
    totalMinutes: dayBatches.reduce((sum, b) => 
      sum + (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000, 0
    ),
    avgScore: dayBatches.length 
      ? Math.round(dayBatches.reduce((sum, b) => sum + (b.deepWorkScore?.total || 0), 0) / dayBatches.length)
      : 0,
    bestBatch: dayBatches.sort((a, b) => 
      (b.deepWorkScore?.total || 0) - (a.deepWorkScore?.total || 0)
    )[0],
    topDistractor: findTopDistractor(dayBatches)
  };
}
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Score calculated from 5 weighted components (focus, concentration, completion, interruptions, sustained)
- [ ] #2 Work batch detection groups continuous work on same objective
- [ ] #3 Distractor apps identified and penalized
- [ ] #4 Focus streak tracking rewards sustained attention
- [ ] #5 Daily and weekly aggregations computed
- [ ] #6 Score breakdown visible to user (transparent)
- [ ] #7 Scores stored with batch in events/index
- [ ] #8 Performance: score calculation < 100ms
<!-- AC:END -->
