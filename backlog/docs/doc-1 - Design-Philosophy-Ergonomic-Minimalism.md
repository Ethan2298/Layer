---
id: doc-1
title: 'Design Philosophy: Ergonomic Minimalism'
type: other
created_date: '2026-01-10 07:00'
---
# Design Philosophy: Ergonomic Minimalism

Strip everything to its functional essence. Every pixel must earn its existence through utility, not decoration.

---

## The Methodology

### 1. Dual-Purpose Elements
Never add what can be repurposed. The step number already exists → make it the drag handle. One element, two functions. Zero bloat.

### 2. Progressive Disclosure
UI reveals itself through interaction, not visual noise. The number sits quietly. Hover activates transformation. The interface breathes.

### 3. Golden Ratio of Frequency
Visual weight proportional to usage frequency. Dragging is 5% of interactions → the drag affordance should be invisible 95% of the time.

### 4. Transformation Over Addition
Don't add a drag handle beside the number. Transform the number INTO the handle. Metamorphosis > accumulation.

### 5. Context-Aware States
At rest: information (the number). On hover: action (the grip). The same space serves different purposes based on user intent.

---

## The Aesthetic

- **Invisible until needed**
- **Semantic density** (every element carries meaning)
- **Smooth state transitions**
- **Zero redundancy**

---

## The Question to Ask

> "Can an existing element do this job?"

If yes → transform it.
If no → question whether the feature is needed at all.

---

## Examples

### Step Drag Handle (Jan 2026)
- **Before:** Separate `⋮⋮` drag handle element added to each step
- **After:** Step number transforms into `≡` on row hover
- **Result:** Zero new elements, dual-purpose number, progressive disclosure
