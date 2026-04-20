# StudioFlow — UI Design System & Today's View Specification

> **Document Version:** 1.0
> **Status:** Draft — Pending Review
> **Scope:** Today's View redesign. Extends and does NOT conflict with `MASTER_SSOT.md §1`.
> **Benchmarks:** Todoist (Premium), Notion, Programma.design

---

## 0. Design Philosophy

StudioFlow is a **precision instrument**, not a generic SaaS. The UI must feel like it was designed by the same people who designed the work it manages — architects and interior designers who value negative space, proportion, and quiet confidence.

**Core Principles:**
1. **Restraint over decoration.** No gradients, no shadows unless load-bearing, no decorative icons.
2. **Typography is the UI.** Hierarchy is communicated through size, weight, and case—not color or cards.
3. **Interaction is felt, not seen.** Hover states are whispers. Transitions are swift (≤ 150ms). No spring animations.
4. **Flat is precise.** We are moving away from nested accordion cards (Project → Phase → Task). The new paradigm is a **flat, scannable task list** where each row is self-contained.

---

## 1. Color Palette

This is a **strict monotone system**. Color is a signal, not style.

### 1.1 Core Palette

| Token Name         | Tailwind Value  | Hex       | Role                                         |
|--------------------|-----------------|-----------|----------------------------------------------|
| `--canvas`         | `bg-slate-50`   | `#f8fafc` | Page background. The default resting surface. |
| `--surface`        | `bg-white`      | `#ffffff`  | Task rows, modals, sidebars at rest.         |
| `--surface-hovered`| `bg-slate-50`   | `#f8fafc` | Task row on hover.                           |
| `--text-primary`   | `text-slate-900`| `#0f172a` | Main readable content: task labels.          |
| `--text-secondary` | `text-slate-500`| `#64748b` | Metadata: project name, phase tag.          |
| `--text-tertiary`  | `text-slate-400`| `#94a3b8` | Completed tasks, placeholder text, hints.   |
| `--border-subtle`  | `border-slate-200` | `#e2e8f0` | All structural borders. The only border.  |
| `--border-focus`   | `border-slate-500` | `#64748b` | Checkbox on hover. Input on focus.        |
| `--accent`         | `bg-slate-900`  | `#0f172a` | Primary CTAs (button fill), checked checkbox. |
| `--accent-text`    | `text-white`    | `#ffffff`  | Text on `--accent` backgrounds.             |

### 1.2 Semantic / Signal Colors

Color use **must** be justified with a semantic reason. The following are the only permitted exceptions to the monotone rule:

| Token Name         | Tailwind Value      | When to Use                                              |
|--------------------|---------------------|----------------------------------------------------------|
| `--status-urgent`  | `text-red-600`      | Task/project labeled `URGENT`. Text label only.          |
| `--status-urgent-bg` | `bg-red-50`       | Background accent on urgent project group rows.          |
| `--status-urgent-border` | `border-red-200` | Border on urgent project group containers.             |
| `--feedback-icon`  | `text-amber-500`    | The `MessageSquare` icon for `FEEDBACK` mode tasks only. |
| `--status-done-check` | `bg-slate-900 text-white` | Checked checkbox state.                       |

### 1.3 Prohibition

The following are **banned** in the Today's View and task management context:
- `blue-*`, `purple-*`, `green-*`, `indigo-*` for decorative purposes.
- Gradient backgrounds (`bg-gradient-*`).
- `shadow-xl`, `shadow-lg` on task rows or inline components.
- Any `ring-*` utility except on focused interactive input elements.

---

## 2. Typography & Hierarchy

Fonts are pre-configured via `next/font` (Lora + Inter). Do not reference font names directly — use the Tailwind aliases `font-serif` and `font-sans`.

### 2.1 Type Scale

