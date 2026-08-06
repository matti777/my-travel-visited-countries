import { openModal } from "Components/modal";
import { createModalStickyFooter } from "Components/modal-sticky-footer";
import { errorToast, successToast } from "Components/toast";
import {
  createWishListEditorCell,
  isWishListEditorCellInteractiveTarget,
  MAX_WISH_LIST_DESCRIPTION_LENGTH,
  type WishListEditorCellHandle,
} from "Components/wish-list-editor-cell";
import { ApiError } from "../../api";
import type { Country } from "../../types/country";
import type { WishListCountry } from "../../types/visit";

const MAX_WISH_LIST_ENTRIES = 5;
const REORDER_TRANSITION_MS = 280;

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

type ReorderSession = {
  pointerId: number;
  fromIndex: number;
  insertIndex: number;
  startClientY: number;
  grabOffsetY: number;
  cellHeights: number[];
  originalMids: number[];
  itemEls: HTMLElement[];
  draggedEl: HTMLElement;
};

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
    "Pick up to 5 countries you want to visit. Drag a row to reorder. " +
    "Changes save only when you press Save.";
  body.appendChild(intro);

  const listEl = document.createElement("div");
  listEl.className = "wish-list-editor__list";
  body.appendChild(listEl);

  let closeModal: (() => void) | null = null;
  let closeFromFooter: (() => void) | null = null;
  let saveWishList: () => Promise<void> = async () => {};

  const stickyFooter = createModalStickyFooter({
    primary: {
      label: "Save changes",
      disabled: true,
      onClick: () => {
        void saveWishList();
      },
    },
    secondary: {
      label: "Close without saving",
      onClick: () => closeFromFooter?.(),
    },
  });
  const footer = stickyFooter.element;
  const saveBtn = stickyFooter.primaryButton;
  let initial: WishListCountry[] = [];
  let draft: WishListCountry[] = [];
  let saving = false;
  let loaded = false;
  let reorder: ReorderSession | null = null;
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

  const clearReorderTransforms = (els: HTMLElement[]): void => {
    for (const el of els) {
      el.style.transform = "";
      el.style.transition = "";
      el.style.zIndex = "";
      el.style.position = "";
      el.style.width = "";
      el.style.left = "";
      el.style.top = "";
      el.style.pointerEvents = "";
      el.classList.remove(
        "wish-list-editor-cell--dragging",
        "wish-list-editor-cell--shifting",
      );
    }
  };

  const applySiblingShifts = (session: ReorderSession): void => {
    const { fromIndex, insertIndex, cellHeights, itemEls } = session;
    for (let i = 0; i < itemEls.length; i++) {
      if (i === fromIndex) continue;
      const el = itemEls[i];
      el.classList.add("wish-list-editor-cell--shifting");
      let dy = 0;
      if (fromIndex < insertIndex) {
        if (i > fromIndex && i <= insertIndex) {
          dy = -cellHeights[fromIndex];
        }
      } else if (fromIndex > insertIndex) {
        if (i >= insertIndex && i < fromIndex) {
          dy = cellHeights[fromIndex];
        }
      }
      el.style.transform = dy ? `translateY(${dy}px)` : "";
    }
  };

  const computeInsertIndex = (
    session: ReorderSession,
    clientY: number,
  ): number => {
    const { fromIndex, cellHeights, grabOffsetY, originalMids } = session;
    const draggedCenter =
      clientY - grabOffsetY + cellHeights[fromIndex] / 2;
    let insert = fromIndex;
    for (let i = 0; i < originalMids.length; i++) {
      if (i === fromIndex) continue;
      if (i < fromIndex && draggedCenter < originalMids[i]) {
        insert = Math.min(insert, i);
      }
      if (i > fromIndex && draggedCenter > originalMids[i]) {
        insert = Math.max(insert, i);
      }
    }
    return insert;
  };

  const endReorder = (commit: boolean): void => {
    const session = reorder;
    if (!session) return;
    reorder = null;

    const { fromIndex, insertIndex, itemEls, draggedEl, pointerId } = session;
    try {
      draggedEl.releasePointerCapture(pointerId);
    } catch {
      /* already released */
    }

    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerCancel);

    const toIndex = insertIndex;
    const shouldMove = commit && toIndex !== fromIndex && !saving;

    if (shouldMove) {
      const [moved] = draft.splice(fromIndex, 1);
      draft.splice(toIndex, 0, moved);
    }

    // Settle: animate transforms back via re-render after a short FLIP
    const firstRects = itemEls.map((el) => el.getBoundingClientRect());
    clearReorderTransforms(itemEls);
    renderList();

    const newItemEls = Array.from(
      listEl.querySelectorAll<HTMLElement>(".wish-list-editor-cell--item"),
    );
    // Match by country code order in draft
    requestAnimationFrame(() => {
      newItemEls.forEach((el, i) => {
        const last = el.getBoundingClientRect();
        // Approximate FLIP using previous positions when lengths match
        const prev =
          firstRects[
            shouldMove
              ? mapOldIndexToNew(i, fromIndex, toIndex)
              : i
          ];
        if (!prev) return;
        const dy = prev.top - last.top;
        if (Math.abs(dy) < 1) return;
        el.style.transition = "none";
        el.style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => {
          el.style.transition = `transform ${REORDER_TRANSITION_MS}ms ease`;
          el.style.transform = "";
          window.setTimeout(() => {
            el.style.transition = "";
          }, REORDER_TRANSITION_MS);
        });
      });
    });

    updateSaveEnabled();
  };

  const mapOldIndexToNew = (
    newIndex: number,
    from: number,
    to: number,
  ): number => {
    // Inverse: which old index ended up at newIndex after splice move
    if (from === to) return newIndex;
    if (from < to) {
      if (newIndex < from) return newIndex;
      if (newIndex === to) return from;
      if (newIndex > from && newIndex <= to) return newIndex - 1;
      return newIndex;
    }
    // from > to
    if (newIndex < to) return newIndex;
    if (newIndex === to) return from;
    if (newIndex > to && newIndex <= from) return newIndex + 1;
    return newIndex;
  };

  const onPointerMove = (e: PointerEvent): void => {
    const session = reorder;
    if (!session || e.pointerId !== session.pointerId) return;
    e.preventDefault();

    const dy = e.clientY - session.startClientY;
    session.draggedEl.style.transform = `translateY(${dy}px)`;

    const nextInsert = computeInsertIndex(session, e.clientY);
    if (nextInsert !== session.insertIndex) {
      session.insertIndex = nextInsert;
      applySiblingShifts(session);
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!reorder || e.pointerId !== reorder.pointerId) return;
    endReorder(true);
  };

  const onPointerCancel = (e: PointerEvent): void => {
    if (!reorder || e.pointerId !== reorder.pointerId) return;
    endReorder(false);
  };

  const beginReorder = (
    e: PointerEvent,
    index: number,
    cellEl: HTMLElement,
  ): void => {
    if (saving || !loaded || reorder) return;
    if (e.button !== 0) return;
    if (isWishListEditorCellInteractiveTarget(e.target)) return;

    const itemEls = Array.from(
      listEl.querySelectorAll<HTMLElement>(".wish-list-editor-cell--item"),
    );
    if (index < 0 || index >= itemEls.length) return;

    const rect = cellEl.getBoundingClientRect();
    const tops = itemEls.map((el) => el.getBoundingClientRect().top);
    const heights = itemEls.map((el) => el.getBoundingClientRect().height);
    const gap =
      itemEls.length > 1
        ? tops[1] - (tops[0] + heights[0])
        : 0;
    const strideHeights = heights.map((h) => h + Math.max(0, gap));
    const originalMids = tops.map((t, i) => t + heights[i] / 2);

    cellEl.setPointerCapture(e.pointerId);
    cellEl.classList.add("wish-list-editor-cell--dragging");
    cellEl.style.zIndex = "5";
    cellEl.style.position = "relative";
    cellEl.style.transition = "none";
    cellEl.style.pointerEvents = "none";

    reorder = {
      pointerId: e.pointerId,
      fromIndex: index,
      insertIndex: index,
      startClientY: e.clientY,
      grabOffsetY: e.clientY - rect.top,
      cellHeights: strideHeights,
      originalMids,
      itemEls,
      draggedEl: cellEl,
    };

    for (const el of itemEls) {
      if (el !== cellEl) {
        el.style.transition = `transform ${REORDER_TRANSITION_MS}ms ease`;
      }
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerCancel);
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
        disabled: saving || !loaded,
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
      });

      cell.element.addEventListener("pointerdown", (e) => {
        beginReorder(e, index, cell.element);
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
        disabled: saving || !loaded,
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
  closeFromFooter = () => close("closeButton");

  saveWishList = async () => {
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
  };

  void (async () => {
    try {
      const list = await api.getWishList();
      initial = cloneList(list);
      draft = cloneList(list);
      loaded = true;
      renderList();
      updateSaveEnabled();
    } catch (err) {
      console.error("Failed to load wish list", err);
      if (err instanceof ApiError && err.responseCode === 401) {
        handleUnauthorized();
      } else {
        errorToast(
          err instanceof Error ? err.message : "Failed to load wish list",
        );
      }
      closeModal?.();
    }
  })();
}
