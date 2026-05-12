# AGENTS.md — Mood Tracker App

This file instructs GitHub Copilot (and other AI coding agents) how to build, extend, and maintain this project. Follow every section carefully before writing any code.

---

## Project Overview

**App name:** Mood Tracker
**Goal:** A personal daily mood tracking web app that lets users log their mood, add optional notes, and review their history over time.
**Hosting:** GitHub Pages (static site — no server, no backend)
**Storage:** Browser `localStorage` (all data stays on the user's device)
**Stack:** Vanilla HTML + CSS + JavaScript (no frameworks, no build step, no `node_modules`)

---

## Repository Structure

```
/
├── index.html          # Single-page app shell
├── style.css           # All styles
├── app.js              # All JavaScript logic
├── AGENTS.md           # This file
└── README.md           # Human-readable project docs
```

Keep everything in these four files. Do **not** introduce a build pipeline, bundler, or package manager unless the user explicitly asks.

---

## Functional Requirements

### 1. Log a Mood Entry
- Display a mood selector with at least 5 mood options using emoji + label:
  - 😄 Great, 🙂 Good, 😐 Okay, 😕 Low, 😢 Rough
- Include an optional free-text notes field (max 280 characters, show live character count)
- A "Save Entry" button that writes the entry to `localStorage`
- Only allow one entry per calendar day; if one already exists, offer to **update** it instead
- Show a brief confirmation animation/message after saving

### 2. Mood History View
- Display all past entries in reverse-chronological order (newest first)
- Each entry card shows: date, mood emoji + label, notes (if any), and a delete button
- Group entries by month (e.g., "May 2026")
- Clicking a past entry opens it in an edit/update modal

### 3. Mood Summary / Stats
- Show a simple weekly summary: the last 7 days as a row of emoji (empty circle `○` for days with no entry)
- Show a count of total entries logged
- Show the user's most frequent mood across all time

### 4. Data Management
- "Export Data" button: downloads all entries as a formatted `.json` file
- "Import Data" button: accepts a `.json` file and merges entries (newer date wins on conflict)
- "Clear All Data" button: prompts a confirmation dialog before deleting everything

---

## Data Model

Store a single key in `localStorage`:

```
key: "moodtracker_entries"
value: JSON string of an array of Entry objects
```

### Entry Object Schema

```js
{
  id: string,          // crypto.randomUUID() or Date.now().toString()
  date: string,        // ISO 8601 date only: "YYYY-MM-DD"
  mood: string,        // one of: "great" | "good" | "okay" | "low" | "rough"
  emoji: string,       // corresponding emoji character
  label: string,       // human-readable label, e.g. "Great"
  notes: string,       // optional free text, default ""
  createdAt: string,   // full ISO 8601 timestamp
  updatedAt: string    // full ISO 8601 timestamp, same as createdAt initially
}
```

### Storage Helper Functions (in `app.js`)

Implement and export/use these functions:

```js
function getEntries()           // returns parsed array from localStorage, or []
function saveEntries(entries)   // JSON.stringifies and writes array to localStorage
function getEntryByDate(date)   // returns entry for "YYYY-MM-DD" or undefined
function addOrUpdateEntry(entry) // upserts by date field
function deleteEntry(id)        // removes entry with matching id
```

---

## UI & Design Requirements

### Aesthetic Direction
- **Theme:** Soft, warm, journaling aesthetic — like a paper diary crossed with a calm wellness app
- **Color palette:** Use CSS custom properties (variables). Suggested palette:
  ```css
  --bg:           #fdf6ee;
  --surface:      #fff9f2;
  --border:       #e8d9c5;
  --text-primary: #2d2118;
  --text-muted:   #8a7060;
  --accent:       #c97d4e;
  --accent-light: #f2dece;
  --danger:       #c0392b;
  ```
- **Typography:** Use Google Fonts. Pair `Playfair Display` (headings) with `Lato` or `Source Sans 3` (body). Load via `<link>` in `index.html`.
- **Layout:** Single-column, centered, max-width ~680px, generous padding
- **Mood buttons:** Large tappable tiles arranged in a row or 2×3 grid, with clear selected state (border + background highlight)
- **No dark mode required** — a single warm light theme is sufficient

### Responsiveness
- Must be fully usable on mobile (min supported width: 375px)
- Use CSS Flexbox or Grid; no fixed pixel widths on containers
- Touch targets must be at least 44×44px

### Animations
- Mood button selection: subtle scale + border transition
- Save confirmation: a small toast/snackbar slides up from the bottom
- Entry cards: fade-in on load
- Keep all animations under 300ms and respect `prefers-reduced-motion`

---

## JavaScript Architecture

- No frameworks. Pure ES6+ vanilla JS.
- Use a single `DOMContentLoaded` listener as the entry point in `app.js`
- Separate concerns into clearly commented sections:
  ```
  // === STORAGE ===
  // === STATE ===
  // === RENDER ===
  // === EVENT HANDLERS ===
  // === INIT ===
  ```
- Re-render the history list and stats after every add/update/delete — do not do partial DOM mutations
- Use `structuredClone()` or spread copies when mutating state; never mutate `localStorage` arrays in place

---

## GitHub Pages Deployment

- The app must work by opening `index.html` directly — **no** local server, **no** relative import issues
- All asset paths must be root-relative or same-directory relative (e.g., `./style.css`, `./app.js`)
- Do **not** use ES module `import`/`export` syntax unless all browsers on GitHub Pages support it without a bundler (use a single script file or classic `<script>` tags)
- Add a `<base href>` tag or ensure paths work under a GitHub Pages subdirectory (e.g., `https://username.github.io/repo-name/`)

---

## Accessibility

- All interactive elements must have accessible labels (`aria-label` or visible text)
- Mood buttons must be keyboard-navigable and show a focus ring
- Toast/confirmation messages must use `role="status"` or `aria-live="polite"`
- Color contrast must meet WCAG AA (4.5:1 for normal text)
- Delete confirmation must be a native `confirm()` dialog or a clearly labeled modal — never a silent action

---

## What NOT to Do

- ❌ Do not use React, Vue, Svelte, or any frontend framework
- ❌ Do not introduce `npm`, `package.json`, or any build tooling
- ❌ Do not use `sessionStorage` or cookies — only `localStorage`
- ❌ Do not make any network requests (no analytics, no API calls, no CDN data fetching except Google Fonts)
- ❌ Do not add a backend, database, or authentication
- ❌ Do not use `document.write()`
- ❌ Do not store sensitive data or prompt the user for personally identifying information

---

## README.md Requirements

When generating `README.md`, include:
1. One-sentence description
2. Screenshot placeholder (`![screenshot](screenshot.png)`)
3. Features list
4. How to use locally (just open `index.html`)
5. How data is stored (localStorage, stays on device)
6. How to deploy to GitHub Pages (Settings → Pages → Deploy from branch `main`, root `/`)
7. Export/import instructions
8. License (MIT)

---

## Acceptance Checklist

Before considering any feature complete, verify:

- [ ] Entry saves correctly to `localStorage` and persists on page refresh
- [ ] Duplicate-date logic works (update prompt shown, not silent overwrite)
- [ ] History renders all entries in correct order
- [ ] Delete removes the entry and updates the view
- [ ] Weekly summary reflects real stored data
- [ ] Export produces valid, parseable JSON
- [ ] Import merges without duplicating or crashing
- [ ] App is usable at 375px width on mobile
- [ ] No console errors on load or interaction
- [ ] Works when opened as a local `file://` URL and from GitHub Pages
