/** Subtle centered spinner overlay for map / globe lazy load. */

export interface MapLoadingHandle {
  dismiss: () => void;
}

export function showMapLoading(parent: HTMLElement): MapLoadingHandle {
  const el = document.createElement("div");
  el.className = "visit-map-loading";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-label", "Loading map");

  const spinner = document.createElement("div");
  spinner.className = "visit-map-loading__spinner";
  spinner.setAttribute("aria-hidden", "true");
  el.appendChild(spinner);

  parent.appendChild(el);

  return {
    dismiss: () => {
      el.remove();
    },
  };
}
