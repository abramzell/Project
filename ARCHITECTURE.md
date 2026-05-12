# ARCHITECTURE.md — Mood Tracker App

A technical reference describing how the app is structured, how its pieces fit together, and the reasoning behind key decisions. Intended for developers and AI agents working on this codebase.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [File Responsibilities](#2-file-responsibilities)
3. [Application Layers](#3-application-layers)
4. [Data Flow](#4-data-flow)
5. [State Management](#5-state-management)
6. [Storage Layer](#6-storage-layer)
7. [Rendering Model](#7-rendering-model)
8. [Event Handling](#8-event-handling)
9. [Module Map (`app.js`)](#9-module-map-appjs)
10. [HTML Structure](#10-html-structure)
11. [CSS Architecture](#11-css-architecture)
12. [Key Algorithms](#12-key-algorithms)
13. [Error Handling Strategy](#13-error-handling-strategy)
14. [Constraints & Tradeoffs](#14-constraints--tradeoffs)
15. [Extension Points](#15-extension-points)

---

## 1. High-Level Overview

```
┌─────────────────────────────────────────┐
│              Browser Tab                │
│                                         │
│  ┌──────────┐   ┌──────────────────┐   │
│  │index.html│   │    style.css     │   │
│  │  (shell) │   │  (presentation)  │   │
│  └────┬─────┘   └──────────────────┘   │
│       │                                 │
│  ┌────▼──────────────────────────────┐  │
│  │              app.js               │  │
│  │                                   │  │
│  │  ┌──────────┐  ┌───────────────┐ │  │
│  │  │  State   │  │    Render     │ │  │
│  │  │ (in-mem) │◄─│   Functions   │ │  │
│  │  └────┬─────┘  └───────┬───────┘ │  │
│  │       │                │         │  │
│  │  ┌────▼─────┐  ┌───────▼───────┐ │  │
│  │  │ Storage  │  │     DOM       │ │  │
│  │  │  Layer   │  │  (index.html) │ │  │
│  │  └────┬─────┘  └───────────────┘ │  │
│  └───────┼───────────────────────────┘  │
│          │                              │
│  ┌───────▼───────┐                      │
│  │ localStorage  │                      │
│  │ (persistent)  │                      │
│  └───────────────┘                      │
└─────────────────────────────────────────┘
```

The app is a fully client-side, single-page application with no server, no build step, and no external dependencies beyond Google Fonts. All persistence is handled by the browser's `localStorage` API.

---

## 2. File Responsibilities

| File | Role | Owns |
|---|---|---|
| `index.html` | App shell and static structure | DOM skeleton, `<meta>`, Google Fonts `<link>`, section scaffolding |
| `style.css` | All visual presentation | CSS custom properties, layout, component styles, animations |
| `app.js` | All behaviour and logic | State, storage, rendering, event wiring |
| `AGENTS.md` | AI agent instructions | Functional requirements, constraints, acceptance criteria |
| `ARCHITECTURE.md` | Technical reference | Structure, data flow, design decisions (this file) |
| `README.md` | Human-facing docs | Setup, usage, deployment guide |

**Rule:** Logic never lives in HTML. Styles never live in JS (no inline `style` assignments except for dynamic values like progress widths). Structure never lives in CSS.

---

## 3. Application Layers

The codebase is organized into four logical layers, in order from most abstract to most concrete:

```
┌─────────────────────────────────────────────────────┐
│  Layer 4 — PRESENTATION  (style.css)                │
│  Fonts, colors, spacing, transitions, responsiveness│
├─────────────────────────────────────────────────────┤
│  Layer 3 — RENDER  (app.js: render functions)       │
│  Builds HTML strings, injects into DOM containers   │
├─────────────────────────────────────────────────────┤
│  Layer 2 — STATE  (app.js: state object + mutators) │
│  In-memory representation of current app state      │
├─────────────────────────────────────────────────────┤
│  Layer 1 — STORAGE  (app.js: storage functions)     │
│  Read/write entries to/from localStorage            │
└─────────────────────────────────────────────────────┘
```

Each layer only communicates with the layer directly adjacent to it. Render functions read from State; they never read from Storage directly. Event handlers mutate State and call Storage; they do not manipulate the DOM directly.

---

## 4. Data Flow

### Write path (user saves a mood entry)

```
User clicks "Save Entry"
        │
        ▼
Event Handler
  - reads selected mood from state.selectedMood
  - reads notes from <textarea> value
  - constructs a new Entry object
        │
        ▼
addOrUpdateEntry(entry)       ← Storage layer
  - calls getEntries()
  - upserts by entry.date
  - calls saveEntries(updated)  → localStorage.setItem(...)
        │
        ▼
state.entries = getEntries()  ← State refresh
        │
        ▼
render()                      ← Full re-render
  renderHistory()
  renderStats()
  renderWeekStrip()
        │
        ▼
showToast("Entry saved!")     ← UI feedback
```

### Read path (page load)

```
DOMContentLoaded
        │
        ▼
initState()
  state.entries = getEntries()   ← localStorage.getItem(...)
  state.selectedMood = null
  state.editingId = null
        │
        ▼
render()
  renderHistory()
  renderStats()
  renderWeekStrip()
        │
        ▼
bindEvents()
  attach all event listeners
```

---

## 5. State Management

All mutable application state lives in a single plain object at the top of `app.js`:

```js
const state = {
  entries: [],          // Array<Entry> — source of truth, mirrors localStorage
  selectedMood: null,   // string | null — currently highlighted mood button
  editingId: null,      // string | null — id of entry open in edit modal
};
```

### Rules for state mutation

- **Never mutate `state.entries` in place.** Always replace it with a new array:
  ```js
  // ✅ Correct
  state.entries = state.entries.filter(e => e.id !== id);

  // ❌ Wrong
  state.entries.splice(index, 1);
  ```
- After any mutation, call the relevant render function(s) to sync the DOM.
- `state.entries` is always kept in sync with `localStorage` — they are updated together in the same operation, never separately.
- `selectedMood` and `editingId` are UI state only and are never persisted.

---

## 6. Storage Layer

All `localStorage` interactions are encapsulated in five functions. No other part of the app touches `localStorage` directly.

```
┌──────────────────────────────────────────────────────┐
│                  localStorage                        │
│  key: "moodtracker_entries"                          │
│  value: JSON string → Array<Entry>                   │
└──────────────────┬───────────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
getEntries()  saveEntries()  getEntryByDate()
                   │
       ┌───────────┴──────────┐
       ▼                      ▼
addOrUpdateEntry()       deleteEntry()
```

### Function contracts

```js
// Returns all stored entries, or [] if none exist or JSON is malformed.
// Never throws — wraps parse in try/catch.
function getEntries(): Entry[]

// Serializes and persists the entries array.
// Overwrites the entire key on every call (no partial writes).
function saveEntries(entries: Entry[]): void

// Returns the entry whose .date === date, or undefined.
// date format: "YYYY-MM-DD"
function getEntryByDate(date: string): Entry | undefined

// If an entry with the same .date exists, replaces it.
// Otherwise appends. Calls saveEntries() internally.
function addOrUpdateEntry(entry: Entry): void

// Removes the entry with matching .id. No-op if not found.
// Calls saveEntries() internally.
function deleteEntry(id: string): void
```

### Why a single localStorage key?

Mood entries are always read and written as a complete set — the stats, weekly strip, and history list all need all entries at once. Using one key avoids multi-key synchronization bugs and simplifies export/import to a single `JSON.parse` / `JSON.stringify`.

---

## 7. Rendering Model

The app uses **full subtree re-renders**, not incremental DOM patching. After any state change, the relevant section's container is wiped and rebuilt from the current state.

```js
function renderHistory() {
  const container = document.getElementById('history-list');
  container.innerHTML = buildHistoryHTML(state.entries);
}
```

### Why full re-renders instead of targeted DOM updates?

- The dataset is small (typically dozens to low hundreds of entries). Full re-renders are imperceptibly fast.
- Eliminates an entire class of bugs where the DOM gets out of sync with state.
- No need for a virtual DOM, diffing library, or manual bookkeeping.
- Makes the code easy to read and reason about.

### Render functions

| Function | Renders | Container ID |
|---|---|---|
| `renderHistory()` | Month-grouped entry cards | `#history-list` |
| `renderStats()` | Total count, top mood | `#stats-panel` |
| `renderWeekStrip()` | Last 7 days emoji row | `#week-strip` |
| `renderModal(entry)` | Edit modal with pre-filled values | `#modal-container` |
| `closeModal()` | Clears modal, resets `editingId` | `#modal-container` |

All render functions return nothing — they write directly to the DOM. They read only from `state`, never from `localStorage`.

---

## 8. Event Handling

All event listeners are registered once, inside `bindEvents()`, called from the `DOMContentLoaded` handler.

### Event delegation pattern

For dynamically rendered elements (entry cards, delete buttons), use **event delegation** on the stable container rather than attaching listeners to individual elements:

```js
// ✅ Correct — listener on stable parent
document.getElementById('history-list').addEventListener('click', (e) => {
  if (e.target.matches('.delete-btn')) {
    handleDelete(e.target.dataset.id);
  }
  if (e.target.closest('.entry-card')) {
    handleEditOpen(e.target.closest('.entry-card').dataset.id);
  }
});

// ❌ Wrong — listeners on dynamic children, lost after re-render
document.querySelectorAll('.delete-btn').forEach(btn => {
  btn.addEventListener('click', handleDelete);
});
```

### Event → handler map

| Trigger | Handler | Action |
|---|---|---|
| Mood button click | `handleMoodSelect(mood)` | Sets `state.selectedMood`, updates button active states |
| "Save Entry" click | `handleSave()` | Validates, builds Entry, calls `addOrUpdateEntry`, re-renders, shows toast |
| History card click | `handleEditOpen(id)` | Sets `state.editingId`, calls `renderModal()` |
| Modal "Update" click | `handleEditSave()` | Updates entry, closes modal, re-renders |
| Modal close / backdrop click | `closeModal()` | Clears modal DOM and `state.editingId` |
| Delete button click | `handleDelete(id)` | Confirms, calls `deleteEntry`, re-renders |
| "Export" click | `handleExport()` | Serializes entries, triggers file download |
| "Import" click | `handleImport()` | Opens file picker, reads JSON, merges entries |
| "Clear All" click | `handleClearAll()` | Confirms, wipes localStorage, resets state, re-renders |
| Notes textarea input | inline | Updates live character counter |

---

## 9. Module Map (`app.js`)

`app.js` is a single file organized into clearly labeled sections with banner comments. The sections must appear in this order:

```js
// ============================================================
// === CONSTANTS
// ============================================================
// MOOD_OPTIONS array, STORAGE_KEY string, TODAY helper

// ============================================================
// === STORAGE
// ============================================================
// getEntries, saveEntries, getEntryByDate, addOrUpdateEntry, deleteEntry

// ============================================================
// === STATE
// ============================================================
// state object declaration and initState()

// ============================================================
// === RENDER
// ============================================================
// renderHistory, renderStats, renderWeekStrip, renderModal,
// closeModal, showToast, render (calls all render fns)

// ============================================================
// === EVENT HANDLERS
// ============================================================
// handleMoodSelect, handleSave, handleEditOpen, handleEditSave,
// handleDelete, handleExport, handleImport, handleClearAll

// ============================================================
// === INIT
// ============================================================
// bindEvents(), DOMContentLoaded entry point
```

**No function should be defined in a section other than its own.** For example, `renderHistory` must not appear inside an event handler.

---

## 10. HTML Structure

`index.html` provides the static skeleton. JavaScript populates the `[data-render]` containers; it does not create top-level sections.

```html
<body>
  <div id="app">

    <!-- Fixed header -->
    <header id="site-header">
      <h1>Mood Tracker</h1>
    </header>

    <main>

      <!-- Section 1: Today's entry form -->
      <section id="log-section" aria-label="Log today's mood">
        <div id="mood-picker">
          <!-- 5 mood buttons, static HTML -->
          <button class="mood-btn" data-mood="great" aria-label="Great">😄 Great</button>
          <!-- ... -->
        </div>
        <div id="notes-field">
          <textarea id="notes-input" maxlength="280" placeholder="How are you feeling? (optional)"></textarea>
          <span id="char-count">0 / 280</span>
        </div>
        <button id="save-btn">Save Entry</button>
      </section>

      <!-- Section 2: Weekly strip -->
      <section id="week-section" aria-label="This week">
        <h2>This Week</h2>
        <div id="week-strip"><!-- rendered by renderWeekStrip() --></div>
      </section>

      <!-- Section 3: Stats -->
      <section id="stats-section" aria-label="Summary">
        <div id="stats-panel"><!-- rendered by renderStats() --></div>
      </section>

      <!-- Section 4: History -->
      <section id="history-section" aria-label="Mood history">
        <h2>History</h2>
        <div id="history-list"><!-- rendered by renderHistory() --></div>
      </section>

      <!-- Section 5: Data management -->
      <section id="data-section" aria-label="Data management">
        <button id="export-btn">Export Data</button>
        <button id="import-btn">Import Data</button>
        <input id="import-input" type="file" accept=".json" hidden>
        <button id="clear-btn">Clear All Data</button>
      </section>

    </main>

    <!-- Modal (hidden by default) -->
    <div id="modal-container" role="dialog" aria-modal="true" aria-label="Edit entry" hidden>
      <!-- rendered by renderModal() -->
    </div>

    <!-- Toast notification -->
    <div id="toast" role="status" aria-live="polite"></div>

  </div>

  <script src="./app.js"></script>
</body>
```

**Rules:**
- All `id` attributes used as render targets are present in static HTML — JavaScript never creates top-level containers.
- Dynamic content is injected only into the designated containers listed above.
- The `<script>` tag is at the bottom of `<body>`, not in `<head>`.

---

## 11. CSS Architecture

`style.css` is organized into sections in this order:

```css
/* 1. CSS Custom Properties (design tokens) */
:root { --bg: ...; --accent: ...; /* etc */ }

/* 2. Reset & Base */
*, *::before, *::after { box-sizing: border-box; }
body { ... }

/* 3. Layout */
#app, main, sections ...

/* 4. Typography */
h1, h2, p, label ...

/* 5. Components — Mood Picker */
.mood-btn, .mood-btn.active ...

/* 6. Components — Entry Cards */
.entry-card, .entry-card__date, .entry-card__mood ...

/* 7. Components — Modal */
#modal-container, .modal-inner ...

/* 8. Components — Toast */
#toast, #toast.visible ...

/* 9. Components — Stats & Week Strip */
#week-strip, .week-day, #stats-panel ...

/* 10. Components — Data Management */
#data-section, #export-btn, #clear-btn ...

/* 11. Animations & Transitions */
@keyframes fadeIn, slideUp ...

/* 12. Responsive (Mobile) */
@media (max-width: 600px) { ... }

/* 13. Reduced Motion */
@media (prefers-reduced-motion: reduce) { ... }
```

### Design token usage

All colors, font sizes, spacing, and border radii are expressed as `var(--token-name)`. Magic numbers are forbidden. If a value is used more than once, it must become a CSS variable.

---

## 12. Key Algorithms

### One-entry-per-day enforcement

```
On save:
  today = getCurrentDateString()   // "YYYY-MM-DD"
  existing = getEntryByDate(today)
  if existing:
    show confirmation: "You already logged today. Update your entry?"
    if confirmed → addOrUpdateEntry({ ...newEntry, id: existing.id, createdAt: existing.createdAt })
  else:
    addOrUpdateEntry(newEntry)
```

### Weekly strip generation

```
strip = []
for i in 0..6:
  date = today minus i days   // produces "YYYY-MM-DD" strings
  entry = getEntryByDate(date)
  strip.push(entry ? entry.emoji : "○")
render strip in reverse (so index 0 = oldest on left)
```

### Most frequent mood calculation

```
counts = {}
for entry in state.entries:
  counts[entry.mood] = (counts[entry.mood] ?? 0) + 1
topMood = key of counts with highest value
// Tie-break: first encountered in the MOOD_OPTIONS order
```

### Import merge logic

```
existing = getEntries()
imported = JSON.parse(fileContents)
merged = { ...keyBy(existing, 'date') }
for entry in imported:
  if merged[entry.date] exists:
    keep whichever has the later updatedAt timestamp
  else:
    merged[entry.date] = entry
saveEntries(Object.values(merged))
```

### Export

```
entries = getEntries()
blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
filename = `mood-tracker-export-${today}.json`
trigger anchor download
```

---

## 13. Error Handling Strategy

| Scenario | Handling |
|---|---|
| `localStorage` unavailable (private browsing, quota exceeded) | Wrap all storage calls in `try/catch`; show an inline warning banner; app still renders (read-only mode with empty state) |
| Malformed JSON in localStorage | `getEntries()` catches parse errors and returns `[]`; does not throw |
| Import file is not valid JSON | Show toast error: "Could not read file — make sure it's a valid export" |
| Import file has no valid entries | Show toast: "No entries found in file" |
| `crypto.randomUUID()` unavailable | Fall back to `Date.now().toString() + Math.random().toString(36).slice(2)` |
| User deletes entry that no longer exists | `deleteEntry()` is a no-op; no error thrown |

The app must **never throw an unhandled exception** to the console during normal usage.

---

## 14. Constraints & Tradeoffs

| Decision | Rationale |
|---|---|
| Vanilla JS, no framework | Zero build complexity; deploys as static files; no dependency rot; fully auditable |
| Single `localStorage` key | Simplifies export/import and avoids key-sync bugs; acceptable for the data volume |
| Full DOM re-renders | Eliminates state/DOM sync bugs; negligible performance cost at this scale |
| No dark mode | Keeps CSS scope tight; the warm palette is core to the journaling identity |
| No ES modules | Avoids CORS errors when opening as `file://` URL locally; one `<script>` tag is sufficient at this scale |
| `innerHTML` for rendering | Acceptable here because all interpolated data is user-controlled (no XSS surface from external input); sanitize notes with `textContent` inside cards if rendered as text nodes |
| No service worker / offline caching | Out of scope; the app already works offline since it has no network dependencies after initial load |

---

## 15. Extension Points

If the app grows, here is where to add things:

| Feature | Where to add it |
|---|---|
| Dark mode | Add `[data-theme="dark"]` CSS overrides; toggle via a `<button>` that sets `document.body.dataset.theme` |
| More mood granularity (1–10 scale) | Extend `MOOD_OPTIONS` constant; update Entry schema; add a slider component in `#log-section` |
| Tags / categories | Add `tags: string[]` to Entry schema; add tag filter UI above `#history-list`; filter in `renderHistory()` |
| Charts / trends | Add a `<canvas>` element to `#stats-section`; draw with the Canvas 2D API (no library needed for simple bar/line charts) |
| Reminders / notifications | Add a `Notification.requestPermission()` flow in a new `#settings-section`; use `localStorage` to store reminder time preference |
| Multiple users / profiles | Add a `profileId` field to every Entry; store active profile in a separate `localStorage` key; add a profile switcher to the header |
| Cloud sync | Introduce a `sync.js` module that mirrors `saveEntries()` to a chosen backend; keep the local-first storage layer unchanged |
