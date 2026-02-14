import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { errorToast } from "Components/toast";
import { renderAuthHeader } from "Components/auth";
import { createCountryCell } from "Components/country-cell";
import { createCountryDropdown } from "Components/country-dropdown";
import { createShareSection } from "Components/share-section";
import { createVisitMap } from "Components/visit-map";
import { attachTooltip } from "Components/tooltip";
import { subscribeToAuthStateChanged, signInWithGoogle, signOut } from "./firebase";
import { api, ApiError } from "./api";
import type { Country } from "./types/country";
import type { Friend } from "./types/friend";
import type { CountryVisit } from "./types/visit";
import type { User } from "firebase/auth";

/** Country list from GET /countries, filled after app start (from cache or backend). */
export let countries: Country[] = [];

/** Country visits from GET /visits, filled when user is authenticated (on load and on login). */
export let visits: CountryVisit[] = [];

/** Share token from GET /visits response; used for Share URL when logged in. */
let shareToken: string | null = null;

/** Friends list from GET /friends, filled when user is authenticated (on load and on login). */
let friends: Friend[] = [];

/** Shared visit list when URL has #s=<share-token>. */
let sharedVisits: CountryVisit[] = [];
let sharedUserName: string | null = null;
/** Image URL of the shared user (from GET /share/visits). */
let sharedUserImageUrl: string | null = null;

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
    visits: [...visits].sort((a, b) => {
      const nameCmp = nameFor(a.countryCode).localeCompare(nameFor(b.countryCode));
      if (nameCmp !== 0) return nameCmp;
      return (a.visitedTime ?? "").localeCompare(b.visitedTime ?? "");
    }),
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
  formVisitDate: string | null;
  onFormVisitDateChange: (value: string | null) => void;
  formMediaUrl: string;
  onFormMediaUrlChange: (value: string) => void;
  shareToken: string | null;
  isSharedMode: boolean;
  sharedVisits: CountryVisit[];
  sharedUserName: string | null;
  sharedUserImageUrl: string | null;
  onGoHome: () => void;
  visitListTab: "alphabetical" | "byContinent" | "map";
  onVisitListTabChange: (tab: "alphabetical" | "byContinent" | "map") => void;
  onLogin: () => void;
  friends: Friend[];
  onAddFriend: () => void;
  onDeleteFriend: (shareToken: string) => void;
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

function createVisitListTabRow(
  visitListTab: RenderOptions["visitListTab"],
  onVisitListTabChange: RenderOptions["onVisitListTabChange"]
): HTMLElement {
  const tabRow = document.createElement("div");
  tabRow.className = "visit-list-tabs";
  const tabs: { tab: "alphabetical" | "byContinent" | "map"; label: string }[] = [
    { tab: "alphabetical", label: "Alphabetical" },
    { tab: "byContinent", label: "By continent" },
    { tab: "map", label: "Map" },
  ];
  for (const { tab, label } of tabs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "visit-list-tabs__tab";
    if (visitListTab === tab) btn.classList.add("visit-list-tabs__tab--active");
    btn.textContent = label;
    btn.addEventListener("click", () => onVisitListTabChange(tab));
    tabRow.appendChild(btn);
  }
  return tabRow;
}

interface FillVisitListContentParams {
  contentArea: HTMLElement;
  displayList: CountryVisit[];
  countriesList: Country[];
  visitListTab: RenderOptions["visitListTab"];
  visitsForMap: CountryVisit[];
  isEditMode?: boolean;
  onRefresh?: () => void;
}

