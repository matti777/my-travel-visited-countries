import { createCountryDropdown } from "Components/country-dropdown";
import { createCharCountLabel } from "Components/char-count-label";
import { createDeleteButton } from "Components/delete-button";
import type { Country } from "../../types/country";
import type { WishListCountry } from "../../types/visit";

export const MAX_WISH_LIST_DESCRIPTION_LENGTH = 500;

const DESCRIPTION_PLACEHOLDER =
  "Optional: why you want to visit (plain text).";

/** True when the event target is an interactive control (do not start cell drag). */
export function isWishListEditorCellInteractiveTarget(
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(
    target.closest(
      "input, textarea, button, select, a, .country-dropdown, label",
    ),
  );
}

export type WishListEditorCellMode = "item" | "add";

export interface WishListEditorCellOptions {
  mode: WishListEditorCellMode;
  countries: Country[];
  baseUrl: string;
  countryCode?: string;
  description?: string;
  /** Codes already used elsewhere in the draft (exclude from dropdown). */
  excludedCountryCodes?: string[];
  onChange?: (entry: WishListCountry) => void;
  onDelete?: () => void;
  onAdd?: (entry: WishListCountry) => void;
  disabled?: boolean;
}

export interface WishListEditorCellHandle {
  element: HTMLElement;
  getValue(): WishListCountry;
  setDisabled(disabled: boolean): void;
  /** Clears country + description (add mode after successful Add). */
  clear(): void;
}

function truncateDescription(value: string): string {
  if (value.length <= MAX_WISH_LIST_DESCRIPTION_LENGTH) {
    return value;
  }
  return value.slice(0, MAX_WISH_LIST_DESCRIPTION_LENGTH);
}

function filterAvailableCountries(
  countries: Country[],
  excluded: string[],
  keepCode: string,
): Country[] {
  const excludedSet = new Set(
    excluded
      .map((c) => c.toUpperCase())
      .filter((c) => c !== keepCode.toUpperCase()),
  );
  return countries.filter(
    (c) => !excludedSet.has(c.countryCode.toUpperCase()),
  );
}

/**
 * Creates a WishListEditorCell (item or add mode). See wish-list-editor-cell.md.
 */
export function createWishListEditorCell(
  options: WishListEditorCellOptions,
): WishListEditorCellHandle {
  const { mode, baseUrl, onChange, onDelete, onAdd } = options;

  let countryCode = (options.countryCode ?? "").toUpperCase();
  let description = options.description ?? "";
  let disabled = Boolean(options.disabled);

  const root = document.createElement("div");
  root.className = "wish-list-editor-cell";
  if (mode === "add") {
    root.classList.add("wish-list-editor-cell--add");
  } else {
    root.classList.add("wish-list-editor-cell--item");
  }

  const main = document.createElement("div");
  main.className = "wish-list-editor-cell__main";

  const available = filterAvailableCountries(
    options.countries,
    options.excludedCountryCodes ?? [],
    countryCode,
  );

  const dropdown = createCountryDropdown({
    countries: available,
    baseUrl,
    selectedCountryCode: countryCode,
    clearable: mode === "add",
    onSelect: (code) => {
      countryCode = code.toUpperCase();
      emitChange();
      updateAddEnabled();
    },
  });
  dropdown.element.classList.add("wish-list-editor-cell__country");
  main.appendChild(dropdown.element);

  const descFieldId = `wish-list-desc-${Math.random().toString(36).slice(2, 9)}`;
  const descCount = createCharCountLabel({
    title: "Description",
    maxLength: MAX_WISH_LIST_DESCRIPTION_LENGTH,
    htmlFor: descFieldId,
    className: "wish-list-editor-cell__desc-label",
  });
  main.appendChild(descCount.element);

  const descInput = document.createElement("textarea");
  descInput.id = descFieldId;
  descInput.className = "wish-list-editor-cell__description";
  descInput.rows = 2;
  descInput.maxLength = MAX_WISH_LIST_DESCRIPTION_LENGTH;
  descInput.placeholder = DESCRIPTION_PLACEHOLDER;
  descInput.value = description;
  descCount.setCount(description.length);
  descInput.addEventListener("input", () => {
    const truncated = truncateDescription(descInput.value);
    if (truncated !== descInput.value) {
      descInput.value = truncated;
    }
    description = descInput.value;
    descCount.setCount(description.length);
    emitChange();
  });
  main.appendChild(descInput);

  root.appendChild(main);

  const actions = document.createElement("div");
  actions.className = "wish-list-editor-cell__actions";

  let deleteBtn: HTMLButtonElement | null = null;
  let addBtn: HTMLButtonElement | null = null;

  if (mode === "item") {
    deleteBtn = createDeleteButton({
      className: "wish-list-editor-cell__delete",
      ariaLabel: "Remove from wish list",
      tooltip: "Click to remove from wish list",
      onClick: () => onDelete?.(),
    });
    actions.appendChild(deleteBtn);
  } else {
    addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "wish-list-editor-cell__add-btn primary";
    addBtn.textContent = "Add";
    addBtn.disabled = true;
    addBtn.addEventListener("click", () => {
      if (!countryCode) return;
      onAdd?.({
        countryCode,
        description: description.trim() || undefined,
      });
    });
    actions.appendChild(addBtn);
  }

  root.appendChild(actions);

  const emitChange = (): void => {
    if (mode !== "item") return;
    onChange?.({
      countryCode,
      description: description.trim() || undefined,
    });
  };

  const updateAddEnabled = (): void => {
    if (!addBtn) return;
    addBtn.disabled = disabled || !countryCode;
  };

  const setControlsDisabled = (value: boolean): void => {
    disabled = value;
    descInput.disabled = value;
    const homeInput = dropdown.element.querySelector(
      "input",
    ) as HTMLInputElement | null;
    if (homeInput) {
      homeInput.disabled = value;
    }
    if (deleteBtn) {
      deleteBtn.disabled = value;
    }
    updateAddEnabled();
  };

  setControlsDisabled(disabled);
  updateAddEnabled();

  return {
    element: root,
    getValue(): WishListCountry {
      return {
        countryCode,
        description: description.trim() || undefined,
      };
    },
    setDisabled(value: boolean): void {
      setControlsDisabled(value);
    },
    clear(): void {
      countryCode = "";
      description = "";
      dropdown.setSelected("");
      descInput.value = "";
      descCount.setCount(0);
      updateAddEnabled();
    },
  };
}
