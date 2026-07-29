import { openModal } from "Components/modal";
import { errorToast, successToast } from "Components/toast";
import {
  createWishListEditorCell,
  MAX_WISH_LIST_DESCRIPTION_LENGTH,
  type WishListEditorCellHandle,
} from "Components/wish-list-editor-cell";
import { ApiError } from "../../api";
import type { Country } from "../../types/country";
import type { WishListCountry } from "../../types/visit";

const MAX_WISH_LIST_ENTRIES = 10;
const DRAG_MIME = "application/x-wishlist-index";

type WishListApi = {
  getWishList(): Promise<WishListCountry[]>;
  updateWishList(wishList: WishListCountry[]): Promise<WishListCountry[]>;
};

export interface OpenWishListEditorOptions {
  api: WishListApi;
  countries: Country[];
  baseUrl: string;
  onUnauthorized?: () => void;
  onSaved?: (wishList: WishListCountry[]) => void;
}

function cloneList(list: WishListCountry[]): WishListCountry[] {
  return list.map((e) => ({
    countryCode: e.countryCode.toUpperCase(),
    description: e.description?.trim() ? e.description : undefined,
  }));
}

function normalizeEntry(e: WishListCountry): WishListCountry {
  const description = e.description?.trim();
  return {
    countryCode: e.countryCode.toUpperCase(),
    ...(description ? { description } : {}),
  };
}

function listsEqual(a: WishListCountry[], b: WishListCountry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = normalizeEntry(a[i]);
    const right = normalizeEntry(b[i]);
    if (left.countryCode !== right.countryCode) return false;
    if ((left.description ?? "") !== (right.description ?? "")) return false;
  }
  return true;
}

function validateDraft(draft: WishListCountry[]): string | null {
  if (draft.length > MAX_WISH_LIST_ENTRIES) {
    return `At most ${MAX_WISH_LIST_ENTRIES} countries allowed`;
  }
  const seen = new Set<string>();
  for (const e of draft) {
    const code = e.countryCode?.toUpperCase()?.trim();
    if (!code) {
      return "Each entry needs a country";
    }
    if (seen.has(code)) {
      return "Each country may appear only once";
    }
    seen.add(code);
    if ((e.description?.length ?? 0) > MAX_WISH_LIST_DESCRIPTION_LENGTH) {
      return `Descriptions must be at most ${MAX_WISH_LIST_DESCRIPTION_LENGTH} characters`;
    }
  }
  return null;
}

/**
 * Opens the wish list editor (GET on open, PUT on Save).
 * See frontend/spec/components/wish-list-editor.md.
 */