function fillVisitListContent(params: FillVisitListContentParams): void {
  const {
    contentArea,
    displayList,
    countriesList,
    visitListTab,
    visitsForMap,
    isEditMode = false,
    onRefresh,
  } = params;

  if (visitListTab === "map") {
    const uniqueCodes = [...new Set(displayList.map((v) => v.countryCode))];
    createVisitMap(contentArea, {
      countryCodes: uniqueCodes,
      countries: countriesList,
      visits: visitsForMap,
      baseUrl,
    });
    return;
  }
  if (displayList.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No visited countries yet";
    empty.className = "visited-empty";
    contentArea.appendChild(empty);
    return;
  }

  function addCellToGrid(
    grid: HTMLElement,
    visit: CountryVisit,
    name: string,
    withEdit: boolean,
    showVisitTimeAlways?: boolean
  ): void {
    const cellRef: { current: HTMLElement | null } = { current: null };
    const showVisitTime = showVisitTimeAlways || (withEdit && visit.id && onRefresh);
    const cellOptions = showVisitTime
      ? {
          visitTimeLabel: formatVisitTime(visit.visitedTime),
          onDelete:
            withEdit && visit.id && onRefresh
              ? () => {
                  if (cellRef.current) handleDeleteVisit(visit, cellRef.current, onRefresh);
                }
              : undefined,
        }
      : undefined;
    const cell = createCountryCell(visit.countryCode, name, baseUrl, cellOptions);
    cellRef.current = cell;
    if (visit.mediaUrl && showVisitTimeAlways) {
      cell.classList.add("country-cell--has-media");
      attachTooltip(cell, "Click to view attached media");
      cell.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest?.(".country-cell__delete")) return;
        window.open(visit.mediaUrl!, "_blank");
      });
    }
    const isNew = visit.id != null && newVisitIds.has(visit.id);
    if (isNew) {
      cell.classList.add("cell-fade-in");
      requestAnimationFrame(() => {
        cell.classList.add("visible");
        if (visit.id) newVisitIds.delete(visit.id);
      });
    }
    grid.appendChild(cell);
  }

  if (visitListTab === "alphabetical") {
    const sortedList = sortedVisitsAlphabetically(displayList, countriesList);
    const grid = document.createElement("div");
    grid.className = "visited-grid visited-grid--enter";
    requestAnimationFrame(() => grid.classList.add("visible"));
    for (const visit of sortedList) {
      const name = countriesList.find((c) => c.countryCode === visit.countryCode)?.name ?? visit.countryCode;
      addCellToGrid(grid, visit, name, isEditMode);
    }
    contentArea.appendChild(grid);
    return;
  }

  const groups = groupVisitsByContinent(displayList, countriesList);
  const wrapper = document.createElement("div");
  wrapper.className = "visit-list-by-continent";
  for (const { regionName, visits: groupVisits } of groups) {
    const section = document.createElement("div");
    section.className = "visit-list-by-continent__section";
    const subTitle = document.createElement("h3");
    subTitle.className = "visit-list-by-continent__title";
    const countryCount = new Set(groupVisits.map((v) => v.countryCode)).size;
    subTitle.textContent = `${regionName} (${countryCount})`;
    section.appendChild(subTitle);
    const grid = document.createElement("div");
    grid.className = "visited-grid visited-grid--enter";
    requestAnimationFrame(() => grid.classList.add("visible"));
    for (const visit of groupVisits) {
      const name = countriesList.find((c) => c.countryCode === visit.countryCode)?.name ?? visit.countryCode;
      addCellToGrid(grid, visit, name, isEditMode, true);
    }
    section.appendChild(grid);
    wrapper.appendChild(section);
  }
  contentArea.appendChild(wrapper);
}

function renderSharedVisitSection(container: HTMLElement, options: RenderOptions): void {
  const { countries: countriesList, sharedVisits: sharedVisitsList, sharedUserName: sharedUserNameVal, onGoHome } = options;
  const visitedSection = document.createElement("section");
  visitedSection.className = "app-section";
  const title = document.createElement("h2");
  title.textContent = sharedUserNameVal ? `${sharedUserNameVal}'s visited countries` : "Shared visit list";
  visitedSection.appendChild(title);
  const displayList =
    options.visitListTab === "byContinent"
      ? sharedVisitsList
      : sortedVisitsAlphabetically(uniqueVisitsByCountry(sharedVisitsList), countriesList);
  const contentArea = document.createElement("div");
  contentArea.className = "visit-list-content";
  fillVisitListContent({
    contentArea,
    displayList,
    countriesList,
    visitListTab: options.visitListTab,
    visitsForMap: sharedVisitsList,
  });
  const tabRow = createVisitListTabRow(options.visitListTab, options.onVisitListTabChange);
  const listFrame = document.createElement("div");
  listFrame.className =
    "visit-list-frame visit-list-frame--tab-" +
    (options.visitListTab === "alphabetical" ? "0" : options.visitListTab === "byContinent" ? "1" : "2");
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
}