| Role           | Element    | Font       | Size          | Weight          | Tracking            | Color             |
|----------------|------------|------------|---------------|-----------------|---------------------|-------------------|
| Page Title     | `H1`       | `font-serif` | `text-3xl`  | `font-bold`     | `tracking-tight`    | `text-slate-950`  |
| Section Title  | `H2`       | `font-serif` | `text-xl`   | `font-bold`     | `tracking-tight`    | `text-slate-950`  |
| Group Label    | `H3`       | `font-sans`  | `text-sm`   | `font-semibold` | `tracking-tight`    | `text-slate-700`  |
| Task Label     | body       | `font-sans`  | `text-[13px]`| `font-normal`  | `tracking-normal`   | `text-slate-800`  |
| Inline Tag     | `<span>`   | `font-sans`  | `text-[10px]`| `font-bold`     | `tracking-[0.14em]` | `text-slate-400`  |
| Metadata/Phase | `<span>`   | `font-sans`  | `text-[10px]`| `font-bold`     | `tracking-[0.18em]` | `text-slate-400`  |
| Placeholder    | `input`    | `font-sans`  | `text-sm`   | `font-normal`   | `tracking-normal`   | `text-slate-300`  |

### 2.2 Editorial Mandate

- `font-serif` (Lora) is reserved **exclusively** for the page `H1` ("Today's View") and section `H2` dividers if used. It should not appear inside task rows.
- All operational UI — tasks, tags, buttons, metadata — uses `font-sans` (Inter). This is non-negotiable.
- The contrast between a serif page title and sans-serif task list creates the editorial precision feel we are targeting.

---

## 3. The Task Row — Anatomy

The task row is the atomic unit of the Today's View. It must be **lightweight**, **scannable**, and **self-sufficient**.

### 3.1 Visual Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ [○]  Task label text goes here, naturally wrapping if long  [meta] │
└─────────────────────────────────────────────────────────────────┘
     ↑                                                    ↑
  Checkbox                                         Inline Tags
  (20×20px)                                    (Project, Phase, Mode)
```

- **Height:** `min-h-[40px]`, comfortable row breathing room. Do not constrain `max-h`.
- **Background:** `bg-white` at rest. `bg-slate-50` on hover.
- **Border:** `border-b border-slate-200`. **No full border-box.** No `rounded-xl` on individual task rows.
  - Exception: the first and last rows within a group may inherit the container's `rounded-lg` clip.
- **Padding:** `px-4 py-2.5`
- **Cursor:** `cursor-pointer` on the entire row.

### 3.2 Checkbox

The checkbox is a **perfect circle** (not rounded-md). Its visual weight must be minimal unless it is checked.

| State           | Style                                                                                    |
|-----------------|------------------------------------------------------------------------------------------|
| **Unchecked**   | `h-4 w-4 rounded-full border border-slate-300 bg-white`                                |
| **Hover**       | `border-slate-500` (border darkens, no fill)                                             |
| **Checked**     | `h-4 w-4 rounded-full bg-slate-900 border-slate-900` + centered `Check` icon (9×9px, `text-white`) |
| **FEEDBACK mode** | Do not render a checkbox. Render `MessageSquare` icon (`h-3.5 w-3.5 text-amber-500`) instead. Feedback items are toggled the same way, but the icon communicates the semantic difference. |
| **Pending transition** | The entire row gets `opacity-60` and `pointer-events-none`.                    |

**Transition:** `transition-colors duration-150` on the checkbox container only.

### 3.3 Task Label

- Font: `font-sans text-[13px] text-slate-800 leading-5`
- Completed: `line-through text-slate-400`
- The label should be `flex-1` and allow natural wrapping. Do not truncate with `truncate` or `line-clamp`.

### 3.4 Completed State (Full Row)

When a task is checked:
- Row label: `line-through text-slate-400`
- Background remains `bg-white` (no grey fill on the row).
- Checked tasks should be visually **separated** from open tasks. Use the `ActivityListSorted` component's existing sort behavior (open tasks first, completed tasks after a visual divider or simply sorted to the bottom).

---

## 4. Inline Metadata Tags (Pills)

Tags must inform without cluttering. They live at the **trailing end** of the task row, right-aligned or wrapped below the label on mobile. They use typography (tracking, uppercase, size) — not background fills — to communicate hierarchy.

### 4.1 Tag Types & Treatment

#### Project Tag `#ProjectName`
- Format: `#` prefix + truncated project name (max 20 chars).
- Style: `font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400`
- No background pill, no border. Pure text.
- Example output: `#VILLA CANGGU`

