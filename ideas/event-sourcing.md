# Event Sourcing - Timestamped Everything

Every action in the app becomes an immutable event. Current state is computed from event history.

## Core Principle

No separate "data model." Just:
1. Event log (append-only, immutable)
2. Projections (current state computed from events)
3. Indexes (for fast queries)

## Event Types

```
{ ts: ..., type: "objective.created", data: { id: "abc", name: "Launch app" } }
{ ts: ..., type: "objective.renamed", data: { id: "abc", from: "Launch app", to: "Ship MVP" } }
{ ts: ..., type: "objective.selected", data: { id: "abc" } }
{ ts: ..., type: "step.created", data: { ... } }
{ ts: ..., type: "step.started", data: { ... } }
{ ts: ..., type: "step.paused", data: { ... } }
{ ts: ..., type: "step.completed", data: { ..., elapsed: 2340 } }
{ ts: ..., type: "ui.suggestion.generated", data: { text: "...", accepted: false } }
{ ts: ..., type: "ui.suggestion.regenerated", data: { attempt: 3 } }
```

## What This Reveals

Behavioral patterns invisible in current state:
- "You renamed this objective 5 times" → uncertainty
- "You created then deleted 3 steps" → false starts
- "You always check this objective first" → implicit priority
- "Average time from step.created to step.started: 2 days" → procrastination

## For AI

The model queries natural language, retrieval layer translates:
- "What have I been stuck on?" → find long-running incomplete steps
- "Why do I avoid this project?" → analyze selection vs action patterns
