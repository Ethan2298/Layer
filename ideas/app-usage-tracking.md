# System-Level App Usage Tracking

Track which app is active and when user switches. Simple, comprehensive.

## What to Capture

1. **Foreground app** - What's active right now
2. **Activity detection** - Is user interacting (clicks, keys) or idle
3. **Transitions** - When focus switches, log it

## Log Format

```
2026-01-10 09:00:12  VS Code (active)      0:00
2026-01-10 09:47:33  Slack (active)        47:21
2026-01-10 09:52:18  Slack (idle)          4:45
2026-01-10 09:53:01  VS Code (active)      0:43
2026-01-10 11:24:55  Chrome (active)       1:31:54
```

## Implementation

- macOS: NSWorkspace APIs, accessibility APIs
- Windows: GetForegroundWindow, input hooks
- Linux: X11/Wayland APIs

Electron accesses via native modules or helper processes. Requires permissions (especially macOS accessibility).

## Storage

Append-only logs, one per day:
```
vault/
├── activity/
│   ├── 2026-01-10.jsonl
│   ├── 2026-01-09.jsonl
```

## What This Enables

- "You worked 2.5 hours in VS Code on this objective"
- "40% of work time in communication apps"
- "When you start in Slack, avg 23 min before productive apps"
- Context for AI: what apps were used during a step
