import { errorToast } from "Components/toast";
import { renderAuthHeader } from "Components/auth";
import { createCountryCell } from "Components/country-cell";
import { createCountryDropdown } from "Components/country-dropdown";
import { createMonthDropdown } from "Components/month-dropdown";
import { createShareSection } from "Components/share-section";
import { createVisitMap } from "Components/visit-map";
import { attachTooltip } from "Components/tooltip";
import { subscribeToAuthStateChanged, signInWithGoogle, signOut } from "./firebase";
import { api, ApiError } from "./api";
import type { Country } from "./types/country";
import type { CountryVisit } from "./types/visit";
import type { User } from "firebase/auth";

/** Country list from GET /countries, filled after app start (from cache or backend). */
export let countries: Country[] = [];

/** Country visits from GET /visits, filled when user is authenticated (on load and on login). */
export let visits: CountryVisit[] = [];

/** Share token from GET /visits response; used for Share URL when logged in. */
let shareToken: string | null = null;

/** Shared visit list when URL has #s=<share-token>. */
let sharedVisits: CountryVisit[] = [];
let sharedUserName: string | null = null;

function getShareTokenFromHash(): string | null {
  const hash = window.location.hash.slice(1).trim();
  if (!hash.startsWith("s=")) return null;
  const token = hash.slice(2).trim();
  return token || null;
}

/** Visit IDs that were just added; used to trigger fade-in animation. Cleared after animation. */
const newVisitIds = new Set<string>();

const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";

const REGION_CODE_TO_NAME: Record<string, string> = {
  AF: "Africa",
  AN: "Antarctica",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  OC: "Oceania",
  SA: "South America",
};

function getRegionName(regionCode: string): string {
  return REGION_CODE_TO_NAME[regionCode] ?? regionCode;
}

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

/**
 * Returns visits sorted alphabetically by country name (using countries to resolve name).
 */
function sortedVisitsAlphabetically(list: CountryVisit[], countriesList: Country[]): CountryVisit[] {
  const nameFor = (code: string) => countriesList.find((c) => c.countryCode === code)?.name ?? code;
  return [...list].sort((a, b) => nameFor(a.countryCode).localeCompare(nameFor(b.countryCode)));
}

/**
 * Groups visits by regionCode; each group sorted by country name. Continents sorted by display name.
 */
function groupVisitsByContinent(
  list: CountryVisit[],
  countriesList: Country[],
): { regionCode: string; regionName: string; visits: CountryVisit[] }[] {
  const byRegion = new Map<string, CountryVisit[]>();
  const nameFor = (code: string) => countriesList.find((c) => c.countryCode === code)?.name ?? code;
  for (const v of list) {
    const country = countriesList.find((c) => c.countryCode === v.countryCode);
    const regionCode = country?.regionCode ?? "ZZ";
    if (!byRegion.has(regionCode)) byRegion.set(regionCode, []);
    byRegion.get(regionCode)!.push(v);
  }
  const regionNames = new Map<string, string>();
  byRegion.forEach((_, code) => {
    regionNames.set(code, getRegionName(code));
  });
  const sortedRegions = [...byRegion.entries()].sort((a, b) =>
    regionNames.get(a[0])!.localeCompare(regionNames.get(b[0])!),
  );
  return sortedRegions.map(([regionCode, visits]) => ({
    regionCode,
    regionName: getRegionName(regionCode),
    visits: [...visits].sort((a, b) => nameFor(a.countryCode).localeCompare(nameFor(b.countryCode))),
  }));
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
  shareToken: string | null;
  isSharedMode: boolean;
  sharedVisits: CountryVisit[];
  sharedUserName: string | null;
  onGoHome: () => void;
  visitListTab: "alphabetical" | "byContinent" | "map";
  onVisitListTabChange: (tab: "alphabetical" | "byContinent" | "map") => void;
}