export function openWishListEditor(options: OpenWishListEditorOptions): void {
  const { api, countries, baseUrl, onUnauthorized, onSaved } = options;

  const body = document.createElement("div");
  body.className = "wish-list-editor";

  const intro = document.createElement("p");
  intro.className = "wish-list-editor__intro";
  intro.textContent =
    "Pick up to 10 countries you want to visit. Drag to reorder. Changes save only when you press Save.";
  body.appendChild(intro);

  const listEl = document.createElement("div");
  listEl.className = "wish-list-editor__list";
  body.appendChild(listEl);

  const saveRow = document.createElement("div");
  saveRow.className = "wish-list-editor__save-row";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "wish-list-editor__save-btn primary";
  saveBtn.textContent = "Save changes";
  saveBtn.disabled = true;
  saveRow.appendChild(saveBtn);
  body.appendChild(saveRow);

  const footer = document.createElement("div");
  footer.className = "app-confirm__actions";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "app-confirm__btn secondary";
  closeBtn.textContent = "Close without saving";
  closeBtn.setAttribute("aria-label", "Close without saving");
  footer.appendChild(closeBtn);

  let closeModal: (() => void) | null = null;
  let initial: WishListCountry[] = [];
  let draft: WishListCountry[] = [];
  let saving = false;
  let loaded = false;
  let dragFromIndex: number | null = null;
  const itemHandles: WishListEditorCellHandle[] = [];

  const handleUnauthorized = (): void => {
    onUnauthorized?.();
    errorToast("Session expired");
  };

  const updateSaveEnabled = (): void => {
    saveBtn.disabled = !loaded || saving || listsEqual(draft, initial);
  };

  const setBusy = (busy: boolean): void => {
    saving = busy;
    for (const h of itemHandles) {
      h.setDisabled(busy);
    }
    updateSaveEnabled();
  };

  const excludedForIndex = (index: number): string[] => {
    return draft
      .map((e, i) => (i === index ? "" : e.countryCode))
      .filter(Boolean);
  };

  const renderList = (): void => {
    listEl.replaceChildren();
    itemHandles.length = 0;

    draft.forEach((entry, index) => {
      const cell = createWishListEditorCell({
        mode: "item",
        countries,
        baseUrl,
        countryCode: entry.countryCode,
        description: entry.description ?? "",
        excludedCountryCodes: excludedForIndex(index),
        onChange: (next) => {
          const prevCode = draft[index].countryCode;
          draft[index] = normalizeEntry(next);
          if (prevCode !== draft[index].countryCode) {
            renderList();
          }
          updateSaveEnabled();
        },
        onDelete: () => {
          draft.splice(index, 1);
          renderList();
          updateSaveEnabled();
        },
        onDragStart: (e) => {
          dragFromIndex = index;
          e.dataTransfer?.setData(DRAG_MIME, String(index));
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
          }
          cell.element.classList.add("wish-list-editor-cell--dragging");
        },
      });

      cell.element.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = "move";
        }
        cell.element.classList.add("wish-list-editor-cell--drag-over");
      });
      cell.element.addEventListener("dragleave", () => {
        cell.element.classList.remove("wish-list-editor-cell--drag-over");
      });
      cell.element.addEventListener("drop", (e) => {
        e.preventDefault();
        cell.element.classList.remove("wish-list-editor-cell--drag-over");
        const raw =
          e.dataTransfer?.getData(DRAG_MIME) ||
          (dragFromIndex != null ? String(dragFromIndex) : "");
        const from = Number.parseInt(raw, 10);
        if (Number.isNaN(from) || from === index) {
          dragFromIndex = null;
          return;
        }
        const [moved] = draft.splice(from, 1);
        draft.splice(index, 0, moved);
        dragFromIndex = null;
        renderList();
        updateSaveEnabled();
      });
      cell.element.addEventListener("dragend", () => {
        cell.element.classList.remove("wish-list-editor-cell--dragging");
        dragFromIndex = null;
        listEl
          .querySelectorAll(".wish-list-editor-cell--drag-over")
          .forEach((el) => el.classList.remove("wish-list-editor-cell--drag-over"));
      });

      listEl.appendChild(cell.element);
      itemHandles.push(cell);
    });

    if (draft.length < MAX_WISH_LIST_ENTRIES) {
      const addCell = createWishListEditorCell({
        mode: "add",
        countries,
        baseUrl,
        excludedCountryCodes: draft.map((e) => e.countryCode),
        onAdd: (entry) => {
          const next = normalizeEntry(entry);
          if (draft.some((e) => e.countryCode === next.countryCode)) {
            errorToast("That country is already on your wish list");
            return;
          }
          if (draft.length >= MAX_WISH_LIST_ENTRIES) {
            return;
          }
          draft.push(next);
          renderList();
          updateSaveEnabled();
        },
      });
      listEl.appendChild(addCell.element);
      itemHandles.push(addCell);
    }
  };

  const { close } = openModal({
    title: "Wish list",
    body,
    footer,
    showCloseButton: false,
    footerPlain: true,
    closeOnOutsideClick: true,
  });
  closeModal = () => close("programmatic");
  closeBtn.addEventListener("click", () => close("closeButton"));

  saveBtn.addEventListener("click", async () => {
    if (saving || listsEqual(draft, initial)) return;
    const errMsg = validateDraft(draft);
    if (errMsg) {
      errorToast(errMsg);
      return;
    }
    setBusy(true);
    try {
      const saved = await api.updateWishList(cloneList(draft));
      console.log("Wish list updated", saved.length);
      successToast("Wish list saved");
      onSaved?.(saved);
      closeModal?.();
    } catch (err) {
      console.error("Failed to update wish list", err);
      if (err instanceof ApiError && err.responseCode === 401) {
        handleUnauthorized();
        closeModal?.();
        return;
      }
      errorToast(err instanceof Error ? err.message : "Failed to save wish list");
      setBusy(false);
    }
  });

  void (async () => {
    try {
      const list = await api.getWishList();
      initial = cloneList(list);
      draft = cloneList(list);
      loaded = true;
      renderList();
      updateSaveEnabled();
      console.log("Wish list loaded", draft.length);
    } catch (err) {
      console.error("Failed to load wish list", err);
      if (err instanceof ApiError && err.responseCode === 401) {
        handleUnauthorized();
        closeModal?.();
        return;
      }
      errorToast(err instanceof Error ? err.message : "Failed to load wish list");
      closeModal?.();
    }
  })();
}
