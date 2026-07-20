import { createCountryCell } from "Components/country-cell";
import type { Country } from "../../types/country";

export interface CountryDropdownOptions {
  countries: Country[];
  baseUrl: string;
  selectedCountryCode: string;
  onSelect: (countryCode: string) => void;
  /** When true, allow clearing selection (empty = unset). */
  clearable?: boolean;
}

export interface CountryDropdownHandle {
  element: HTMLElement;
  setSelected(countryCode: string): void;
  getSelected(): string;
}

function filterCountries(countries: Country[], query: string): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return countries;
  return countries.filter(
    (c) =>
      c.name.toLowerCase().includes(q) || c.countryCode.toLowerCase().includes(q)
  );
}

/**
 * Creates a custom dropdown: single text input with placeholder "Select country".
 * When the input is focused/clicked, the list opens underneath and the input is used as the filter.
 * ESC or click outside closes the list.
 * See frontend/spec/country-dropdown-component.md.
 */
export function createCountryDropdown(
  options: CountryDropdownOptions,
): CountryDropdownHandle {
  const { countries, baseUrl, onSelect, clearable = false } = options;
  let selectedCode = options.selectedCountryCode ?? "";
  const root = document.createElement("div");
  root.className = "country-dropdown";

  let open = false;
  let clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "country-dropdown__input";
  input.placeholder = "Select country";
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-haspopup", "listbox");
  input.setAttribute("aria-label", "Select country");
  input.autocomplete = "off";

  function syncInputFromSelection(): void {
    if (!selectedCode) {
      input.value = "";
      return;
    }
    const c = countries.find((x) => x.countryCode === selectedCode);
    input.value = c ? c.name : selectedCode;
  }

  syncInputFromSelection();
  root.appendChild(input);

  const panel = document.createElement("div");
  panel.className = "country-dropdown__panel";
  panel.hidden = true;
  panel.setAttribute("role", "listbox");

  const listContainer = document.createElement("div");
  listContainer.className = "country-dropdown__list";
  panel.appendChild(listContainer);

  function getFilterQuery(): string {
    return input.value.trim();
  }

  function renderList(): void {
    const filterQuery = getFilterQuery();
    const filtered = filterCountries(countries, filterQuery);
    listContainer.replaceChildren();

    if (clearable && selectedCode) {
      const clearItem = document.createElement("div");
      clearItem.className =
        "country-dropdown__item country-dropdown__item--enter country-dropdown__item--clear";
      clearItem.setAttribute("role", "option");
      clearItem.textContent = "Clear selection";
      clearItem.addEventListener("click", () => {
        selectedCode = "";
        input.value = "";
        onSelect("");
        setOpen(false);
        input.focus();
      });
      listContainer.appendChild(clearItem);
      requestAnimationFrame(() => clearItem.classList.add("visible"));
    }

    for (const c of filtered) {
      const item = document.createElement("div");
      item.className = "country-dropdown__item country-dropdown__item--enter";
      item.setAttribute("role", "option");
      item.setAttribute("data-country-code", c.countryCode);
      const cell = createCountryCell(c.countryCode, c.name, baseUrl, {
        variant: "compact",
      });
      item.appendChild(cell);
      item.addEventListener("click", () => {
        selectedCode = c.countryCode;
        input.value = c.name;
        onSelect(c.countryCode);
        setOpen(false);
        input.focus();
      });
      listContainer.appendChild(item);
      requestAnimationFrame(() => item.classList.add("visible"));
    }
  }

  function setOpen(value: boolean): void {
    open = value;
    panel.hidden = !value;
    input.setAttribute("aria-expanded", String(value));
    if (value) {
      renderList();
      input.focus();
      clickOutsideHandler = (e: MouseEvent) => {
        if (root.contains(e.target as Node)) return;
        setOpen(false);
        if (clearable && !selectedCode) {
          input.value = "";
        } else {
          syncInputFromSelection();
        }
        document.removeEventListener("mousedown", clickOutsideHandler!);
        clickOutsideHandler = null;
      };
      document.addEventListener("mousedown", clickOutsideHandler);
    } else {
      if (clickOutsideHandler) {
        document.removeEventListener("mousedown", clickOutsideHandler);
        clickOutsideHandler = null;
      }
    }
  }

  input.addEventListener("click", () => setOpen(!open));

  input.addEventListener("input", () => {
    renderList();
    if (!open) setOpen(true);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      if (clearable && !selectedCode) {
        input.value = "";
      } else {
        syncInputFromSelection();
      }
      input.blur();
    }
  });

  root.appendChild(panel);

  return {
    element: root,
    setSelected(countryCode: string): void {
      selectedCode = countryCode;
      syncInputFromSelection();
    },
    getSelected(): string {
      return selectedCode;
    },
  };
}
