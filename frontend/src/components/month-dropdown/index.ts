const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface MonthDropdownOptions {
  selectedMonth: number | null;
  onSelect: (month: number) => void;
}

/**
 * Creates a custom month dropdown: trigger shows "Select month.." (placeholder style)
 * or the selected month name (value style). Panel lists January–December.
 * Closes on trigger click (toggle), click outside, or ESC.
 */
export function createMonthDropdown(options: MonthDropdownOptions): HTMLElement {
  const { selectedMonth, onSelect } = options;
  const root = document.createElement("div");
  root.className = "month-dropdown";

  let open = false;
  let clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

  const trigger = document.createElement("div");
  trigger.className = "month-dropdown__trigger";
  trigger.setAttribute("role", "button");
  trigger.setAttribute("tabindex", "0");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-label", "Select month");
  function updateTrigger(): void {
    if (selectedMonth != null && selectedMonth >= 1 && selectedMonth <= 12) {
      trigger.textContent = MONTH_NAMES[selectedMonth - 1];
      trigger.classList.remove("month-dropdown__trigger--placeholder");
      trigger.classList.add("month-dropdown__trigger--value");
    } else {
      trigger.textContent = "Select month..";
      trigger.classList.add("month-dropdown__trigger--placeholder");
      trigger.classList.remove("month-dropdown__trigger--value");
    }
  }
  updateTrigger();
  root.appendChild(trigger);

  const panel = document.createElement("div");
  panel.className = "month-dropdown__panel";
  panel.hidden = true;
  panel.setAttribute("role", "listbox");

  const listContainer = document.createElement("div");
  listContainer.className = "month-dropdown__list";
  for (let i = 1; i <= 12; i++) {
    const item = document.createElement("div");
    item.className = "month-dropdown__item";
    item.setAttribute("role", "option");
    item.setAttribute("data-month", String(i));
    item.textContent = MONTH_NAMES[i - 1];
    item.addEventListener("click", () => {
      onSelect(i);
      setOpen(false);
      trigger.focus();
    });
    listContainer.appendChild(item);
  }
  panel.appendChild(listContainer);

  function setOpen(value: boolean): void {
    open = value;
    panel.hidden = !value;
    trigger.setAttribute("aria-expanded", String(value));
    if (value) {
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

  trigger.addEventListener("click", () => setOpen(!open));
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(!open);
    }
  });

  root.appendChild(panel);

  return root;
}
