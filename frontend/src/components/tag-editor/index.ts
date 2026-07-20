import { attachTooltip } from "Components/tooltip";
import { logAnalyticsEvent } from "../../firebase";

/** Max tags per visit — must match backend MaxTagsPerVisit / api.md. */
export const MAX_TAGS_PER_VISIT = 10;

/** Minimum characters per tag (tag-editor.md). */
export const MIN_TAG_LENGTH = 2;

/** Alphabetically sorted preset suggestions (tag-editor.md). */
export const SUGGESTED_TAGS: readonly string[] = [
  "adventure",
  "backpacking",
  "beach",
  "brewery",
  "camping",
  "cruise",
  "culture",
  "desert",
  "diving",
  "festival",
  "fishing",
  "food",
  "glacier",
  "hiking",
  "holiday",
  "honeymoon",
  "island",
  "jungle",
  "kayaking",
  "lakes",
  "meditation",
  "monastery",
  "mountains",
  "museum",
  "nightlife",
  "photography",
  "pilgrimage",
  "rainforest",
  "relaxation",
  "resort",
  "river",
  "roadtrip",
  "ruins",
  "safari",
  "sailing",
  "shopping",
  "skiing",
  "snorkeling",
  "spa",
  "surfing",
  "temples",
  "trekking",
  "tropical",
  "vineyard",
  "volcano",
  "waterfalls",
  "wellness",
  "wildlife",
  "windsurfing",
  "winter",
];

const INPUT_TOOLTIP =
  "Add tags to describe the visit. These tags can later be used in searches.";

const HINT_TEXT = "You can define tags to describe your trip.";

export interface TagEditorControl {
  element: HTMLElement;
  getTags(): string[];
  setTags(tags: string[]): void;
}

export function sanitizeTagInput(raw: string): string {
  return raw
    .toLowerCase()
    .split("")
    .filter((ch) => ch >= "a" && ch <= "z")
    .join("");
}

function isValidTagToken(s: string): boolean {
  return s.length >= MIN_TAG_LENGTH && /^[a-z]+$/.test(s);
}

