import type { GlobeInstance } from "globe.gl";
import { buildCountryFillValues, getVisitedHighlightCodes, type CountryFillValue } from "../visits-map-shared/colors";
import type { VisitsVizHandle, VisitsVizOptions } from "../visits-map-shared/options";
import { buildCountryNames, buildVisitsMapTooltip, groupVisitsByCountry } from "../visits-map-shared/tooltip";
import { buildPinData, createPinResources, POLYGON_ALTITUDE, type PinDatum, type PinResources } from "./pins";

export type CreateVisitsGlobeOptions = VisitsVizOptions;
export type { VisitsVizHandle };

const AUTO_ROTATE_SPEED = -0.12; /* negative = opposite equatorial direction */
const POLYGON_ALPHA = 0.3;
const POLYGON_HOVER_ALPHA = 0.5;

interface GeoFeature {
  type: string;
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
}

interface GeoFeatureCollection {
  type: string;
  features: GeoFeature[];
}

function featureIso(props: Record<string, unknown>): string | null {
  for (const key of ["ISO_A2", "WB_A2"] as const) {
    const v = props[key];
    if (typeof v === "string" && v.trim() && v !== "-99") {
      return v.trim().toUpperCase();
    }
  }
  return null;
}

function hexToRgba(cap: string, alpha: number): string {
  if (cap.startsWith("#") && (cap.length === 7 || cap.length === 4)) {
    const hex = cap.length === 4 ? `#${cap[1]}${cap[1]}${cap[2]}${cap[2]}${cap[3]}${cap[3]}` : cap;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return `rgba(64,224,208,${alpha})`;
}

function sideColorFromCap(cap: string, alpha: number): string {
  if (cap.startsWith("#") && (cap.length === 7 || cap.length === 4)) {
    const hex = cap.length === 4 ? `#${cap[1]}${cap[1]}${cap[2]}${cap[2]}${cap[3]}${cap[3]}` : cap;
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return `rgba(0,0,0,${alpha})`;
}

function fullscreenElement(): Element | null {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
  };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

async function requestFullscreen(el: HTMLElement): Promise<void> {
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  if (el.requestFullscreen) {
    await el.requestFullscreen();
  } else if (anyEl.webkitRequestFullscreen) {
    await anyEl.webkitRequestFullscreen();
  }
}

async function exitFullscreen(): Promise<void> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
  };
  if (document.exitFullscreen) {
    await document.exitFullscreen();
  } else if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
  }
}

/**
 * Autonomous 3D globe (Globe.GL). Lazy-loads globe.gl and GeoJSON/textures on create.
 */