function renderAddFriendSection(container: HTMLElement, options: RenderOptions): void {
  const currentShareToken = getShareTokenFromHash();
  const { sharedUserName: name, sharedUserImageUrl: imageUrl, friends: friendsList, onAddFriend } = options;
  if (!currentShareToken || name == null) return;
  const isAlreadyFriend = friendsList.some((f) => f.shareToken === currentShareToken);
  const section = document.createElement("section");
  section.className = "app-section add-friend-section";
  if (isAlreadyFriend) {
    const text = document.createElement("p");
    text.className = "add-friend-section__text";
    text.textContent = `${name} is in your friend list.`;
    section.appendChild(text);
  } else {
    const box = document.createElement("div");
    box.className = "add-friend-section__box";
    const text = document.createElement("p");
    text.className = "add-friend-section__text";
    text.textContent = `Would you like to add ${name} to your friends list?`;
    box.appendChild(text);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "add-friend-section__btn";
    btn.textContent = "Add friend";
    btn.addEventListener("click", () => onAddFriend());
    box.appendChild(btn);
    section.appendChild(box);
  }
  container.appendChild(section);
}

function renderNormalVisitedSection(
  container: HTMLElement,
  options: RenderOptions,
  displayList: CountryVisit[]
): void {
  const { countries: countriesList, visits: visitsList, isEditMode, onEditModeToggle } = options;
  const visitedSection = document.createElement("section");
  visitedSection.className = "app-section";
  const titleRow = document.createElement("div");
  titleRow.className = "app-section__title-row";
  const visitedTitle = document.createElement("h2");
  visitedTitle.textContent = `Your visited countries (${uniqueVisitsByCountry(visitsList).length})`;
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
  fillVisitListContent({
    contentArea,
    displayList,
    countriesList,
    visitListTab: options.visitListTab,
    visitsForMap: visitsList,
    isEditMode,
    onRefresh: options.onRefresh,
  });
  const tabRow = createVisitListTabRow(options.visitListTab, options.onVisitListTabChange);
  const listFrame = document.createElement("div");
  listFrame.className =
    "visit-list-frame visit-list-frame--tab-" +
    (options.visitListTab === "alphabetical" ? "0" : options.visitListTab === "byContinent" ? "1" : "2");
  listFrame.appendChild(contentArea);
  listFrame.appendChild(tabRow);
  visitedSection.appendChild(listFrame);
  container.appendChild(visitedSection);
}

const VISIT_DATE_MIN = "1900-01-01";
const MIN_DATE = new Date(1900, 0, 1);

/** Parse YYYY-MM-DD to Date at local midnight (for flatpickr). */
function parseIsoToLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isMediaUrlValid(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  try {
    const u = new URL(trimmed);
    const scheme = u.protocol.replace(/:$/, "").toLowerCase();
    return scheme === "http" || scheme === "https";
  } catch {
    return false;
  }
}