export function createTagEditor(): TagEditorControl {
  const tags: string[] = [];

  const root = document.createElement("div");
  root.className = "tag-editor";

  const limitMsg = document.createElement("p");
  limitMsg.className = "tag-editor__limit-msg";
  limitMsg.hidden = true;
  limitMsg.textContent = `You can add at most ${MAX_TAGS_PER_VISIT} tags per visit.`;

  const mainCol = document.createElement("div");
  mainCol.className = "tag-editor__main";

  const inputBlock = document.createElement("div");
  inputBlock.className = "tag-editor__input-block";

  const inputRow = document.createElement("div");
  inputRow.className = "tag-editor__input-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "tag-editor__input";
  input.placeholder = "Define tags";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.maxLength = 64;
  input.setAttribute("aria-label", "Define tags");

  attachTooltip(input, INPUT_TOOLTIP);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "add-visit-form__add-btn tag-editor__add-btn";
  addBtn.textContent = "Add tag";

  const suggestionsPanel = document.createElement("div");
  suggestionsPanel.className = "country-dropdown__panel tag-editor__suggestions-panel";
  suggestionsPanel.hidden = true;
  suggestionsPanel.setAttribute("role", "listbox");

  const suggestionsList = document.createElement("div");
  suggestionsList.className = "country-dropdown__list tag-editor__suggestions-list";

  suggestionsPanel.appendChild(suggestionsList);

  inputRow.appendChild(input);
  inputRow.appendChild(addBtn);

  const hintEl = document.createElement("p");
  hintEl.className = "tag-editor__hint";
  hintEl.textContent = HINT_TEXT;

  inputBlock.appendChild(inputRow);
  inputBlock.appendChild(suggestionsPanel);

  mainCol.appendChild(inputBlock);
  mainCol.appendChild(hintEl);

  const pillsWrap = document.createElement("div");
  pillsWrap.className = "tag-editor__pills";

  root.appendChild(limitMsg);
  root.appendChild(mainCol);
  root.appendChild(pillsWrap);

  function inputHasFocus(): boolean {
    return document.activeElement === input;
  }

  function atCap(): boolean {
    return tags.length >= MAX_TAGS_PER_VISIT;
  }

  function hasValidAddInput(): boolean {
    const raw = sanitizeTagInput(input.value);
    return isValidTagToken(raw);
  }

  function renderPills(): void {
    pillsWrap.replaceChildren();
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const pill = document.createElement("span");
      pill.className = "tag-editor__pill";
      const label = document.createElement("span");
      label.className = "tag-editor__pill-label";
      label.textContent = tag;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "tag-editor__pill-remove";
      removeBtn.setAttribute("aria-label", `Remove tag ${tag}`);
      removeBtn.textContent = "×";
      const tagRemoved = tag;
      removeBtn.addEventListener("click", () => {
        if (pill.classList.contains("tag-editor__pill--removing")) {
          return;
        }
        pill.classList.add("tag-editor__pill--removing");

        let finalized = false;
        let fallbackTimer: number | null = null;

        function finalizeRemove(): void {
          if (finalized) {
            return;
          }
          finalized = true;
          pill.removeEventListener("transitionend", onTransitionEnd);
          if (fallbackTimer !== null) {
            window.clearTimeout(fallbackTimer);
            fallbackTimer = null;
          }
          const j = tags.indexOf(tagRemoved);
          if (j >= 0) {
            tags.splice(j, 1);
            logAnalyticsEvent("delete_tag", {});
          }
          syncUi();
        }

        function onTransitionEnd(e: TransitionEvent): void {
          if (e.propertyName !== "opacity") {
            return;
          }
          finalizeRemove();
        }

        pill.addEventListener("transitionend", onTransitionEnd);
        fallbackTimer = window.setTimeout(finalizeRemove, 450);
      });
      pill.appendChild(label);
      pill.appendChild(removeBtn);
      pillsWrap.appendChild(pill);
    }
  }

  function getSuggestionsToShow(): string[] {
    if (atCap()) {
      return [];
    }
    const prefix = sanitizeTagInput(input.value);
    const out: string[] = [];
    if (prefix.length === 0) {
      if (!inputHasFocus()) {
        return [];
      }
      for (const t of SUGGESTED_TAGS) {
        if (!tags.includes(t)) {
          out.push(t);
        }
      }
      return out;
    }
    for (const t of SUGGESTED_TAGS) {
      if (!t.startsWith(prefix)) {
        continue;
      }
      if (tags.includes(t)) {
        continue;
      }
      out.push(t);
    }
    return out;
  }

  function refreshSuggestions(): void {
    if (atCap()) {
      suggestionsPanel.hidden = true;
      suggestionsList.replaceChildren();
      return;
    }
    const list = getSuggestionsToShow();
    if (list.length === 0) {
      suggestionsPanel.hidden = true;
      suggestionsList.replaceChildren();
      return;
    }
    suggestionsPanel.hidden = false;
    suggestionsList.replaceChildren();
    for (const t of list) {
      const item = document.createElement("div");
      item.className =
        "country-dropdown__item country-dropdown__item--enter tag-editor__suggestion-item";
      item.setAttribute("role", "option");
      const inner = document.createElement("span");
      inner.className = "tag-editor__suggestion-label";
      inner.textContent = t;
      item.appendChild(inner);
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
      });
      item.addEventListener("click", () => {
        tryAddTag(t, "predefined");
      });
      suggestionsList.appendChild(item);
      requestAnimationFrame(() => item.classList.add("visible"));
    }
  }

  function tryAddTag(candidate: string, addSource: "custom" | "predefined"): boolean {
    if (!isValidTagToken(candidate) || atCap()) {
      return false;
    }
    if (tags.includes(candidate)) {
      return false;
    }
    tags.push(candidate);
    logAnalyticsEvent("add_tag", { type: addSource });
    input.value = "";
    input.blur();
    syncUi();
    return true;
  }

  function tryAddFromInput(): void {
    if (atCap()) return;
    const raw = sanitizeTagInput(input.value);
    if (!isValidTagToken(raw)) return;
    tryAddTag(raw, "custom");
  }

  function syncUi(): void {
    const cap = atCap();
    limitMsg.hidden = !cap;
    addBtn.disabled = cap || !hasValidAddInput();
    renderPills();
    refreshSuggestions();
  }

  input.addEventListener("input", () => {
    input.value = sanitizeTagInput(input.value);
    syncUi();
  });

  input.addEventListener("focus", () => {
    refreshSuggestions();
  });

  input.addEventListener("blur", () => {
    window.requestAnimationFrame(() => {
      refreshSuggestions();
    });
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      tryAddFromInput();
    }
    if (e.key === "Escape") {
      suggestionsPanel.hidden = true;
    }
  });

  addBtn.addEventListener("click", () => {
    tryAddFromInput();
  });

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target as Node)) {
      suggestionsPanel.hidden = true;
    }
  });

  syncUi();

  return {
    element: root,
    getTags(): string[] {
      return [...tags];
    },
    setTags(nextTags: string[]): void {
      tags.splice(0, tags.length);
      for (const t of nextTags ?? []) {
        const raw = sanitizeTagInput(`${t ?? ""}`);
        if (!isValidTagToken(raw)) continue;
        if (tags.includes(raw)) continue;
        if (tags.length >= MAX_TAGS_PER_VISIT) break;
        tags.push(raw);
      }
      syncUi();
    },
  };
}
