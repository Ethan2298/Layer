# Markdown Editing (Warp-style Blocks)

Inspired by Warp terminal's block-based interface where commands and output are discrete, referenceable units.

## Concept

- Each step, note, or document is a block
- Expand a step into a full markdown note
- Attach code snippets, embed files
- The objective becomes a workspace with artifacts, not just a title + list

## Benefits

- Richer context per step
- Can document decisions, research, code inline
- Everything stays connected to the objective
- Searchable, indexable content

## Implementation

- Contenteditable with markdown parsing
- Or embedded editor component
- Steps can have optional expanded content
- Files stored in vault alongside objective