function isVisitDateValid(isoDate: string | null): boolean {
  if (!isoDate) return false;
  const d = new Date(isoDate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  const min = new Date(VISIT_DATE_MIN + "T00:00:00Z").getTime();
  const now = new Date();
  const max = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const t = d.getTime();
  return t >= min && t <= max;
}

/** Unix seconds for start of day UTC from YYYY-MM-DD. */
function isoDateToUnixSeconds(isoDate: string): number {
  return Math.floor(new Date(isoDate + "T00:00:00Z").getTime() / 1000);
}

function renderAddVisitSection(container: HTMLElement, options: RenderOptions): void {
  const { countries: countriesList } = options;
  const today = new Date();

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
  row.appendChild(
    createCountryDropdown({
      countries: countriesList,
      baseUrl,
      selectedCountryCode: options.selectedCountryCode,
      onSelect: options.onSelectCountry,
    })
  );
  const visitTimeLabel = document.createElement("span");
  visitTimeLabel.className = "add-visit-form__visit-time-label";
  visitTimeLabel.textContent = "Visit date";
  row.appendChild(visitTimeLabel);
  const dateInput = document.createElement("input");
  dateInput.type = "text";
  dateInput.placeholder = "Enter visit date";
  dateInput.name = "visitDate";
  dateInput.className = "add-visit-form__date-input";
  dateInput.autocomplete = "off";
  row.appendChild(dateInput);
  form.appendChild(row);
  const visitTimeHint = document.createElement("p");
  visitTimeHint.className = "add-visit-form__visit-time-hint";
  visitTimeHint.textContent = "Visit date is required and must be between Jan 1, 1900 and today.";
  form.appendChild(visitTimeHint);

  const mediaUrlRow = document.createElement("div");
  mediaUrlRow.className = "add-visit-form__row";
  const mediaUrlInput = document.createElement("input");
  mediaUrlInput.type = "text";
  mediaUrlInput.placeholder = "Optional media URL";
  mediaUrlInput.name = "mediaUrl";
  mediaUrlInput.className = "add-visit-form__media-url";
  mediaUrlInput.autocomplete = "off";
  mediaUrlInput.value = options.formMediaUrl;
  mediaUrlRow.appendChild(mediaUrlInput);
  form.appendChild(mediaUrlRow);
  const mediaUrlHint = document.createElement("p");
  mediaUrlHint.className = "add-visit-form__media-url-hint";
  mediaUrlHint.textContent =
    "You can attach a link to media such as a picture collection or video from your trip.";
  form.appendChild(mediaUrlHint);

  const addBtnRow = document.createElement("div");
  addBtnRow.className = "add-visit-form__add-row";
  const addBtn = document.createElement("button");
  addBtn.type = "submit";
  addBtn.textContent = "Add";
  addBtn.className = "add-visit-form__add-btn";
  addBtn.disabled = true;
  addBtnRow.appendChild(addBtn);
  form.appendChild(addBtnRow);

  function updateValidationUI(): void {
    const dateValid = isVisitDateValid(options.formVisitDate);
    const mediaUrlValid = isMediaUrlValid(mediaUrlInput.value);
    dateInput.classList.toggle("invalid", options.formVisitDate != null && !dateValid);
    mediaUrlInput.classList.toggle(
      "invalid",
      mediaUrlInput.value.trim() !== "" && !mediaUrlValid,
    );
    addBtn.disabled = !(options.selectedCountryCode && dateValid && mediaUrlValid);
  }

  mediaUrlInput.addEventListener("input", () => {
    options.onFormMediaUrlChange(mediaUrlInput.value);
    updateValidationUI();
  });
  mediaUrlInput.addEventListener("blur", updateValidationUI);

  const defaultDate = options.formVisitDate
    ? parseIsoToLocalDate(options.formVisitDate)
    : today;
  const fp = flatpickr(dateInput, {
    allowInput: true,
    dateFormat: "M j, Y",
    defaultDate,
    minDate: MIN_DATE,
    maxDate: today,
    disable: [],
    onChange: (selectedDates) => {
      const d = selectedDates[0];
      if (d) {
        const iso =
          d.getFullYear() +
          "-" +
          String(d.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(d.getDate()).padStart(2, "0");
        options.onFormVisitDateChange(iso);
      } else {
        options.onFormVisitDateChange(null);
      }
      updateValidationUI();
    },
  });

  fp.setDate(defaultDate, false);
  dateInput.value = fp.input.value ?? "";

  updateValidationUI();

  addBtn.addEventListener("click", async () => {
    const countryCode = options.selectedCountryCode;
    if (!countryCode) {
      errorToast("Please select a country");
      return;
    }
    const isoDate = options.formVisitDate;
    if (!isoDate || !isVisitDateValid(isoDate)) {
      errorToast("Please select a valid visit date");
      return;
    }
    const visitedTime = isoDateToUnixSeconds(isoDate);
    const mediaUrl = mediaUrlInput.value.trim() || undefined;
    try {
      const created = await api.putVisits(countryCode, visitedTime, mediaUrl);
      visits = [...visits, created];
      if (created.id) newVisitIds.add(created.id);
      options.onSelectCountry("");
      options.onFormVisitDateChange(new Date().toISOString().slice(0, 10));
      options.onFormMediaUrlChange("");
      options.onRefresh();
    } catch (err) {
      if (err instanceof ApiError && err.responseCode === 401) {
        signOut();
        errorToast("Session expired");
      } else {
        errorToast(err instanceof Error ? err.message : "Failed to add visit");
      }
    }
  });

  addSection.appendChild(form);
  container.appendChild(addSection);
}

/** 4 Polaroid images: [left top, left bottom, right top, right bottom] */
const WELCOME_POLAROID_IMAGES = [
  "welcome-polaroid-1.jpg",
  "welcome-polaroid-2.jpg",
  "welcome-polaroid-3.jpg",
  "welcome-polaroid-4.jpg",
];

/** Rotation in degrees for fridge-pin look: left top, left bottom, right top, right bottom */
const WELCOME_POLAROID_ROTATIONS = ["-4deg", "3deg", "2deg", "-5deg"];

function renderWelcomeView(container: HTMLElement, onLogin: () => void): void {
  const wrap = document.createElement("div");
  wrap.className = "welcome-view";

  const inner = document.createElement("div");
  inner.className = "welcome-view__inner";

  const leftSide = document.createElement("div");
  leftSide.className = "welcome-view__side welcome-view__side--left";
  for (let i = 0; i < 2; i++) {
    const polaroid = document.createElement("div");
    polaroid.className = "welcome-view__polaroid";
    polaroid.style.transform = `rotate(${WELCOME_POLAROID_ROTATIONS[i]})`;
    const img = document.createElement("img");
    img.src = `${baseUrl}/assets/images/${WELCOME_POLAROID_IMAGES[i]}`;
    img.alt = "";
    img.loading = "lazy";
    polaroid.appendChild(img);
    leftSide.appendChild(polaroid);
  }
  inner.appendChild(leftSide);

  const content = document.createElement("div");
  content.className = "welcome-view__content";
  const title = document.createElement("h2");
  title.className = "welcome-view__title";
  title.textContent = "Welcome to My Countries";
  content.appendChild(title);
  const p1 = document.createElement("p");
  p1.className = "welcome-view__text";
  p1.textContent =
    "Track the countries you have visited and explore your travel history. View your list alphabetically, by continent, or on a world map. Add visits with optional dates and attach links to photos or videos from your trips.";
  content.appendChild(p1);
  const p2 = document.createElement("p");
  p2.className = "welcome-view__text";
  p2.textContent =
    "You can share a read-only link so friends can see your country list. Sign in to get started.";
  content.appendChild(p2);
  const loginWrap = document.createElement("div");
  loginWrap.className = "welcome-view__login-wrap";
  const loginBtn = document.createElement("button");
  loginBtn.type = "button";
  loginBtn.className = "welcome-view__login-btn";
  loginBtn.textContent = "Login";
  loginBtn.addEventListener("click", onLogin);
  loginWrap.appendChild(loginBtn);
  content.appendChild(loginWrap);
  inner.appendChild(content);

  const rightSide = document.createElement("div");
  rightSide.className = "welcome-view__side welcome-view__side--right";
  for (let i = 2; i < 4; i++) {
    const polaroid = document.createElement("div");
    polaroid.className = "welcome-view__polaroid";
    polaroid.style.transform = `rotate(${WELCOME_POLAROID_ROTATIONS[i]})`;
    const img = document.createElement("img");
    img.src = `${baseUrl}/assets/images/${WELCOME_POLAROID_IMAGES[i]}`;
    img.alt = "";
    img.loading = "lazy";
    polaroid.appendChild(img);
    rightSide.appendChild(polaroid);
  }
  inner.appendChild(rightSide);

  wrap.appendChild(inner);
  container.appendChild(wrap);
}

/**
 * Renders the main #app content from current state: visited countries section and add-visit form when logged in, or shared list when #s=token.
 */
function renderAppContent(container: HTMLElement, options: RenderOptions): void {
  const { user, isEditMode, visits: visitsList, isSharedMode } = options;
  container.replaceChildren();

  if (isSharedMode) {
    renderSharedVisitSection(container, options);
    if (user) {
      renderAddFriendSection(container, options);
    }
    return;
  }
  if (!user) {
    renderWelcomeView(container, options.onLogin);
    return;
  }

  const displayList =
    isEditMode || options.visitListTab === "byContinent"
      ? visitsList
      : uniqueVisitsByCountry(visitsList);
  renderNormalVisitedSection(container, options, displayList);
  const addShareWrapper = document.createElement("div");
  addShareWrapper.id = "app-add-share";
  renderAddVisitSection(addShareWrapper, options);
  addShareWrapper.appendChild(createShareSection(options.shareToken));
  container.appendChild(addShareWrapper);

  renderFriendsListSection(container, options);
}

function renderFriendsListSection(container: HTMLElement, options: RenderOptions): void {
  const { friends: friendsList, onDeleteFriend } = options;
  const section = document.createElement("section");
  section.className = "app-section friends-section";
  const title = document.createElement("h2");
  title.className = "friends-section__title";
  title.textContent = "Friends";
  section.appendChild(title);
  const list = document.createElement("div");
  list.className = "friends-list";
  if (friendsList.length === 0) {
    const empty = document.createElement("p");
    empty.className = "friends-section__empty";
    empty.textContent = "No friends yet";
    list.appendChild(empty);
  } else {
    for (const friend of friendsList) {
      const cell = document.createElement("div");
      cell.className = "friend-cell";
      const linkArea = document.createElement("div");
      linkArea.className = "friend-cell__link-area";
      if (friend.imageUrl) {
        const img = document.createElement("img");
        img.src = friend.imageUrl;
        img.alt = "";
        img.className = "friend-cell__avatar";
        linkArea.appendChild(img);
      }
      const nameEl = document.createElement("span");
      nameEl.className = "friend-cell__name";
      nameEl.textContent = friend.name;
      linkArea.appendChild(nameEl);
      const viewLink = document.createElement("span");
      viewLink.className = "friend-cell__view";
      viewLink.textContent = "View";
      linkArea.appendChild(viewLink);
      linkArea.addEventListener("click", () => {
        window.location.hash = "s=" + friend.shareToken;
      });
      attachTooltip(linkArea, `Click to view country visits by ${friend.name}`);
      cell.appendChild(linkArea);
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "friend-cell__delete";
      deleteBtn.textContent = "✕";
      deleteBtn.setAttribute("aria-label", "Remove friend");
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        onDeleteFriend(friend.shareToken);
      });
      attachTooltip(deleteBtn, `Click to remove ${friend.name} as friend`);
      cell.appendChild(deleteBtn);
      list.appendChild(cell);
    }
  }
  section.appendChild(list);
  container.appendChild(section);
}

