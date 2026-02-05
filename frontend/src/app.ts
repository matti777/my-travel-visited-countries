import { errorToast } from "Components/toast";
import { renderAuthHeader } from "Components/auth";
import { createCountryCell } from "Components/country-cell";
import { subscribeToAuthStateChanged, signInWithGoogle, signOut } from "./firebase";
import { api, ApiError } from "./api";
import type { Country } from "./types/country";
import type { CountryVisit } from "./types/visit";
import type { User } from "firebase/auth";

/** Country list from GET /countries, filled after app start (from cache or backend). */
export let countries: Country[] = [];

/** Country visits from GET /visits, filled when user is authenticated (on load and on login). */
export let visits: CountryVisit[] = [];

const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";

/**
 * Renders the main #app content from current state: visited countries section and add-visit form when logged in.
 */
function renderAppContent(
  container: HTMLElement,
  options: { countries: Country[]; visits: CountryVisit[]; user: User | null }
): void {
  const { countries: countriesList, visits: visitsList, user } = options;
  container.replaceChildren();

  if (!user) {
    const p = document.createElement("p");
    p.textContent = "Sign in to see and add your visited countries.";
    p.className = "visited-empty";
    container.appendChild(p);
    return;
  }

  // Section: Your Visited Countries
  const visitedSection = document.createElement("section");
  visitedSection.className = "app-section";
  const visitedTitle = document.createElement("h2");
  visitedTitle.textContent = "Your visited countries";
  visitedSection.appendChild(visitedTitle);

  if (visitsList.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No visited countries yet";
    empty.className = "visited-empty";
    visitedSection.appendChild(empty);
  } else {
    const grid = document.createElement("div");
    grid.className = "visited-grid";
    for (const visit of visitsList) {
      const name = countriesList.find((c) => c.countryCode === visit.countryCode)?.name ?? visit.countryCode;
      grid.appendChild(createCountryCell(visit.countryCode, name, baseUrl));
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

  const select = document.createElement("select");
  select.name = "country";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a country";
  select.appendChild(placeholder);
  const visitedCodes = new Set(visitsList.map((v) => v.countryCode));
  for (const c of countriesList) {
    if (visitedCodes.has(c.countryCode)) continue;
    const opt = document.createElement("option");
    opt.value = c.countryCode;
    opt.textContent = c.name;
    select.appendChild(opt);
  }
  form.appendChild(select);

  const yearInput = document.createElement("input");
  yearInput.type = "number";
  yearInput.placeholder = "Year (optional)";
  yearInput.min = "1900";
  yearInput.max = "2100";
  yearInput.name = "year";
  form.appendChild(yearInput);

  const monthInput = document.createElement("input");
  monthInput.type = "number";
  monthInput.placeholder = "Month 1-12 (optional)";
  monthInput.min = "1";
  monthInput.max = "12";
  monthInput.name = "month";
  form.appendChild(monthInput);

  const dayInput = document.createElement("input");
  dayInput.type = "number";
  dayInput.placeholder = "Day 1-31 (optional)";
  dayInput.min = "1";
  dayInput.max = "31";
  dayInput.name = "day";
  form.appendChild(dayInput);

  const addBtn = document.createElement("button");
  addBtn.type = "submit";
  addBtn.textContent = "Add";
  addBtn.addEventListener("click", async () => {
    const countryCode = select.value;
    if (!countryCode) {
      errorToast("Please select a country");
      return;
    }
    let visitedTime: number | undefined;
    const y = yearInput.value ? parseInt(yearInput.value, 10) : NaN;
    if (!isNaN(y)) {
      const month = monthInput.value ? parseInt(monthInput.value, 10) : 1;
      const day = dayInput.value ? parseInt(dayInput.value, 10) : 1;
      const d = new Date(Date.UTC(y, month - 1, day));
      visitedTime = Math.floor(d.getTime() / 1000);
    }
    try {
      await api.putVisits(countryCode, visitedTime);
      visits = await api.getVisits();
      renderAppContent(container, { countries: countriesList, visits, user });
      yearInput.value = "";
      monthInput.value = "";
      dayInput.value = "";
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

  addSection.appendChild(form);
  container.appendChild(addSection);
}

export async function main(): Promise<void> {
  const authHeaderEl = document.getElementById("auth-header");
  const appEl = document.getElementById("app");
  if (!appEl) return;

  let currentUser: User | null = null;

  function refreshAppContent(): void {
    if (appEl) renderAppContent(appEl, { countries, visits, user: currentUser });
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
