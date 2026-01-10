# AI Assistant with Full Context

Chat interface with AI that can query the entire event database.

## Available Context

- Vault contents (objectives, notes, code)
- Activity timeline (what you did, how long)
- System logs (apps, context switches)
- Historical patterns (when productive, what derails)
- Behavioral data (edits, hesitations, regenerations)

## Example Interactions

```
You: What did I actually get done this week?

AI: [queries events, aggregates]

    This week you completed 7 steps across 2 objectives:
    - Ship MVP: 5 steps (auth, deployment, testing...)
    - Learn Rust: 2 steps (chapters 3-4)

    Total tracked time: 12h 34m
    Most active day: Tuesday (4h 12m)

You: Why do I keep avoiding the Rust objective?

AI: [queries behavioral patterns]

    You've selected it 8 times this month but only started
    steps twice. When you do work on it, sessions are short
    (avg 23 min vs 67 min on Ship MVP).

    No judgment—just what the data shows.
```

## Key Principle

The AI sees your process, not just outcomes. It knows:
- What you did
- How you worked
- When you hesitated
- What derailed you

Data is transparent. You see exactly what the AI sees.