export async function main(): Promise<void> {
  const authHeaderEl = document.getElementById("auth-header");
  const appEl = document.getElementById("app");
  if (!appEl) return;

  let currentUser: User | null = null;
  let isEditMode = false;
  let visitListTab: "alphabetical" | "byContinent" | "map" = "alphabetical";
  let selectedCountryCode = "";
  const todayIso = () => new Date().toISOString().slice(0, 10);
  let formVisitDate: string | null = todayIso();
  let formMediaUrl = "";

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

  function getRenderOptions(): RenderOptions {
    return {
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
        refreshAddFormAndShare();
      },
      formVisitDate,
      onFormVisitDateChange: (value: string | null) => {
        formVisitDate = value;
        refreshAddFormAndShare();
      },
      formMediaUrl,
      onFormMediaUrlChange: (value: string) => {
        formMediaUrl = value;
      },
      shareToken,
      isSharedMode: !!getShareTokenFromHash(),
      sharedVisits,
      sharedUserName,
      sharedUserImageUrl,
      onGoHome: () => {
        window.location.hash = "";
        sharedVisits = [];
        sharedUserName = null;
        sharedUserImageUrl = null;
        refreshAppContent();
      },
      visitListTab,
      onVisitListTabChange: (tab: "alphabetical" | "byContinent" | "map") => {
        visitListTab = tab;
        refreshAppContent();
      },
      onLogin,
      friends,
      onAddFriend: async () => {
        const token = getShareTokenFromHash();
        if (!token || sharedUserName == null) return;
        try {
          await api.postFriend(token, sharedUserName, sharedUserImageUrl ?? undefined);
          friends = [
            ...friends,
            { shareToken: token, name: sharedUserName, imageUrl: sharedUserImageUrl ?? undefined },
          ];
          refreshAppContent();
        } catch (err) {
          if (err instanceof ApiError && err.responseCode === 401) {
            signOut();
            errorToast("Session expired");
          } else {
            errorToast(err instanceof Error ? err.message : "Failed to add friend");
          }
        }
      },
      onDeleteFriend: async (shareTokenToDelete: string) => {
        try {
          await api.deleteFriend(shareTokenToDelete);
          friends = friends.filter((f) => f.shareToken !== shareTokenToDelete);
          refreshAppContent();
        } catch (err) {
          if (err instanceof ApiError && err.responseCode === 401) {
            signOut();
            errorToast("Session expired");
          } else {
            errorToast(err instanceof Error ? err.message : "Failed to remove friend");
          }
        }
      },
    };
  }

  function refreshAddFormAndShare(): void {
    if (!appEl) return;
    const addShareWrapper = document.getElementById("app-add-share");
    if (!addShareWrapper) return;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    addShareWrapper.replaceChildren();
    renderAddVisitSection(addShareWrapper, getRenderOptions());
    addShareWrapper.appendChild(createShareSection(shareToken));
    window.scrollTo(scrollX, scrollY);
  }

  function refreshAppContent(): void {
    if (!appEl) return;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    renderAppContent(appEl, getRenderOptions());
    window.scrollTo(scrollX, scrollY);
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
          const [visitsSettled, friendsSettled] = await Promise.allSettled([
            api.getVisits(),
            api.getFriends(),
          ]);
          if (visitsSettled.status === "fulfilled") {
            visits = visitsSettled.value.visits;
            shareToken = visitsSettled.value.shareToken ?? null;
          } else {
            visits = [];
            shareToken = null;
            console.error("Failed to load visits", visitsSettled.reason);
            if (visitsSettled.reason instanceof ApiError && visitsSettled.reason.responseCode === 401) {
              signOut();
              errorToast("Session expired");
            } else {
              errorToast("Failed to load visits");
            }
          }
          if (friendsSettled.status === "fulfilled") {
            friends = friendsSettled.value.friends;
          } else {
            friends = [];
            console.error("Failed to load friends", friendsSettled.reason);
          }
        }
      } else {
        api.setAuthToken(null);
        visits = [];
        shareToken = null;
        friends = [];
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
        sharedUserImageUrl = r.imageUrl ?? null;
      } catch (err) {
        console.error("Failed to load shared visits", err);
        errorToast("Invalid or expired share link");
        sharedVisits = [];
        sharedUserName = null;
        sharedUserImageUrl = null;
      }
    } else {
      sharedVisits = [];
      sharedUserName = null;
      sharedUserImageUrl = null;
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