async function handleDeleteVisit(visit: CountryVisit, cell: HTMLElement, onRefresh: () => void): Promise<void> {
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
      { once: true },
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
 * Renders the main #app content from current state: visited countries section and add-visit form when logged in, or shared list when #s=token.
 */
function renderAppContent(container: HTMLElement, options: RenderOptions): void {
  const {
    countries: countriesList,
    visits: visitsList,
    user,
    isEditMode,
    onEditModeToggle,
    isSharedMode,
    sharedVisits: sharedVisitsList,
    sharedUserName: sharedUserNameVal,
    onGoHome,
  } = options;
  container.replaceChildren();

  if (isSharedMode) {
    const visitedSection = document.createElement("section");
    visitedSection.className = "app-section";
    const title = document.createElement("h2");
    title.textContent = sharedUserNameVal ? `${sharedUserNameVal}'s visited countries` : "Shared visit list";
    visitedSection.appendChild(title);
    const displayList = sortedVisitsAlphabetically(uniqueVisitsByCountry(sharedVisitsList), countriesList);
    const contentArea = document.createElement("div");
    contentArea.className = "visit-list-content";
    if (options.visitListTab === "map") {
      const uniqueCodes = [...new Set(displayList.map((v) => v.countryCode))];
      createVisitMap(contentArea, {
        countryCodes: uniqueCodes,
        countries: countriesList,
        visits: sharedVisitsList,
        baseUrl,
      });
    } else if (displayList.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No visited countries yet";
      empty.className = "visited-empty";
      contentArea.appendChild(empty);
    } else if (options.visitListTab === "alphabetical") {
      const grid = document.createElement("div");
      grid.className = "visited-grid visited-grid--enter";
      requestAnimationFrame(() => grid.classList.add("visible"));
      for (const visit of displayList) {
        const name = countriesList.find((c) => c.countryCode === visit.countryCode)?.name ?? visit.countryCode;
        const cell = createCountryCell(visit.countryCode, name, baseUrl, undefined);
        grid.appendChild(cell);
      }
      contentArea.appendChild(grid);
    } else {
      const groups = groupVisitsByContinent(displayList, countriesList);
      const wrapper = document.createElement("div");
      wrapper.className = "visit-list-by-continent";
      for (const { regionName, visits: groupVisits } of groups) {
        const section = document.createElement("div");
        section.className = "visit-list-by-continent__section";
        const subTitle = document.createElement("h3");
        subTitle.className = "visit-list-by-continent__title";
        subTitle.textContent = `${regionName} (${groupVisits.length})`;
        section.appendChild(subTitle);
        const grid = document.createElement("div");
        grid.className = "visited-grid visited-grid--enter";
        requestAnimationFrame(() => grid.classList.add("visible"));
        for (const visit of groupVisits) {
          const name = countriesList.find((c) => c.countryCode === visit.countryCode)?.name ?? visit.countryCode;
          const cell = createCountryCell(visit.countryCode, name, baseUrl, undefined);
          grid.appendChild(cell);
        }
        section.appendChild(grid);
        wrapper.appendChild(section);
      }
      contentArea.appendChild(wrapper);
    }
    const tabRow = document.createElement("div");
    tabRow.className = "visit-list-tabs";
    const tabAlphabetical = document.createElement("button");
    tabAlphabetical.type = "button";
    tabAlphabetical.className = "visit-list-tabs__tab";
    if (options.visitListTab === "alphabetical") tabAlphabetical.classList.add("visit-list-tabs__tab--active");
    tabAlphabetical.textContent = "Alphabetical";
    tabAlphabetical.addEventListener("click", () => options.onVisitListTabChange("alphabetical"));
    const tabByContinent = document.createElement("button");
    tabByContinent.type = "button";
    tabByContinent.className = "visit-list-tabs__tab";
    if (options.visitListTab === "byContinent") tabByContinent.classList.add("visit-list-tabs__tab--active");
    tabByContinent.textContent = "By continent";
    tabByContinent.addEventListener("click", () => options.onVisitListTabChange("byContinent"));
    const tabMap = document.createElement("button");
    tabMap.type = "button";
    tabMap.className = "visit-list-tabs__tab";
    if (options.visitListTab === "map") tabMap.classList.add("visit-list-tabs__tab--active");
    tabMap.textContent = "Map";
    tabMap.addEventListener("click", () => options.onVisitListTabChange("map"));
    tabRow.appendChild(tabAlphabetical);
    tabRow.appendChild(tabByContinent);
    tabRow.appendChild(tabMap);
    const listFrame = document.createElement("div");
    listFrame.className = "visit-list-frame";
    listFrame.appendChild(contentArea);
    listFrame.appendChild(tabRow);
    visitedSection.appendChild(listFrame);
    const homeWrap = document.createElement("div");
    homeWrap.className = "share-home-wrap";
    const homeBtn = document.createElement("button");
    homeBtn.type = "button";
    homeBtn.textContent = "Home";
    homeBtn.className = "share-home-btn";
    homeBtn.addEventListener("click", onGoHome);
    homeWrap.appendChild(homeBtn);
    visitedSection.appendChild(homeWrap);
    container.appendChild(visitedSection);
    return;
  }

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
  const uniqueCount = uniqueVisitsByCountry(visitsList).length;
  visitedTitle.textContent = `Your visited countries (${uniqueCount})`;
  titleRow.appendChild(visitedTitle);
  const editDoneBtn = document.createElement("button");
  editDoneBtn.type = "button";
  editDoneBtn.textContent = isEditMode ? "Done" : "Edit";
  editDoneBtn.className = "edit-done-btn";
  editDoneBtn.disabled = options.visitListTab === "map";
  editDoneBtn.addEventListener("click", onEditModeToggle);
  attachTooltip(
    editDoneBtn,
    options.visitListTab === "map"
      ? "Edit is not available in Map view"
      : isEditMode
        ? "Click to complete editing"
        : "Click to edit the visits list",
  );
  titleRow.appendChild(editDoneBtn);
  visitedSection.appendChild(titleRow);

  const contentArea = document.createElement("div");
  contentArea.className = "visit-list-content";
  if (options.visitListTab === "map") {
    const uniqueCodes = [...new Set(displayList.map((v) => v.countryCode))];
    createVisitMap(contentArea, {
      countryCodes: uniqueCodes,
      countries: countriesList,
      visits: visitsList,
      baseUrl,
    });
  } else if (displayList.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No visited countries yet";
    empty.className = "visited-empty";
    contentArea.appendChild(empty);
  } else if (options.visitListTab === "alphabetical") {
    const sortedList = sortedVisitsAlphabetically(displayList, countriesList);
    const grid = document.createElement("div");
    grid.className = "visited-grid visited-grid--enter";
    requestAnimationFrame(() => grid.classList.add("visible"));
    for (const visit of sortedList) {
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
    contentArea.appendChild(grid);
  } else {
    const groups = groupVisitsByContinent(displayList, countriesList);
    const wrapper = document.createElement("div");
    wrapper.className = "visit-list-by-continent";
    for (const { regionName, visits: groupVisits } of groups) {
      const section = document.createElement("div");
      section.className = "visit-list-by-continent__section";
      const subTitle = document.createElement("h3");
      subTitle.className = "visit-list-by-continent__title";
      subTitle.textContent = `${regionName} (${groupVisits.length})`;
      section.appendChild(subTitle);
      const grid = document.createElement("div");
      grid.className = "visited-grid visited-grid--enter";
      requestAnimationFrame(() => grid.classList.add("visible"));
      for (const visit of groupVisits) {
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
      section.appendChild(grid);
      wrapper.appendChild(section);
    }
    contentArea.appendChild(wrapper);
  }
  const tabRow = document.createElement("div");
  tabRow.className = "visit-list-tabs";
  const tabAlphabetical = document.createElement("button");
  tabAlphabetical.type = "button";
  tabAlphabetical.className = "visit-list-tabs__tab";
  if (options.visitListTab === "alphabetical") tabAlphabetical.classList.add("visit-list-tabs__tab--active");
  tabAlphabetical.textContent = "Alphabetical";
  tabAlphabetical.addEventListener("click", () => options.onVisitListTabChange("alphabetical"));
  const tabByContinent = document.createElement("button");
  tabByContinent.type = "button";
  tabByContinent.className = "visit-list-tabs__tab";
  if (options.visitListTab === "byContinent") tabByContinent.classList.add("visit-list-tabs__tab--active");
  tabByContinent.textContent = "By continent";
  tabByContinent.addEventListener("click", () => options.onVisitListTabChange("byContinent"));
  const tabMap = document.createElement("button");
  tabMap.type = "button";
  tabMap.className = "visit-list-tabs__tab";
  if (options.visitListTab === "map") tabMap.classList.add("visit-list-tabs__tab--active");
  tabMap.textContent = "Map";
  tabMap.addEventListener("click", () => options.onVisitListTabChange("map"));
  tabRow.appendChild(tabAlphabetical);
  tabRow.appendChild(tabByContinent);
  tabRow.appendChild(tabMap);
  const listFrame = document.createElement("div");
  listFrame.className = "visit-list-frame";
  listFrame.appendChild(contentArea);
  listFrame.appendChild(tabRow);
  visitedSection.appendChild(listFrame);
  container.appendChild(visitedSection);

  // Section: Add visited country
  const addSection = document.createElement("section");
  addSection.className = "app-section";
  const addTitle = document.createElement("h2");
  addTitle.textContent = "Add a visited country";
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
  dayInput.disabled = true;
  row.appendChild(dayInput);

  const addBtn = document.createElement("button");
  addBtn.type = "submit";
  addBtn.textContent = "Add";
  addBtn.className = "add-visit-form__add-btn";
  addBtn.disabled = true;
  row.appendChild(addBtn);

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
    const hasYearAndMonth = !!yearInput.value.trim() && options.selectedMonth != null;
    dayInput.disabled = !hasYearAndMonth;
    const canSubmit = !!options.selectedCountryCode && v.valid;
    addBtn.disabled = !canSubmit;
  }

  function onYearValueChange(): void {
    options.onFormYearChange(yearInput.value);
    updateValidationUI();
  }
  yearInput.addEventListener("input", onYearValueChange);
  yearInput.addEventListener("keyup", onYearValueChange);
  yearInput.addEventListener("change", () => {
    onYearValueChange();
    const yStr = yearInput.value.trim();
    const y = yStr ? parseInt(yStr, 10) : NaN;
    if (!isNaN(y) && y >= 1900 && y <= currentYear) {
      options.onFormDayChange("1");
      dayInput.value = "1";
      options.setSelectedMonth(1);
    }
  });
  yearInput.addEventListener("blur", updateValidationUI);
  function onDayValueChange(): void {
    options.onFormDayChange(dayInput.value);
    updateValidationUI();
  }
  dayInput.addEventListener("input", onDayValueChange);
  dayInput.addEventListener("keyup", onDayValueChange);
  dayInput.addEventListener("change", onDayValueChange);

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
  updateValidationUI();

  addSection.appendChild(form);
  container.appendChild(addSection);

  // Section: Sharing
  const shareSection = createShareSection(options.shareToken);
  container.appendChild(shareSection);
}

export async function main(): Promise<void> {
  const authHeaderEl = document.getElementById("auth-header");
  const appEl = document.getElementById("app");
  if (!appEl) return;

  let currentUser: User | null = null;
  let isEditMode = false;
  let visitListTab: "alphabetical" | "byContinent" | "map" = "alphabetical";
  let selectedCountryCode = "";
  let selectedMonth: number | null = null;
  let formYear = "";
  let formDay = "";

  function onGoHome(): void {
    window.location.hash = "";
  }
  function onLogin(): void {
    sessionStorage.setItem("login:initiated", "1");
    signInWithGoogle().catch((err) => {
      sessionStorage.removeItem("login:initiated");
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
        shareToken,
        isSharedMode: !!getShareTokenFromHash(),
        sharedVisits,
        sharedUserName,
        onGoHome: () => {
          window.location.hash = "";
          sharedVisits = [];
          sharedUserName = null;
          refreshAppContent();
        },
        visitListTab,
        onVisitListTabChange: (tab: "alphabetical" | "byContinent" | "map") => {
          visitListTab = tab;
          refreshAppContent();
        },
      });
  }

  if (authHeaderEl) {
    const unsubscribe = subscribeToAuthStateChanged(async (user) => {
      currentUser = user;
      if (user) {
        const token = await user.getIdToken();
        api.setAuthToken(token);
        // POST /login only when user just completed the Login button flow (ensures user in DB before GET /visits).
        const loginInitiated = sessionStorage.getItem("login:initiated");
        if (loginInitiated) {
          try {
            await api.postLogin();
          } catch (err) {
            console.error("Post-login failed", err);
            if (err instanceof ApiError && err.responseCode === 401) {
              signOut();
              errorToast("Session expired");
            } else {
              errorToast("Failed to complete login");
            }
            sessionStorage.removeItem("login:initiated");
            renderAuthHeader(authHeaderEl, user, onLogin, onLogout, false, onGoHome);
            refreshAppContent();
            return;
          }
          sessionStorage.removeItem("login:initiated");
        }
        if (!getShareTokenFromHash()) {
          try {
            const result = await api.getVisits();
            visits = result.visits;
            shareToken = result.shareToken ?? null;
          } catch (err) {
            console.error("Failed to load visits", err);
            visits = [];
            shareToken = null;
            if (err instanceof ApiError && err.responseCode === 401) {
              signOut();
              errorToast("Session expired");
            } else {
              errorToast("Failed to load visits");
            }
          }
        }
      } else {
        api.setAuthToken(null);
        visits = [];
        shareToken = null;
      }
      const showHome = !!getShareTokenFromHash();
      renderAuthHeader(authHeaderEl, user, onLogin, onLogout, showHome, onGoHome);
      refreshAppContent();
    });
    void unsubscribe;
  }

  try {
    countries = await api.getCountries();
    console.log("App initialized with", countries.length, "countries");
  } catch (err) {
    countries = [];
    console.error("Countries load failed", err);
  }

  async function applyHash(): Promise<void> {
    const token = getShareTokenFromHash();
    if (token) {
      try {
        const r = await api.getShareVisits(token);
        sharedVisits = r.visits;
        sharedUserName = r.userName;
      } catch (err) {
        console.error("Failed to load shared visits", err);
        errorToast("Invalid or expired share link");
        sharedVisits = [];
        sharedUserName = null;
      }
    } else {
      sharedVisits = [];
      sharedUserName = null;
    }
    if (authHeaderEl) {
      renderAuthHeader(authHeaderEl, currentUser, onLogin, onLogout, !!getShareTokenFromHash(), onGoHome);
    }
    refreshAppContent();
  }

  window.addEventListener("hashchange", () => {
    applyHash();
  });

  await applyHash();

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
      event.error,
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
