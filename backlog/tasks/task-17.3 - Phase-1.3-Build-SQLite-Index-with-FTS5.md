---
id: task-17.3
title: 'Phase 1.3: Build SQLite Index with FTS5'
status: To Do
assignee: []
created_date: '2026-01-10 06:41'
labels:
  - phase-1
  - event-sourcing
  - sqlite
  - search
dependencies:
  - task-17.2
parent_task_id: task-17
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create SQLite index for fast event queries and full-text search.

## Why SQLite?

- JSONL is append-only (write-optimized)
- SQLite is query-optimized
- Rebuild index from events anytime
- FTS5 for natural language queries

## Database Schema

```sql
-- Core events table
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,                    -- ISO timestamp
  type TEXT NOT NULL,                  -- event type
  data TEXT NOT NULL,                  -- JSON payload
  date TEXT NOT NULL,                  -- YYYY-MM-DD (partition key)
  
  -- Denormalized for fast queries
  objective_id TEXT,
  priority_id TEXT,
  step_id TEXT,
  app_name TEXT
);

CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_objective ON events(objective_id);
CREATE INDEX idx_events_ts ON events(ts);

-- Full-text search
CREATE VIRTUAL TABLE events_fts USING fts5(
  type,
  content,                             -- Extracted searchable text
  content=events,
  content_rowid=id
);

-- Triggers to keep FTS in sync
CREATE TRIGGER events_ai AFTER INSERT ON events BEGIN
  INSERT INTO events_fts(rowid, type, content) 
  VALUES (new.id, new.type, json_extract(new.data, '$.name') || ' ' || json_extract(new.data, '$.description'));
END;

-- Materialized views (computed on demand)
CREATE TABLE mv_daily_summary (
  date TEXT PRIMARY KEY,
  events_count INTEGER,
  objectives_active INTEGER,
  steps_completed INTEGER,
  total_focus_time INTEGER,            -- seconds
  deep_work_score INTEGER,
  top_app TEXT,
  computed_at TEXT
);

CREATE TABLE mv_objective_stats (
  objective_id TEXT PRIMARY KEY,
  name TEXT,
  created_at TEXT,
  total_steps INTEGER,
  completed_steps INTEGER,
  total_time INTEGER,
  avg_session_length INTEGER,
  last_activity TEXT,
  computed_at TEXT
);
```

## EventIndex Class

```typescript
// src/events/index-db.ts
import Database from 'better-sqlite3';

export class EventIndex {
  private db: Database.Database;
  
  constructor(vaultPath: string) {
    const dbPath = path.join(vaultPath, 'index.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }
  
  /**
   * Index a single event
   */
  indexEvent(event: AnyEvent): void {
    const stmt = this.db.prepare(`
      INSERT INTO events (ts, type, data, date, objective_id, priority_id, step_id, app_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      event.ts,
      event.type,
      JSON.stringify(event.data),
      event.ts.split('T')[0],
      event.data.objectiveId || event.data.id,
      event.data.priorityId,
      event.data.stepId || event.data.id,
      event.data.app
    );
  }
  
  /**
   * Batch index events
   */
  indexBatch(events: AnyEvent[]): void {
    const insert = this.db.prepare(`
      INSERT INTO events (ts, type, data, date, objective_id, priority_id, step_id, app_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const transaction = this.db.transaction((events: AnyEvent[]) => {
      for (const event of events) {
        insert.run(
          event.ts,
          event.type,
          JSON.stringify(event.data),
          event.ts.split('T')[0],
          event.data.objectiveId || event.data.id,
          event.data.priorityId,
          event.data.stepId || event.data.id,
          event.data.app
        );
      }
    });
    
    transaction(events);
  }
  
  /**
   * Query events by type
   */
  queryByType(type: string, limit = 100): AnyEvent[] {
    return this.db.prepare(`
      SELECT ts, type, data FROM events
      WHERE type = ?
      ORDER BY ts DESC
      LIMIT ?
    `).all(type, limit).map(row => ({
      ts: row.ts,
      type: row.type,
      data: JSON.parse(row.data)
    }));
  }
  
  /**
   * Query events for objective
   */
  queryByObjective(objectiveId: string, limit = 100): AnyEvent[] {
    return this.db.prepare(`
      SELECT ts, type, data FROM events
      WHERE objective_id = ?
      ORDER BY ts DESC
      LIMIT ?
    `).all(objectiveId, limit).map(this.parseRow);
  }
  
  /**
   * Full-text search
   */
  search(query: string, limit = 50): AnyEvent[] {
    return this.db.prepare(`
      SELECT e.ts, e.type, e.data 
      FROM events e
      JOIN events_fts fts ON e.id = fts.rowid
      WHERE events_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit).map(this.parseRow);
  }
  
  /**
   * Get daily summary
   */
  getDailySummary(date: string): DailySummary {
    const cached = this.db.prepare(`
      SELECT * FROM mv_daily_summary WHERE date = ?
    `).get(date);
    
    if (cached && this.isFresh(cached.computed_at)) {
      return cached;
    }
    
    return this.computeDailySummary(date);
  }
  
  /**
   * Rebuild entire index from event files
   */
  async rebuild(eventStore: EventStore): Promise<void> {
    this.db.exec('DELETE FROM events');
    
    for await (const event of eventStore.streamEvents()) {
      this.indexEvent(event);
    }
  }
  
  private parseRow(row: any): AnyEvent {
    return {
      ts: row.ts,
      type: row.type,
      data: JSON.parse(row.data)
    };
  }
}
```

## Query Examples for AI

```typescript
// "What did I work on this week?"
const weekEvents = index.queryByDateRange(weekStart, today);

// "Find everything about authentication"
const authEvents = index.search('auth authentication login');

// "How much time on Ship MVP?"
const mvpStats = index.getObjectiveStats('obj-shipmvp');

// "What apps do I use most when stuck?"
const appPatterns = index.queryAppUsageBeforeAbandoned();
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SQLite database with events table and indexes
- [ ] #2 FTS5 virtual table for full-text search
- [ ] #3 Materialized views for daily/objective summaries
- [ ] #4 EventIndex class with query methods
- [ ] #5 Batch indexing with transactions
- [ ] #6 Rebuild from JSONL files on demand
- [ ] #7 WAL mode for concurrent reads
- [ ] #8 Query performance < 50ms for common queries
<!-- AC:END -->
