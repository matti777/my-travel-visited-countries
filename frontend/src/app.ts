import { errorToast } from "Components/toast";
import { renderAuthHeader } from "Components/auth";
import { subscribeToAuthStateChanged, signInWithGoogle, signOut } from "./firebase";
import { api } from "./api";
import type { Country } from "./types/country";

/** Country list from GET /countries, filled after app start (from cache or backend). */
export let countries: Country[] = [];

// This is the entry point function
export async function main() {
  const authHeaderEl = document.getElementById("auth-header");
  if (authHeaderEl) {
    const unsubscribe = subscribeToAuthStateChanged(async (user) => {
      if (user) {
        const token = await user.getIdToken();
        api.setAuthToken(token);
      } else {
        api.setAuthToken(null);
      }
      renderAuthHeader(authHeaderEl, user, onLogin, onLogout);
    });
    function onLogin() {
      signInWithGoogle().catch((err) => {
        console.error("Sign in failed:", err);
        errorToast(err instanceof Error ? err.message : "Sign in failed");
      });
    }
    function onLogout() {
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

  const appEl = document.getElementById("app");
  if (appEl) {
    appEl.replaceChildren();
    const p = document.createElement("p");
    p.textContent = "Hello, world from TS";
    appEl.appendChild(p);
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";
    const flagPath = (code: string) => `${base}/assets/images/${code}.jpg`;
    const fi = document.createElement("img");
    fi.src = flagPath("fi");
    fi.alt = "Finland";
    fi.width = 40;
    appEl.appendChild(fi);
    const fr = document.createElement("img");
    fr.src = flagPath("fr");
    fr.alt = "France";
    fr.width = 40;
    appEl.appendChild(fr);
    const de = document.createElement("img");
    de.src = flagPath("de");
    de.alt = "Germany";
    de.width = 40;
    appEl.appendChild(de);
  }

  // Global "catch-all" exception handler
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

  // await initializeApi();

  // doAuthentication();
}

document.addEventListener("DOMContentLoaded", function () {
  // Run our app entry point main() when the index.html document has loaded.
  main();
});