#### Phase Tag `/PhaseName`
- Format: `/` prefix + phase name, abbreviated.
- Style: `font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400`
- Example output: `/DESIGN 3D`

#### Mode Indicator (FEEDBACK only)
- Do not render a text tag for FEEDBACK. The `MessageSquare` amber icon on the checkbox slot IS the mode indicator. This is sufficient.
- For `TODO` mode: no mode tag rendered at all (it is the default, implied state).

#### Urgent Indicator
- If the parent project is `priority: URGENT`, render a small dot `•` in `text-red-600` immediately before the project tag.
- This avoids adding a full badge and keeps the row clean.
- Example: `• #VILLA CANGGU /LAYOUT`

### 4.2 Tag Layout in Row

```
[○]  Revisi denah lantai dua sesuai feedback client    #VILLA CANGGU /LAYOUT
```

On mobile (`< 640px`), tags wrap below the task label on a second line.

### 4.3 What NOT to render as a tag
- Phase status (`IN_PROGRESS`, `ON_REVIEW`) — never shown in task row.
- Revision number — never shown in task row.
- User assignment — not shown in Today's View (it is already filtered to the current user).

---

## 5. Task Group Headers (Project / Phase Separators)

The flat list is **grouped by project** — but the grouping should not feel like a nested container. It is a **label divider**, not a card.

### 5.1 Project Group Header

```
VILLA CANGGU — BALI          ● URGENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- Font: `font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500`
- Interaction: **Collapsible.** Click the header or chevron to toggle phase/task visibility (chevron rotate-90 when open, 0 when closed).
- Accompanied by a thin `<hr>` or `border-b border-slate-100` spanning full width.
- No background, no card container, no shadow.
- If `priority: URGENT`:
  - The label dot is `text-red-600`.
  - No background fill on the group. The urgency is communicated by the dot + the task content.

### 5.2 Phase Sub-Divider (within project group)

When multiple phases are active in one project, use a minimal in-line divider:

```
    / DESIGN 3D
    ─────────────
    [task rows]
    / LAYOUT
    ─────────────
    [task rows]
