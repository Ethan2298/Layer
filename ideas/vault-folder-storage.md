# Vault / Folder-Based Storage

The Obsidian model. App points to a folder, everything is plain files.

## Structure

```
~/objectives/
├── launch-side-project/
│   ├── meta.json (objective config, priorities)
│   ├── steps.json (or steps.md)
│   ├── notes/
│   │   ├── competitor-research.md
│   │   └── pricing-ideas.md
│   └── assets/
├── learn-rust/
│   └── ...
├── daily/
│   ├── 2026-01-10.md
│   └── ...
├── events/
│   ├── 2026-01-10.jsonl
│   └── ...
└── index.db
```

## Benefits

- Plain files, version controllable
- Sync with any tool (git, Dropbox, etc.)
- Edit in other apps if needed
- Portable, not locked in
- The app is a view into the vault, not the owner of data

## Indexing

- SQLite or DuckDB for fast queries
- Full-text search (tantivy, sqlite FTS)
- Rebuild index from files anytime
