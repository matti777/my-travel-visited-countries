import { errorToast } from "Components/toast";
import { renderAuthHeader } from "Components/auth";
import { createCountryCell } from "Components/country-cell";
import { createCountryDropdown } from "Components/country-dropdown";
import { createMonthDropdown } from "Components/month-dropdown";
import { subscribeToAuthStateChanged, signInWithGoogle, signOut } from "./firebase";
import { api, ApiError } from "./api";
import type { Country } from "./types/country";
import type { CountryVisit } from "./types/visit";
import type { User } from "firebase/auth";

/** Country list from GET /countries, filled after app start (from cache or backend). */
export let countries: Country[] = [];

/** Country visits from GET /visits, filled when user is authenticated (on load and on login). */
export let visits: CountryVisit[] = [];

/** Visit IDs that were just added; used to trigger fade-in animation. Cleared after animation. */
const newVisitIds = new Set<string>();

const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";

function formatVisitTime(visitedTime?: string): string {
  if (!visitedTime) return "—";
  const d = new Date(visitedTime);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Returns list of visits unique by country code (first occurrence each). Used for non-edit display.
 */
function uniqueVisitsByCountry(list: CountryVisit[]): CountryVisit[] {
  const seen = new Set<string>();
  return list.filter((v) => {
    if (seen.has(v.countryCode)) return false;
    seen.add(v.countryCode);
    return true;
  });
}

export interface RenderOptions {
  countries: Country[];
  visits: CountryVisit[];
  user: User | null;
  isEditMode: boolean;
  onEditModeToggle: () => void;
  onRefresh: () => void;
  selectedCountryCode: string;
  onSelectCountry: (code: string) => void;
  selectedMonth: number | null;
  setSelectedMonth: (month: number | null) => void;
  formYear: string;
  formDay: string;
  onFormYearChange: (value: string) => void;
  onFormDayChange: (value: string) => void;
}

async function handleDeleteVisit(
  visit: CountryVisit,
  cell: HTMLElement,
  onRefresh: () => void
): Promise<void> {
  if (!visit.id) return;
  try {
    await api.deleteVisit(visit.id);
    cell.classList.add("cell-fade-out");
    cell.addEventListener(
      "transitionend",
      () => {
        visits = visits.filter((v) => v.id !== visit.id);
        onRefresh();
      },
      { once: true }
    );
  } catch (err) {
    if (err instanceof ApiError && err.responseCode === 401) {
      signOut();
      errorToast("Session expired");
    } else {
      errorToast(err instanceof Error ? err.message : "Failed to delete visit");
    }
  }
}

/**
 * Renders the main #app content from current state: visited countries section and add-visit form when logged in.
 */
function renderAppContent(container: HTMLElement, options: RenderOptions): void {
  const { countries: countriesList, visits: visitsList, user, isEditMode, onEditModeToggle } = options;
  container.replaceChildren();

  if (!user) {
    const p = document.createElement("p");
    p.textContent = "Sign in to see and add your visited countries.";
    p.className = "visited-empty";
    container.appendChild(p);
    return;
  }

  const displayList = isEditMode ? visitsList : uniqueVisitsByCountry(visitsList);

  // Section: Your Visited Countries
  const visitedSection = document.createElement("section");
  visitedSection.className = "app-section";
  const titleRow = document.createElement("div");
  titleRow.className = "app-section__title-row";
  const visitedTitle = document.createElement("h2");
  visitedTitle.textContent = "Your visited countries";
  titleRow.appendChild(visitedTitle);
  const editDoneBtn = document.createElement("button");
  editDoneBtn.type = "button";
  editDoneBtn.textContent = isEditMode ? "Done" : "Edit";
  editDoneBtn.className = "edit-done-btn";
  editDoneBtn.addEventListener("click", onEditModeToggle);
  titleRow.appendChild(editDoneBtn);
  visitedSection.appendChild(titleRow);

  if (displayList.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No visited countries yet";
    empty.className = "visited-empty";
    visitedSection.appendChild(empty);
  } else {
    const grid = document.createElement("div");
    grid.className = "visited-grid visited-grid--enter";
    requestAnimationFrame(() => grid.classList.add("visible"));
    for (const visit of displayList) {
      const name = countriesList.find((c) => c.countryCode === visit.countryCode)?.name ?? visit.countryCode;
      const isNew = visit.id != null && newVisitIds.has(visit.id);
      const cellRef: { current: HTMLElement | null } = { current: null };
      const cellOptions =
        isEditMode && visit.id
          ? {
              visitTimeLabel: formatVisitTime(visit.visitedTime),
              onDelete: () => {
                if (cellRef.current) handleDeleteVisit(visit, cellRef.current, options.onRefresh);
              },
            }
          : undefined;
      const cell = createCountryCell(visit.countryCode, name, baseUrl, cellOptions);
      cellRef.current = cell;
      if (isNew) {
        cell.classList.add("cell-fade-in");
        requestAnimationFrame(() => {
          cell.classList.add("visible");
          if (visit.id) newVisitIds.delete(visit.id);
        });
      }
      grid.appendChild(cell);
    }
    visitedSection.appendChild(grid);
  }
  container.appendChild(visitedSection);

  // Section: Add visited country
  const addSection = document.createElement("section");
  addSection.className = "app-section";
  const addTitle = document.createElement("h2");
  addTitle.textContent = "Add visited country";
  addSection.appendChild(addTitle);

  const form = document.createElement("form");
  form.className = "add-visit-form";
  form.addEventListener("submit", (e) => e.preventDefault());

  const row = document.createElement("div");
  row.className = "add-visit-form__row";
  const dropdown = createCountryDropdown({
    countries: countriesList,
    baseUrl,
    selectedCountryCode: options.selectedCountryCode,
    onSelect: options.onSelectCountry,
  });
  row.appendChild(dropdown);
  const visitTimeLabel = document.createElement("span");
  visitTimeLabel.className = "add-visit-form__visit-time-label";
  visitTimeLabel.textContent = "Visit time";
  row.appendChild(visitTimeLabel);
  const currentYear = new Date().getFullYear();
  const yearInput = document.createElement("input");
  yearInput.type = "number";
  yearInput.placeholder = "Year";
  yearInput.min = "1900";
  yearInput.max = String(currentYear);
  yearInput.name = "year";
  yearInput.className = "add-visit-form__year";
  yearInput.autocomplete = "off";
  yearInput.value = options.formYear ?? "";
  row.appendChild(yearInput);

  const monthDropdown = createMonthDropdown({
    selectedMonth: options.selectedMonth,
    onSelect: (month) => options.setSelectedMonth(month),
  });
  row.appendChild(monthDropdown);

  const dayInput = document.createElement("input");
  dayInput.type = "number";
  dayInput.placeholder = "Day";
  dayInput.min = "1";
  dayInput.max = "31";
  dayInput.name = "day";
  dayInput.autocomplete = "off";
  dayInput.value = options.formDay ?? "";
  row.appendChild(dayInput);

  form.appendChild(row);
  const visitTimeHint = document.createElement("p");
  visitTimeHint.className = "add-visit-form__visit-time-hint";
  visitTimeHint.textContent =
    "Visit time is optional. You can enter only a year (we'll use January 1st), year and month (we'll use the 1st of that month), or a full date.";
  form.appendChild(visitTimeHint);

  function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  function validateVisitTime(): {
    valid: boolean;
    yearInvalid?: boolean;
    dayInvalid?: boolean;
  } {
    const yStr = yearInput.value.trim();
    const dayStr = dayInput.value.trim();
    const y = yStr ? parseInt(yStr, 10) : NaN;
    const day = dayStr ? parseInt(dayStr, 10) : NaN;

    if (yStr && (isNaN(y) || y < 1900 || y > currentYear)) {
      return { valid: false, yearInvalid: true };
    }
    if (dayStr) {
      if (!yStr || isNaN(y)) return { valid: false, dayInvalid: true };
      const monthVal = options.selectedMonth ?? 1;
      const maxDay = getDaysInMonth(y, monthVal);
      if (isNaN(day) || day < 1 || day > maxDay) {
        return { valid: false, dayInvalid: true };
      }
    }
    return { valid: true };
  }

  function updateValidationUI(): void {
    const v = validateVisitTime();
    yearInput.classList.toggle("invalid", !!v.yearInvalid);
    dayInput.classList.toggle("invalid", !!v.dayInvalid);
    addBtn.disabled = !v.valid;
  }

  yearInput.addEventListener("input", () => {
    options.onFormYearChange(yearInput.value);
    updateValidationUI();
  });
  yearInput.addEventListener("change", () => {
    options.onFormYearChange(yearInput.value);
    updateValidationUI();
    const yStr = yearInput.value.trim();
    const y = yStr ? parseInt(yStr, 10) : NaN;
    if (!isNaN(y) && y >= 1900 && y <= currentYear) {
      options.onFormDayChange("1");
      dayInput.value = "1";
      options.setSelectedMonth(1);
    }
  });
  dayInput.addEventListener("input", () => {
    options.onFormDayChange(dayInput.value);
    updateValidationUI();
  });
  dayInput.addEventListener("change", () => {
    options.onFormDayChange(dayInput.value);
    updateValidationUI();
  });

  const addBtn = document.createElement("button");
  addBtn.type = "submit";
  addBtn.textContent = "Add";
  addBtn.disabled = false;
  addBtn.addEventListener("click", async () => {
    const countryCode = options.selectedCountryCode;
    if (!countryCode) {
      errorToast("Please select a country");
      return;
    }
    const v = validateVisitTime();
    if (!v.valid) return;

    let visitedTime: number | undefined;
    const yStr = yearInput.value.trim();
    const y = yStr ? parseInt(yStr, 10) : NaN;
    if (!isNaN(y)) {
      const month = options.selectedMonth ?? 1;
      const dayStr = dayInput.value.trim();
      const day = dayStr ? parseInt(dayStr, 10) : 1;
      const d = new Date(Date.UTC(y, month - 1, day));
      visitedTime = Math.floor(d.getTime() / 1000);
    }
    try {
      const created = await api.putVisits(countryCode, visitedTime);
      visits = [...visits, created];
      if (created.id) newVisitIds.add(created.id);
      options.onSelectCountry("");
      options.setSelectedMonth(null);
      options.onFormYearChange("");
      options.onFormDayChange("");
      options.onRefresh();
      yearInput.value = "";
      dayInput.value = "";
      updateValidationUI();
    } catch (err) {
      if (err instanceof ApiError && err.responseCode === 401) {
        signOut();
        errorToast("Session expired");
      } else {
        errorToast(err instanceof Error ? err.message : "Failed to add visit");
      }
    }
  });
  form.appendChild(addBtn);
  updateValidationUI();

  addSection.appendChild(form);
  container.appendChild(addSection);
}

export async function main(): Promise<void> {
  const authHeaderEl = document.getElementById("auth-header");
  const appEl = document.getElementById("app");
  if (!appEl) return;

  let currentUser: User | null = null;
  let isEditMode = false;
  let selectedCountryCode = "";
  let selectedMonth: number | null = null;
  let formYear = "";
  let formDay = "";

  function refreshAppContent(): void {
    if (appEl)
      renderAppContent(appEl, {
        countries,
        visits,
        user: currentUser,
        isEditMode,
        onEditModeToggle: () => {
          isEditMode = !isEditMode;
          refreshAppContent();
        },
        onRefresh: refreshAppContent,
        selectedCountryCode,
        onSelectCountry: (code: string) => {
          selectedCountryCode = code;
          refreshAppContent();
        },
        selectedMonth,
        setSelectedMonth: (month: number | null) => {
          selectedMonth = month;
          refreshAppContent();
        },
        formYear,
        formDay,
        onFormYearChange: (value: string) => {
          formYear = value;
        },
        onFormDayChange: (value: string) => {
          formDay = value;
        },
      });
  }

  if (authHeaderEl) {
    const unsubscribe = subscribeToAuthStateChanged(async (user) => {
      currentUser = user;
      if (user) {
        const token = await user.getIdToken();
        api.setAuthToken(token);
        try {
          visits = await api.getVisits();
        } catch (err) {
          console.error("Failed to load visits", err);
          visits = [];
          if (err instanceof ApiError && err.responseCode === 401) {
            signOut();
            errorToast("Session expired");
          } else {
            errorToast("Failed to load visits");
          }
        }
      } else {
        api.setAuthToken(null);
        visits = [];
      }
      renderAuthHeader(authHeaderEl, user, onLogin, onLogout);
      refreshAppContent();
    });
    function onLogin(): void {
      signInWithGoogle().catch((err) => {
        console.error("Sign in failed:", err);
        errorToast(err instanceof Error ? err.message : "Sign in failed");
      });
    }
    function onLogout(): void {
      signOut().then(() => {
        api.setAuthToken(null);
        console.log("Signed out");
      });
    }
    void unsubscribe;
  }

  try {
    countries = await api.getCountries();
    console.log("App initialized with", countries.length, "countries");
  } catch (err) {
    countries = [];
    console.error("Countries load failed", err);
  }

  refreshAppContent();

  window.addEventListener("error", function (event) {
    console.error(
      "Caught an error:",
      event.message,
      "at",
      event.filename,
      "line",
      event.lineno,
      "column",
      event.colno,
      "error object:",
      event.error
    );
    errorToast(`Error occurred: ${event.message}`);
    event.preventDefault();
  });

  window.addEventListener("unhandledrejection", function (event) {
    console.error("Unhandled promise rejection:", event.reason);
    errorToast("Something went wrong");
    event.preventDefault();
  });
}

document.addEventListener("DOMContentLoaded", function () {
  main();
});
