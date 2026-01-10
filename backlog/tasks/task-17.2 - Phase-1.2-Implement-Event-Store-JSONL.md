---
id: task-17.2
title: 'Phase 1.2: Implement Event Store (JSONL)'
status: To Do
assignee: []
created_date: '2026-01-10 06:40'
labels:
  - phase-1
  - event-sourcing
  - storage
dependencies:
  - task-17.1
parent_task_id: task-17
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the core event store that persists events to JSONL files (one per day, append-only).

## Architecture

```
vault/
├── events/
│   ├── 2026-01-10.jsonl    # Today's events
│   ├── 2026-01-09.jsonl    # Yesterday
│   └── ...
```

## JSONL Format

Each line is a complete JSON event:
```jsonl
{"ts":"2026-01-10T09:00:00.000Z","type":"session.started","data":{"date":"2026-01-10"}}
{"ts":"2026-01-10T09:00:05.123Z","type":"objective.selected","data":{"id":"obj1"}}
{"ts":"2026-01-10T09:00:12.456Z","type":"step.created","data":{"id":"s1","objectiveId":"obj1","name":"Fix auth bug"}}
```

## EventStore Class

```typescript
// src/events/store.ts

export class EventStore {
  private vaultPath: string;
  private currentDay: string;
  private writeStream: fs.WriteStream | null = null;
  
  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
    this.currentDay = this.getDateString();
  }
  
  /**
   * Append an event to today's log
   */
  async append(event: AnyEvent): Promise<void> {
    // Validate event
    validateEvent(event);
    
    // Check if day changed
    const today = this.getDateString();
    if (today !== this.currentDay) {
      await this.rollover(today);
    }
    
    // Write to JSONL file
    const line = JSON.stringify(event) + '\n';
    await this.getWriteStream().write(line);
  }
  
  /**
   * Append multiple events atomically
   */
  async appendBatch(events: AnyEvent[]): Promise<void> {
    const lines = events.map(e => JSON.stringify(e)).join('\n') + '\n';
    await this.getWriteStream().write(lines);
  }
  
  /**
   * Read events from a specific day
   */
  async readDay(date: string): Promise<AnyEvent[]> {
    const filePath = this.getFilePath(date);
    if (!await fs.pathExists(filePath)) return [];
    
    const content = await fs.readFile(filePath, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }
  
  /**
   * Read events from date range
   */
  async readRange(startDate: string, endDate: string): Promise<AnyEvent[]> {
    const dates = this.getDateRange(startDate, endDate);
    const events: AnyEvent[] = [];
    
    for (const date of dates) {
      events.push(...await this.readDay(date));
    }
    
    return events;
  }
  
  /**
   * Stream events (for large datasets)
   */
  async *streamEvents(startDate?: string): AsyncGenerator<AnyEvent> {
    const files = await this.getEventFiles();
    
    for (const file of files) {
      if (startDate && file < startDate) continue;
      
      const rl = readline.createInterface({
        input: fs.createReadStream(this.getFilePath(file))
      });
      
      for await (const line of rl) {
        if (line.trim()) yield JSON.parse(line);
      }
    }
  }
  
  /**
   * Get list of all event files
   */
  async getEventFiles(): Promise<string[]> {
    const eventsDir = path.join(this.vaultPath, 'events');
    const files = await fs.readdir(eventsDir);
    return files
      .filter(f => f.endsWith('.jsonl'))
      .map(f => f.replace('.jsonl', ''))
      .sort();
  }
  
  /**
   * Handle day rollover
   */
  private async rollover(newDay: string): Promise<void> {
    // Close previous day's stream
    if (this.writeStream) {
      await this.writeStream.end();
      this.writeStream = null;
    }
    
    // Emit day changed event
    await this.append({
      ts: new Date().toISOString(),
      type: 'session.day_changed',
      data: { date: newDay }
    });
    
    this.currentDay = newDay;
  }
  
  private getFilePath(date: string): string {
    return path.join(this.vaultPath, 'events', `${date}.jsonl`);
  }
  
  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }
  
  private getWriteStream(): fs.WriteStream {
    if (!this.writeStream) {
      const filePath = this.getFilePath(this.currentDay);
      fs.ensureDirSync(path.dirname(filePath));
      this.writeStream = fs.createWriteStream(filePath, { flags: 'a' });
    }
    return this.writeStream;
  }
}
```

## File Structure

```
src/
├── events/
│   ├── types.ts          # Event types (from 1.1)
│   ├── schema.ts         # Validation
│   ├── factory.ts        # Event creators
│   ├── store.ts          # EventStore class ← NEW
│   └── index.ts
```

## Error Handling

- Corrupted line → skip and log warning
- Missing file → return empty array
- Write failure → retry with exponential backoff
- Disk full → emit error event, pause writes
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 EventStore class with append(), readDay(), readRange() methods
- [ ] #2 JSONL files stored in vault/events/ folder
- [ ] #3 Automatic day rollover at midnight
- [ ] #4 Streaming API for large datasets
- [ ] #5 Atomic batch writes
- [ ] #6 Graceful handling of corrupted lines
- [ ] #7 File locking to prevent concurrent write corruption
<!-- AC:END -->
