# Deep Work Scoring

AI-generated focus quality scores per work batch. User can see patterns and peruse their own behavior.

## Data Per Batch

```
Ship MVP batch (9:00 - 10:47)
├── Duration: 1h 47m
├── Apps: VS Code (94%), Terminal (6%)
├── App switches: 3
├── Longest unbroken focus: 38m
├── Steps completed: 2 of 2 started
├── Keystrokes: 2,847 (sustained)
├── Idle gaps: 2 (< 2min each)
└── Context switches to other objectives: 0
```

## Score Display

0-100 based on weighted signals:

```
┌─ Ship MVP ─────────────────────────── 1h 47m ──┐
│                                                │
│  ████████████████████░░░░  Deep: 87           │
│                                                │
│  ✓ Fix auth redirect bug              (38m)   │
│  ✓ Write deployment script            (52m)   │
└────────────────────────────────────────────────┘
```

## Expandable Detail

Click score to see breakdown:

```
Deep: 24

  Focus duration     ████░░░░░░  12/30
  App concentration  ██░░░░░░░░   8/25
  Completion rate    ░░░░░░░░░░   0/20
  Low interruptions  ████░░░░░░   4/15
  Sustained activity ░░░░░░░░░░   0/10

  27 app switches (high)
  Slack open 31% of session
  Step started but not completed
```

## Weekly Patterns

```
Deep Work This Week

Mon   ████████████████░░░░░░░░  68  (3.2h)
Tue   ██████████████████████░░  82  (4.1h)  ← best
Wed   ░░░░░░░░░░░░░░░░░░░░░░░░  --  (no activity)
Thu   ██████████░░░░░░░░░░░░░░  41  (2.8h)
Fri   ████████████████░░░░░░░░  64  (2.1h)

Avg deep score: 64
Best hours: 9-11am
Worst: after 3pm
Top distractor: Slack
```

## AI Integration

AI uses scores when chatting/suggesting:

> "You completed auth with deep score 91—your best this week. CI debugging scored 24 and didn't finish. Consider tackling CI in the morning when focus is stronger."

Data is transparent. You see exactly what the AI sees.
