import { errorToast } from "Components/toast";

// This is the entry point function
export async function main() {
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
    console.error("Unhandled promise rejection (EventListener):", event.reason);
    event.preventDefault();
  });

  // await initializeApi();

  // doAuthentication();
}

document.addEventListener("DOMContentLoaded", function () {
  // Run our app entry point main() when the index.html document has loaded.
  main();
});
