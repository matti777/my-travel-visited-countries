import { showMapLoading } from "../visits-map-shared/loading";
import type {
  VisitsVizHandle,
  VisitsVizOptions,
} from "../visits-map-shared/options";

export type CreateVisitListMapShellOptions = VisitsVizOptions;
export type { VisitsVizHandle };

type MapMode = "2d" | "3d";

/**
 * Map tab shell: 2D/3D toggle over visits-map / visits-globe.
 * Default is 2D; svgMap and globe.gl load only when that mode mounts.
 */
export function createVisitListMapShell(
  parent: HTMLElement,
  options: CreateVisitListMapShellOptions
): VisitsVizHandle {
  const shell = document.createElement("div");
  shell.className = "visit-list-map-shell";
  parent.appendChild(shell);

  const pane = document.createElement("div");
  pane.className = "visit-list-map-shell__pane";
  shell.appendChild(pane);

  const toggle = document.createElement("div");
  toggle.className = "visit-list-map-shell__toggle";
  toggle.setAttribute("role", "tablist");
  toggle.setAttribute("aria-label", "Map projection");

  const btn2d = document.createElement("button");
  btn2d.type = "button";
  btn2d.className = "visit-list-map-shell__toggle-btn";
  btn2d.textContent = "2D";
  btn2d.title = "Flat Mercator view";
  btn2d.setAttribute("role", "tab");
  btn2d.setAttribute("aria-selected", "true");

  const btn3d = document.createElement("button");
  btn3d.type = "button";
  btn3d.className = "visit-list-map-shell__toggle-btn";
  btn3d.textContent = "3D";
  btn3d.title = "Globe view";
  btn3d.setAttribute("role", "tab");
  btn3d.setAttribute("aria-selected", "false");

  toggle.appendChild(btn2d);
  toggle.appendChild(btn3d);
  shell.appendChild(toggle);

  const stopMapPointer = (e: Event) => {
    e.stopPropagation();
  };
  for (const btn of [btn2d, btn3d]) {
    btn.addEventListener("pointerdown", stopMapPointer);
    btn.addEventListener("touchstart", stopMapPointer, { passive: true });
  }

  let mode: MapMode = "2d";
  let active: VisitsVizHandle | null = null;
  let disposed = false;
  let switching = false;

  const setToggleActive = (next: MapMode) => {
    btn2d.classList.toggle(
      "visit-list-map-shell__toggle-btn--active",
      next === "2d"
    );
    btn3d.classList.toggle(
      "visit-list-map-shell__toggle-btn--active",
      next === "3d"
    );
    btn2d.setAttribute("aria-selected", next === "2d" ? "true" : "false");
    btn3d.setAttribute("aria-selected", next === "3d" ? "true" : "false");
  };

  const setToggleDisabled = (disabled: boolean) => {
    btn2d.disabled = disabled;
    btn3d.disabled = disabled;
  };

  const mount2d = async () => {
    if (switching || disposed) return;
    switching = true;
    setToggleDisabled(true);
    const loading = showMapLoading(shell);
    try {
      const { createVisitsMap } = await import("../visits-map");
      if (disposed) return;
      pane.replaceChildren();
      active?.dispose();
      active = createVisitsMap(pane, options);
      mode = "2d";
      setToggleActive("2d");
    } catch (err) {
      console.error("failed to load 2D map view:", err);
    } finally {
      loading.dismiss();
      switching = false;
      if (!disposed) setToggleDisabled(false);
    }
  };

  const mount3d = async () => {
    if (switching || disposed) return;
    switching = true;
    setToggleDisabled(true);
    const loading = showMapLoading(shell);
    try {
      const { createVisitsGlobe } = await import("../visits-globe");
      if (disposed) return;
      pane.replaceChildren();
      active?.dispose();
      active = createVisitsGlobe(pane, options);
      mode = "3d";
      setToggleActive("3d");
    } catch (err) {
      console.error("failed to load 3D globe view:", err);
    } finally {
      loading.dismiss();
      switching = false;
      if (!disposed) setToggleDisabled(false);
    }
  };

  btn2d.addEventListener("click", () => {
    if (mode === "2d" || disposed) return;
    void mount2d();
  });

  btn3d.addEventListener("click", () => {
    if (mode === "3d" || disposed) return;
    void mount3d();
  });

  setToggleActive("2d");
  void mount2d();

  return {
    dispose: () => {
      disposed = true;
      active?.dispose();
      active = null;
      shell.remove();
    },
  };
}