export function createVisitsGlobe(parent: HTMLElement, options: CreateVisitsGlobeOptions): VisitsVizHandle {
  const { countryCodes, countries, visits, baseUrl, onViewMediaUrl } = options;

  const root = document.createElement("div");
  root.className = "visits-globe";
  if (options.height != null) {
    root.style.height = `${options.height}px`;
  }
  parent.appendChild(root);

  const canvasHost = document.createElement("div");
  canvasHost.className = "visits-globe__canvas";
  root.appendChild(canvasHost);

  const fsBtn = document.createElement("button");
  fsBtn.type = "button";
  fsBtn.className = "visits-globe__fs-btn";
  fsBtn.title = "Fullscreen";
  fsBtn.setAttribute("aria-label", "Fullscreen");
  fsBtn.textContent = "Fullscreen";
  root.appendChild(fsBtn);

  const tooltipEl = document.createElement("div");
  tooltipEl.className = "visits-globe__tooltip";
  tooltipEl.hidden = true;
  root.appendChild(tooltipEl);

  const visitsByCountry = groupVisitsByCountry(visits);
  const listedCodes = new Set(countries.map((c) => c.countryCode.toUpperCase()));
  const fillValues = buildCountryFillValues(countryCodes, countries, visits);
  const visitedCodes = getVisitedHighlightCodes(fillValues);
  const countryNames = buildCountryNames(countries);

  let disposed = false;
  let world: GlobeInstance | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let pinResources: PinResources | null = null;
  let pointerX = 0;
  let pointerY = 0;
  let hideTooltipTimer: ReturnType<typeof setTimeout> | null = null;
  let activeTooltipIso: string | null = null;
  let hoveredIso: string | null = null;

  const clearHideTooltipTimer = () => {
    if (hideTooltipTimer != null) {
      clearTimeout(hideTooltipTimer);
      hideTooltipTimer = null;
    }
  };

  const positionTooltip = () => {
    const pad = 14;
    const tw = tooltipEl.offsetWidth;
    const th = tooltipEl.offsetHeight;
    let left = pointerX + pad;
    let top = pointerY + pad;
    if (left + tw > root.clientWidth - 4) left = pointerX - tw - pad;
    if (top + th > root.clientHeight - 4) top = pointerY - th - pad;
    tooltipEl.style.left = `${Math.max(4, left)}px`;
    tooltipEl.style.top = `${Math.max(4, top)}px`;
  };

  const hideTooltip = () => {
    clearHideTooltipTimer();
    activeTooltipIso = null;
    tooltipEl.hidden = true;
    tooltipEl.replaceChildren();
  };

  const showTooltipForIso = (iso: string) => {
    clearHideTooltipTimer();
    if (activeTooltipIso !== iso) {
      activeTooltipIso = iso;
      const content = buildVisitsMapTooltip({
        countryID: iso,
        countryNames,
        listedCodes,
        visitsByCountry,
        baseUrl,
        onViewMediaUrl,
      });
      tooltipEl.replaceChildren(content);
    }
    tooltipEl.hidden = false;
    positionTooltip();
  };

  const onPointerMove = (e: PointerEvent) => {
    const rect = root.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerY = e.clientY - rect.top;
    if (!tooltipEl.hidden) positionTooltip();
  };

  root.addEventListener("pointermove", onPointerMove);
  tooltipEl.addEventListener("pointerenter", clearHideTooltipTimer);
  tooltipEl.addEventListener("pointerleave", () => {
    hideTooltipTimer = setTimeout(hideTooltip, 120);
  });

  const isGlobeFullscreen = () => fullscreenElement() === root;

  const syncFullscreenButton = () => {
    const on = isGlobeFullscreen();
    root.classList.toggle("visits-globe--fullscreen", on);
    fsBtn.textContent = on ? "Exit fullscreen" : "Fullscreen";
    fsBtn.title = on ? "Exit fullscreen" : "Fullscreen";
    fsBtn.setAttribute("aria-label", fsBtn.title);
  };

  const onFullscreenChange = () => {
    syncFullscreenButton();
    if (world && !disposed) {
      world.width(Math.max(1, root.clientWidth));
      world.height(Math.max(1, root.clientHeight || Math.round(root.clientWidth * 0.6)));
    }
  };

  const onFsClick = () => {
    void (async () => {
      try {
        if (isGlobeFullscreen()) {
          await exitFullscreen();
        } else {
          await requestFullscreen(root);
        }
      } catch (err) {
        console.error("fullscreen toggle failed:", err);
      }
    })();
  };

  fsBtn.addEventListener("click", onFsClick);
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);

  const asset = (name: string) => `${baseUrl}/assets/globe/${name}`;

  void (async () => {
    try {
      const [{ default: Globe }, geoRes] = await Promise.all([
        import("globe.gl"),
        fetch(asset("ne_110m_admin_0_countries.geojson")),
      ]);
      if (disposed) return;

      if (!geoRes.ok) {
        console.error("failed to load countries geojson:", geoRes.status);
        return;
      }

      const collection = (await geoRes.json()) as GeoFeatureCollection;
      if (disposed) return;

      const visitedFeatures = collection.features.filter((f) => {
        const iso = featureIso(f.properties);
        return iso != null && visitedCodes.has(iso);
      });

      for (const f of visitedFeatures) {
        const iso = featureIso(f.properties);
        if (iso) f.properties.__iso = iso;
      }

      const pins = buildPinData(visitedFeatures);
      pinResources = createPinResources(baseUrl);
      const { createPinObject } = pinResources;

      const polygonAlpha = (iso: string | null): number =>
        iso != null && iso === hoveredIso ? POLYGON_HOVER_ALPHA : POLYGON_ALPHA;

      const polygonCapColor = (feat: object): string => {
        const f = feat as GeoFeature;
        const iso = (f.properties.__iso as string) ?? featureIso(f.properties);
        const fill: CountryFillValue | undefined = iso ? fillValues[iso] : undefined;
        return hexToRgba(fill?.color ?? "#40e0d0", polygonAlpha(iso));
      };

      const polygonSideColor = (feat: object): string => {
        const f = feat as GeoFeature;
        const iso = (f.properties.__iso as string) ?? featureIso(f.properties);
        const fill: CountryFillValue | undefined = iso ? fillValues[iso] : undefined;
        return sideColorFromCap(fill?.color ?? "#40e0d0", polygonAlpha(iso));
      };

      const setHoveredIso = (iso: string | null) => {
        if (hoveredIso === iso) return;
        hoveredIso = iso;
        if (world) {
          world.polygonCapColor(polygonCapColor).polygonSideColor(polygonSideColor);
        }
      };

      const w = Math.max(1, root.clientWidth);
      const h = Math.max(1, root.clientHeight || Math.round(w * 0.6));

      world = new Globe(canvasHost)
        .width(w)
        .height(h)
        .backgroundColor("rgba(0,0,0,0)")
        .globeImageUrl(asset("earth-blue-marble.jpg"))
        .bumpImageUrl(asset("earth-topology.png"))
        .showAtmosphere(true)
        .enablePointerInteraction(true)
        .showPointerCursor(true)
        .polygonsData(visitedFeatures)
        .polygonAltitude(POLYGON_ALTITUDE)
        .polygonCapColor(polygonCapColor)
        .polygonSideColor(polygonSideColor)
        .polygonStrokeColor(() => "rgba(0,0,0,0.15)")
        .objectsData(pins)
        .objectLat("lat")
        .objectLng("lng")
        .objectAltitude(POLYGON_ALTITUDE)
        .objectFacesSurface(true)
        .objectThreeObject(createPinObject)
        .pointOfView({ altitude: 1.85 })
        .polygonsTransitionDuration(0)
        .onPolygonHover((polygon: object | null) => {
          if (!polygon) {
            setHoveredIso(null);
            hideTooltipTimer = setTimeout(hideTooltip, 120);
            return;
          }
          const f = polygon as GeoFeature;
          const iso = (f.properties.__iso as string) ?? featureIso(f.properties);
          if (!iso) {
            setHoveredIso(null);
            hideTooltip();
            return;
          }
          setHoveredIso(iso);
          showTooltipForIso(iso);
        })
        .onObjectHover((obj: object | null) => {
          if (!obj) {
            setHoveredIso(null);
            hideTooltipTimer = setTimeout(hideTooltip, 120);
            return;
          }
          const pin = obj as PinDatum;
          if (!pin.iso) {
            setHoveredIso(null);
            hideTooltip();
            return;
          }
          setHoveredIso(pin.iso);
          showTooltipForIso(pin.iso);
        });

      const controls = world.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
      controls.enableDamping = true;

      resizeObserver = new ResizeObserver(() => {
        if (!world || disposed) return;
        world.width(Math.max(1, root.clientWidth));
        world.height(Math.max(1, root.clientHeight || Math.round(root.clientWidth * 0.6)));
      });
      resizeObserver.observe(root);
      syncFullscreenButton();
    } catch (err) {
      console.error("failed to create visits globe:", err);
    }
  })();

  return {
    dispose: () => {
      disposed = true;
      hideTooltip();
      root.removeEventListener("pointermove", onPointerMove);
      fsBtn.removeEventListener("click", onFsClick);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      if (isGlobeFullscreen()) {
        void exitFullscreen().catch((err) => {
          console.error("failed to exit fullscreen on dispose:", err);
        });
      }
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (world) {
        try {
          world.pauseAnimation();
          world._destructor();
        } catch (err) {
          console.error("failed to dispose visits globe:", err);
        }
        world = null;
      }
      pinResources?.dispose();
      pinResources = null;
      root.remove();
    },
  };
}

