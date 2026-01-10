---
id: task-17
title: Implement Event-Sourced AI Assistant with Grok Integration
status: To Do
assignee: []
created_date: '2026-01-10 06:39'
labels:
  - epic
  - ai
  - architecture
  - event-sourcing
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Complete implementation of the Objectiv.go vision: an event-sourced productivity system with deep behavioral insights and a Grok-powered AI assistant that has full context access and can actively edit objectives, priorities, and steps.

## Vision Statement
Build a productivity system that understands *behavior*, not just tasks. The AI sees your process—what you did, how you worked, when you hesitated, what derailed you. Data is transparent: you see exactly what the AI sees.

## Architecture Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                         OBJECTIV.GO                             │
├─────────────────────────────────────────────────────────────────┤
│  Event Store (JSONL) → SQLite Index → Context Builder → Grok   │
│                                                                 │
│  Grok Actions:                                                  │
│  • Query history ("why am I stuck?")                           │
│  • Edit objectives/priorities/steps                            │
│  • Suggest next actions                                        │
│  • Summarize progress                                          │
│  • Analyze behavioral patterns                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Technical Stack
- **Event Store**: JSONL files (append-only, one per day)
- **Index**: SQLite with FTS5 for full-text search
- **AI**: xAI Grok API (compound model)
- **Native Tracking**: Swift helper for macOS app tracking
- **Storage**: Vault folder structure (Obsidian-style)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All user actions emit immutable events to JSONL store
- [ ] #2 Events are indexed in SQLite for fast queries
- [ ] #3 Vault folder structure stores all data as plain files
- [ ] #4 App usage tracking captures foreground app and idle state (macOS)
- [ ] #5 Deep work scores calculated from event patterns
- [ ] #6 Grok assistant has full context of current objective and history
- [ ] #7 Grok can execute actions: create/edit/complete objectives, priorities, steps
- [ ] #8 Chat UI integrated into main app interface
- [ ] #9 User can see exactly what context is sent to AI
- [ ] #10 System works offline with graceful degradation
<!-- AC:END -->
