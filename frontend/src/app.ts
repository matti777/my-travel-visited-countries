import { errorToast } from "Components/toast";

// This is the entry point function
export async function main() {
  const appEl = document.getElementById("app");
  if (appEl) {
    appEl.textContent = "Hello, world from TS";
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
