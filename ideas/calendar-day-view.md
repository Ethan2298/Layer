# Calendar Day View with Batched Chunks

The day view is the primary interface. Time is the backbone, everything hangs off it.

## Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Friday, January 10                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  9:00 ──────────────────────────────────────────────────    │
│  │                                                          │
│  │  ┌─ Ship MVP ─────────────────────────── 1h 47m ──┐     │
│  │  │  ✓ Fix auth redirect bug              (38m)    │     │
│  │  │  ✓ Write deployment script            (52m)    │     │
│  │  │  • Update env config                  (17m)    │     │
│  │  └────────────────────────────────────────────────┘     │
│  │                                                          │
│  11:00 ─────────────────────────────────────────────────    │
│  │                                                          │
│  │  ┌─ Unassociated ──────────────────────── 34m ────┐     │
│  │  │  Chrome, Slack, browsing                       │     │
│  │  └────────────────────────────────────────────────┘     │
│  │                                                          │
│  11:34 ─────────────────────────────────────────────────    │
│  │                                                          │
│  │  ┌─ Learn Rust ───────────────────────── 45m ─────┐     │
│  │  │  ✓ Complete chapter 4 exercises       (45m)    │     │
│  │  └────────────────────────────────────────────────┘     │
│  │                                                          │
└─────────────────────────────────────────────────────────────┘
```

## Batching Rules

- Consecutive steps on same objective → batch together
- Gap > N minutes or different objective → new batch
- Same objective later → separate batch, same color/tag
- Activity without steps → "Unassociated" block

## Duration Calculation

Steps are the anchors. Everything else inferred:

```
step.started  @ 9:00  ─┐
step.completed @ 9:38  ─┴─ 38m (explicit)

(no step active)
app.focus Chrome @ 10:35
app.focus Slack @ 10:50
step.started @ 11:08   ─── gap = 33m unassociated
```

## UI Consistency

Uses same list component patterns:
- Click to select
- Inline edit
- Hover controls
- Keyboard nav (j/k)
- Same typography, spacing

The day view is just another list—of time batches.
