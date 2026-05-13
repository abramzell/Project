(() => {
  "use strict";

  // === STORAGE ===
  const STORAGE_KEY = "moodtracker_entries";

  function getEntries() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function getEntryByDate(date) {
    const matches = getEntries().filter((entry) => entry.date === date);
    if (matches.length === 0) return undefined;
    return matches.reduce((latest, current) => {
      if (!latest) return current;
      const latestStamp = latest.updatedAt || latest.createdAt || "";
      const currentStamp = current.updatedAt || current.createdAt || "";
      return currentStamp > latestStamp ? current : latest;
    }, null);
  }

  function addOrUpdateEntry(entry) {
    const entries = [...getEntries()];
    const index = entries.findIndex((current) => current.id === entry.id);

    if (index >= 0) {
      const existing = entries[index];
      entries[index] = {
        ...existing,
        ...entry,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: entry.updatedAt || new Date().toISOString(),
      };
    } else {
      entries.push({ ...entry });
    }

    saveEntries(entries);
    return entries;
  }

  function deleteEntry(id) {
    const updatedEntries = getEntries().filter((entry) => entry.id !== id);
    saveEntries(updatedEntries);
    return updatedEntries;
  }

  window.getEntries = getEntries;
  window.saveEntries = saveEntries;
  window.getEntryByDate = getEntryByDate;
  window.addOrUpdateEntry = addOrUpdateEntry;
  window.deleteEntry = deleteEntry;

  // === STATE ===
  const MOODS = [
    { mood: "great", emoji: "😄", label: "Great" },
    { mood: "good", emoji: "🙂", label: "Good" },
    { mood: "okay", emoji: "😐", label: "Okay" },
    { mood: "low", emoji: "😕", label: "Low" },
    { mood: "rough", emoji: "😢", label: "Rough" },
  ];

  const state = {
    entries: [],
    selectedMood: null,
    editingId: null,
    editSelectedMood: null,
    toastTimer: null,
  };

  const ui = {};

  // === RENDER ===
  function getTodayDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDay(dateString) {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatMonthHeading(dateString) {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }

  function getMoodByKey(mood) {
    return MOODS.find((item) => item.mood === mood);
  }

  function generateEntryId() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  function sortEntriesNewest(entries) {
    return [...entries].sort((a, b) => {
      const dateComparison = b.date.localeCompare(a.date);
      if (dateComparison !== 0) return dateComparison;
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });
  }

  function renderMoodButtons(container, selectedMood) {
    const buttons = container.querySelectorAll(".mood-btn");
    buttons.forEach((button) => {
      const isSelected = button.dataset.mood === selectedMood;
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });
  }

  function renderWeeklySummary() {
    const today = new Date();
    const entryMap = state.entries.reduce((map, entry) => {
      const existing = map.get(entry.date);
      if (!existing) {
        map.set(entry.date, entry);
        return map;
      }

      const existingStamp = existing.updatedAt || existing.createdAt || "";
      const candidateStamp = entry.updatedAt || entry.createdAt || "";
      if (candidateStamp > existingStamp) {
        map.set(entry.date, entry);
      }

      return map;
    }, new Map());
    const cells = [];

    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - offset);
      const isoDate = day.toISOString().slice(0, 10);
      const match = entryMap.get(isoDate);
      const emoji = match ? match.emoji : "○";
      const label = match ? `${match.label} mood` : "No entry";
      const weekday = day.toLocaleDateString(undefined, { weekday: "short" });

      cells.push(`
        <div class="week-day" aria-label="${weekday}: ${label}">
          <span>${emoji}</span>
          <small>${weekday}</small>
        </div>
      `);
    }

    ui.weeklySummary.innerHTML = cells.join("");
  }

  function renderStats() {
    const total = state.entries.length;
    ui.totalEntries.textContent = String(total);

    if (total === 0) {
      ui.mostFrequent.textContent = "—";
      return;
    }

    const countByMood = state.entries.reduce((acc, entry) => {
      acc[entry.mood] = (acc[entry.mood] || 0) + 1;
      return acc;
    }, {});

    const [winningMood] = Object.entries(countByMood).sort((a, b) => b[1] - a[1])[0];
    const moodMeta = getMoodByKey(winningMood);
    ui.mostFrequent.textContent = moodMeta ? `${moodMeta.emoji} ${moodMeta.label}` : "—";
  }

  function renderHistory() {
    const sorted = sortEntriesNewest(state.entries);

    if (sorted.length === 0) {
      ui.historyList.innerHTML = '<p class="empty-state">No entries yet. Add your first mood above.</p>';
      return;
    }

    const grouped = sorted.reduce((acc, entry) => {
      const monthKey = formatMonthHeading(entry.date);
      acc[monthKey] = acc[monthKey] || [];
      acc[monthKey].push(entry);
      return acc;
    }, {});

    const markup = Object.entries(grouped)
      .map(([month, entries]) => {
        const cards = entries
          .map((entry) => {
            const notesHtml = entry.notes
              ? `<p>${escapeHtml(entry.notes)}</p>`
              : '<p class="entry-meta">No notes</p>';

            return `
              <article
                class="entry-card"
                data-entry-id="${entry.id}"
                role="button"
                tabindex="0"
                aria-label="Edit entry for ${formatDay(entry.date)}"
              >
                <div class="entry-card-top">
                  <strong>${entry.emoji} ${entry.label}</strong>
                  <span class="entry-meta">${formatDay(entry.date)}</span>
                </div>
                ${notesHtml}
                <div>
                  <button type="button" class="delete-btn" data-delete-id="${entry.id}" aria-label="Delete entry for ${formatDay(entry.date)}">Delete</button>
                </div>
              </article>
            `;
          })
          .join("");

        return `
          <section class="month-group" aria-label="${month}">
            <h3>${month}</h3>
            ${cards}
          </section>
        `;
      })
      .join("");

    ui.historyList.innerHTML = markup;
  }

  function renderAll() {
    renderMoodButtons(ui.moodGrid, state.selectedMood);
    renderHistory();
    renderWeeklySummary();
    renderStats();
  }

  function setMainCharCount() {
    ui.notesCount.textContent = `${ui.notes.value.length} / 280`;
  }

  function setEditCharCount() {
    ui.editNotesCount.textContent = `${ui.editNotes.value.length} / 280`;
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("show");

    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
    }

    state.toastTimer = setTimeout(() => {
      ui.toast.classList.remove("show");
    }, 1900);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function openEditModal(entry) {
    state.editingId = entry.id;
    state.editSelectedMood = entry.mood;
    ui.editNotes.value = entry.notes || "";
    setEditCharCount();
    renderMoodButtons(ui.editMoodGrid, state.editSelectedMood);
    ui.editModal.classList.remove("hidden");
    ui.cancelEditBtn.focus();
  }

  function closeEditModal() {
    state.editingId = null;
    state.editSelectedMood = null;
    ui.editForm.reset();
    setEditCharCount();
    renderMoodButtons(ui.editMoodGrid, null);
    ui.editModal.classList.add("hidden");
  }

  function mergeImportedEntries(importedEntries) {
    const mergedByKey = new Map();

    const allEntries = [...state.entries, ...importedEntries]
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => normalizeEntry(entry));

    allEntries.forEach((candidate) => {
      const key = candidate.id;
      const existing = mergedByKey.get(key);

      if (!existing) {
        mergedByKey.set(key, candidate);
        return;
      }

      const existingStamp = existing.updatedAt || existing.createdAt || "";
      const candidateStamp = candidate.updatedAt || candidate.createdAt || "";
      if (candidateStamp > existingStamp) {
        mergedByKey.set(key, candidate);
      }
    });

    return sortEntriesNewest([...mergedByKey.values()]);
  }

  function normalizeEntry(entry, fallback = {}) {
    const moodMeta = getMoodByKey(entry.mood) || getMoodByKey(fallback.mood) || MOODS[0];
    const date = typeof entry.date === "string" ? entry.date : getTodayDate();
    const createdAt = entry.createdAt || fallback.createdAt || `${date}T00:00:00.000Z`;
    const updatedAt = entry.updatedAt || fallback.updatedAt || createdAt;
    const notes = typeof entry.notes === "string" ? entry.notes.slice(0, 280) : "";
    const deterministicId = `import-${hashString(
      `${date}|${moodMeta.mood}|${notes}|${createdAt}|${updatedAt}`
    )}`;

    return {
      id: entry.id || fallback.id || deterministicId,
      date,
      mood: moodMeta.mood,
      emoji: moodMeta.emoji,
      label: moodMeta.label,
      notes,
      createdAt,
      updatedAt,
    };
  }

  // === EVENT HANDLERS ===
  function handleMoodSelection(event, key) {
    const targetButton = event.target.closest(".mood-btn");
    if (!targetButton) return;

    if (key === "main") {
      state.selectedMood = targetButton.dataset.mood;
      renderMoodButtons(ui.moodGrid, state.selectedMood);
    } else {
      state.editSelectedMood = targetButton.dataset.mood;
      renderMoodButtons(ui.editMoodGrid, state.editSelectedMood);
    }
  }

  function handleSaveEntry(event) {
    event.preventDefault();

    if (!state.selectedMood) {
      showToast("Select a mood first.");
      return;
    }

    const moodMeta = getMoodByKey(state.selectedMood);
    const today = getTodayDate();
    const now = new Date().toISOString();

    const entry = {
      id: generateEntryId(),
      date: today,
      mood: moodMeta.mood,
      emoji: moodMeta.emoji,
      label: moodMeta.label,
      notes: ui.notes.value.trim(),
      createdAt: now,
      updatedAt: now,
    };

    addOrUpdateEntry(entry);
    state.entries = [...getEntries()];
    renderAll();
    ui.entryForm.reset();
    setMainCharCount();
    state.selectedMood = null;
    renderMoodButtons(ui.moodGrid, null);
    showToast("Entry saved.");
  }

  function handleHistoryClick(event) {
    const deleteButton = event.target.closest(".delete-btn");
    if (deleteButton) {
      event.stopPropagation();
      const { deleteId } = deleteButton.dataset;
      const currentEntry = state.entries.find((entry) => entry.id === deleteId);
      const message = currentEntry
        ? `Delete your ${currentEntry.label.toLowerCase()} mood entry for ${formatDay(currentEntry.date)}?`
        : "Delete this entry?";

      if (window.confirm(message)) {
        deleteEntry(deleteId);
        state.entries = [...getEntries()];
        renderAll();
        showToast("Entry deleted.");
      }

      return;
    }

    const entryCard = event.target.closest(".entry-card");
    if (!entryCard) return;

    const selected = state.entries.find((entry) => entry.id === entryCard.dataset.entryId);
    if (selected) {
      openEditModal(selected);
    }
  }

  function handleHistoryKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const entryCard = event.target.closest(".entry-card");
    if (!entryCard) return;
    event.preventDefault();
    entryCard.click();
  }

  function handleEditSubmit(event) {
    event.preventDefault();

    if (!state.editingId || !state.editSelectedMood) {
      showToast("Choose a mood to update.");
      return;
    }

    const existing = state.entries.find((entry) => entry.id === state.editingId);
    if (!existing) {
      closeEditModal();
      return;
    }

    const moodMeta = getMoodByKey(state.editSelectedMood);
    const updatedEntry = {
      ...existing,
      mood: moodMeta.mood,
      emoji: moodMeta.emoji,
      label: moodMeta.label,
      notes: ui.editNotes.value.trim(),
      updatedAt: new Date().toISOString(),
    };

    addOrUpdateEntry(updatedEntry);
    state.entries = [...getEntries()];
    closeEditModal();
    renderAll();
    showToast("Entry updated.");
  }

  function handleExport() {
    const entries = sortEntriesNewest(state.entries);
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = getTodayDate().replaceAll("-", "");

    anchor.href = url;
    anchor.download = `moodtracker-entries-${stamp}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("Data exported.");
  }

  async function handleImport(event) {
    const [file] = event.target.files || [];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        throw new Error("Imported JSON must be an array.");
      }

      const merged = mergeImportedEntries(parsed);
      saveEntries(merged);
      state.entries = [...getEntries()];
      renderAll();
      showToast("Data imported.");
    } catch {
      showToast("Import failed. Please choose a valid JSON file.");
    } finally {
      ui.importInput.value = "";
    }
  }

  function handleClearAll() {
    if (!window.confirm("Clear all mood entries? This cannot be undone.")) {
      return;
    }

    saveEntries([]);
    state.entries = [];
    renderAll();
    showToast("All data cleared.");
  }

  // === INIT ===
  document.addEventListener("DOMContentLoaded", () => {
    ui.entryForm = document.querySelector("#entry-form");
    ui.moodGrid = document.querySelector("#mood-grid");
    ui.notes = document.querySelector("#notes");
    ui.notesCount = document.querySelector("#notes-count");
    ui.weeklySummary = document.querySelector("#weekly-summary");
    ui.totalEntries = document.querySelector("#total-entries");
    ui.mostFrequent = document.querySelector("#most-frequent");
    ui.historyList = document.querySelector("#history-list");
    ui.exportBtn = document.querySelector("#export-btn");
    ui.importBtn = document.querySelector("#import-btn");
    ui.importInput = document.querySelector("#import-input");
    ui.clearBtn = document.querySelector("#clear-btn");
    ui.toast = document.querySelector("#toast");

    ui.editModal = document.querySelector("#edit-modal");
    ui.editForm = document.querySelector("#edit-form");
    ui.editMoodGrid = document.querySelector("#edit-mood-grid");
    ui.editNotes = document.querySelector("#edit-notes");
    ui.editNotesCount = document.querySelector("#edit-notes-count");
    ui.cancelEditBtn = document.querySelector("#cancel-edit-btn");

    state.entries = [...getEntries()];

    ui.entryForm.addEventListener("submit", handleSaveEntry);
    ui.moodGrid.addEventListener("click", (event) => handleMoodSelection(event, "main"));
    ui.notes.addEventListener("input", setMainCharCount);

    ui.historyList.addEventListener("click", handleHistoryClick);
    ui.historyList.addEventListener("keydown", handleHistoryKeydown);

    ui.editMoodGrid.addEventListener("click", (event) => handleMoodSelection(event, "edit"));
    ui.editForm.addEventListener("submit", handleEditSubmit);
    ui.editNotes.addEventListener("input", setEditCharCount);
    ui.cancelEditBtn.addEventListener("click", closeEditModal);
    ui.editModal.addEventListener("click", (event) => {
      if (event.target === ui.editModal) closeEditModal();
    });

    ui.exportBtn.addEventListener("click", handleExport);
    ui.importBtn.addEventListener("click", () => ui.importInput.click());
    ui.importInput.addEventListener("change", handleImport);
    ui.clearBtn.addEventListener("click", handleClearAll);

    setMainCharCount();
    setEditCharCount();
    renderAll();
  });
})();
