import { createCountryCell } from "Components/country-cell";
import type { Country } from "../../types/country";

export interface CountryDropdownOptions {
  countries: Country[];
  baseUrl: string;
  selectedCountryCode: string;
  onSelect: (countryCode: string) => void;
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
 */
export function createCountryDropdown(options: CountryDropdownOptions): HTMLElement {
  const { countries, baseUrl, selectedCountryCode, onSelect } = options;
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
  if (selectedCountryCode) {
    const c = countries.find((x) => x.countryCode === selectedCountryCode);
    input.value = c ? c.name : selectedCountryCode;
  }
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
      input.blur();
    }
  });

  root.appendChild(panel);

  return root;
}