```

- Font: `font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400`
- Preceded by a `h-px bg-slate-100` divider line.
- **Not** a chevron/accordion trigger. This is a static label, not interactive.

---

## 6. Interaction States

The guiding principle: **interactions are felt, not seen.** Speed is ≤ 150ms. No bouncing, no scaling.

### 6.1 Task Row

| Interaction          | Visual Change                                              | Duration   |
|----------------------|------------------------------------------------------------|------------|
| **Default**          | `bg-white`, `border-b border-slate-200`                   | —          |
| **Hover**            | `bg-slate-50`                                              | `150ms`    |
| **Active (click)**   | `opacity-80` momentarily (handled by browser default)      | `50ms`     |
| **Pending (toggle)** | `opacity-60 pointer-events-none`                           | Immediate  |
| **Checkbox hover**   | Checkbox border: `border-slate-300` → `border-slate-500`   | `150ms`    |

### 6.2 Inline Add Input

| Interaction         | Visual Change                                                     | Duration  |
|---------------------|-------------------------------------------------------------------|-----------|
| **Default (button)**| Muted text color `text-slate-400`, no background, no border       | —         |
| **Hover (button)**  | `text-slate-700`                                                  | `150ms`   |
| **Expanded (input)**| `border border-slate-200 rounded-lg bg-white` visible             | `150ms`   |
| **Focus (input)**   | `border-slate-500` (no `ring-*` utility, no glow)                 | `150ms`   |
| **Error state**     | `border-rose-300` + small `text-rose-500` error text below        | `150ms`   |

### 6.3 Forbidden Interactions

- No `scale-*` transforms on hover.
- No `shadow` changes on hover (shadows are architectural, not reactive).
- No JS-powered parallax or stagger animations in task lists.
- No `animate-bounce` or `animate-pulse` except on loading spinners (`animate-spin`).

---

## 7. Page Layout: Today's View

### 7.1 Overall Structure

```
┌──────────────────────────────────────────────────┐
│ [Today's View]                         [+ Quick Add] │  ← PageHeader: H1 Serif
│  Daily Pulse — {date string}                         │  ← Subtitle: body text
├──────────────────────────────────────────────────────┤
│                                                      │
│  ─ VILLA CANGGU ────────────────────── ● URGENT ─   │  ← Project group header
│    / DESIGN 3D ─────────────────────────────────    │  ← Phase sub-divider
│    [○] Revisi denah lantai dua sesuai feedback       │  ← Task row
│    [○] Cek material granit putih finish              │  ← Task row
│    [▪] Submit revision ke klien                      │  ← Done task (line-through)
│    [+ Add feedback to Design 3D...]                  │  ← Inline add
│                                                      │
│  ─ RUMAH MODERN SURABAYA ────────────────────────   │  ← Project group header
│    / LAYOUT ────────────────────────────────────    │
│    [○] Review moodboard slide 4                      │
│    [+ Add todo to Layout...]                         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 7.2 Empty State

When no active tasks exist:
- Centered vertically in the content area.
- Icon: `CalendarCheck2` from lucide-react, `h-8 w-8 text-slate-200`.
- Title: `font-sans text-sm font-medium text-slate-400` — "No open tasks today."
- Subtext: `font-sans text-xs text-slate-300` — "Active phases and feedback items will appear here."
- No illustration, no CTA button.

---

## 8. Component Inventory (Affected Components)

The following components must be refactored or created to implement this spec:

| Component File                           | Action   | Notes                                                                          |
|------------------------------------------|----------|--------------------------------------------------------------------------------|
| `src/components/today-task-item.tsx`     | REFACTOR | Change checkbox from `rounded-md` → `rounded-full`. Remove `rounded-xl` on row.|
| `src/components/activity-list-today.tsx` | REFACTOR | Accept and pass `mode` and inline tag data (`projectName`, `phaseName`, `isUrgent`) to each row. |
| `src/components/today-inline-add.tsx`    | MINOR    | Already mode-aware after last fix. Minor style adjustments for consistency.    |
| `src/app/(dashboard)/page.tsx`           | REFACTOR | Replace Accordion-based layout with flat grouped list. Remove `ProjectSectionGroup`, `PhaseSectionGroup`. |
| `src/ui_engine/tokens/index.ts`          | UPDATE   | Update `UI_ENGINE_TASK_ROW_CLASS` to use flat row style (no `rounded-xl`, no bg-slate-50). |

---

## 9. Non-Negotiable Rules (Enforcement)

These override any other local decisions:

1. **Checkbox MUST be `rounded-full`**, not `rounded-md`. This is the core distinguishing element of the redesign.
2. **Task rows MUST NOT have `rounded-xl`** border boxes. They are flat rows with a bottom border only.
3. **Tags are typography only.** No `bg-*` fills on project or phase tags.
4. **Red is reserved.** `red-*` classes may only appear with `URGENT` priority items.
5. **Amber is reserved.** `amber-*` classes may only appear on the `FEEDBACK` mode icon.
6. **No new fonts.** Do not introduce any font family. Only `font-sans` (Inter) and `font-serif` (Lora) per SSOT.
7. **Inline Add must remain in-place.** It does not open a modal. It expands inline, within the task list.

---

*This document is the design Single Source of Truth for the Today's View. No component code targeting this view may be written or refactored without alignment to this specification.*
