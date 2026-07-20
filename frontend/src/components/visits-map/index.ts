import svgMap from "svgmap";
import "svgmap/style";
import {
  buildCountryFillValues,
  COLOR_UNVISITED_SOVEREIGN,
  COLOR_VISITED_DEFAULT,
} from "../visits-map-shared/colors";
import { showMapLoading } from "../visits-map-shared/loading";
import type {
  VisitsVizHandle,
  VisitsVizOptions,
} from "../visits-map-shared/options";
import {
  buildCountryNames,
  buildVisitsMapTooltip,
  groupVisitsByCountry,
} from "../visits-map-shared/tooltip";
import { attachTouchPanPinch } from "./touch-pan-pinch";

export type CreateVisitsMapOptions = VisitsVizOptions;
export type { VisitsVizHandle };

interface SvgPanZoomPublic {
  resize: () => unknown;
  fit: () => unknown;
  center: () => unknown;
  getSizes: () => {
    width: number;
    height: number;
    realZoom: number;
    viewBox: { x: number; y: number; width: number; height: number };
  };
  getPan: () => { x: number; y: number };
  pan: (point: { x: number; y: number }) => unknown;
  panBy: (point: { x: number; y: number }) => unknown;
  getZoom: () => number;
  zoomAtPoint: (scale: number, point: { x: number; y: number }) => unknown;
  setBeforePan: (
    fn: (
      oldPan: { x: number; y: number },
      newPan: { x: number; y: number }
    ) => { x: number; y: number } | boolean
  ) => unknown;
}

interface SvgMapWithPanZoom {
  mapPanZoom?: SvgPanZoomPublic;
}

function contentCenterPan(sizes: ReturnType<SvgPanZoomPublic["getSizes"]>): {
  x: number;
  y: number;
} {
  return {
    x:
      (sizes.width - sizes.viewBox.width * sizes.realZoom) / 2 -
      sizes.viewBox.x * sizes.realZoom,
    y:
      (sizes.height - sizes.viewBox.height * sizes.realZoom) / 2 -
      sizes.viewBox.y * sizes.realZoom,
  };
}

function panMapToShellCenter(panZoom: SvgPanZoomPublic): void {
  panZoom.pan(contentCenterPan(panZoom.getSizes()));
}

/**
 * svgMap’s stock beforePan uses 85% gutters. When the map is shorter than the shell,
 * topLimit > bottomLimit and `Math.max(top, Math.min(bottom, y))` always yields topLimit,
 * which parks the equator in the lower part of the container (and rejects center pans).
 *
 * Keep the same gutter math, but clamp with ordered min/max so center stays reachable and
 * finger pan/pinch can move freely. Do not force-center here — that blocks gestures.
 */
function constrainPanToShell(
  panZoom: SvgPanZoomPublic,
  newPan: { x: number; y: number }
): { x: number; y: number } {
  const sizes = panZoom.getSizes();
  const gutterW = sizes.width * 0.85;
  const gutterH = sizes.height * 0.85;

  const leftLimit =
    -((sizes.viewBox.x + sizes.viewBox.width) * sizes.realZoom) + gutterW;
  const rightLimit =
    sizes.width - gutterW - sizes.viewBox.x * sizes.realZoom;
  const topLimit =
    -((sizes.viewBox.y + sizes.viewBox.height) * sizes.realZoom) + gutterH;
  const bottomLimit =
    sizes.height - gutterH - sizes.viewBox.y * sizes.realZoom;

  const minX = Math.min(leftLimit, rightLimit);
  const maxX = Math.max(leftLimit, rightLimit);
  const minY = Math.min(topLimit, bottomLimit);
  const maxY = Math.max(topLimit, bottomLimit);

  return {
    x: Math.max(minX, Math.min(maxX, newPan.x)),
    y: Math.max(minY, Math.min(maxY, newPan.y)),
  };
}

/** Fit to width and place the map’s equator on the shell’s center Y. */
function alignMapToShellCenter(panZoom: SvgPanZoomPublic): void {
  panZoom.resize();
  panZoom.fit();
  panZoom.center();
  panMapToShellCenter(panZoom);
}

/**
 * Autonomous 2D Mercator world map (svgMap).
 * Visited countries use continent colors; map-only region rules match user-interface.md.
 */
export function createVisitsMap(
  parent: HTMLElement,
  options: CreateVisitsMapOptions
): VisitsVizHandle {
  const { countryCodes, countries, visits, baseUrl, onViewMediaUrl } = options;
  const container = document.createElement("div");
  container.className = "visits-map visit-list-map";
  const id = "visits-map-" + Math.random().toString(36).slice(2);
  container.id = id;
  if (options.height != null) {
    container.style.height = `${options.height}px`;
  }
  parent.appendChild(container);

  const loading = showMapLoading(container);

  const visitsByCountry = groupVisitsByCountry(visits);
  const listedCodes = new Set(countries.map((c) => c.countryCode.toUpperCase()));
  const values = buildCountryFillValues(countryCodes, countries, visits);
  const countryNames = buildCountryNames(countries);

  let disposed = false;
  let resizeObserver: ResizeObserver | null = null;
  let detachTouch: (() => void) | null = null;

  const startSvgMap = (): void => {
    if (disposed || !document.getElementById(id)) return;
    // svgMap zoom fails with a non-invertible SVGMatrix when the wrapper is 0×0.
    if (container.clientWidth < 2 || container.clientHeight < 2) {
      requestAnimationFrame(startSvgMap);
      return;
    }
    try {
      const mapInstance = new svgMap({
        targetElementID: id,
        countryNames,
        showZoomReset: true,
        // Keep 1 so svgMap’s post-init zoom does not shift the fitted center.
        initialZoom: 1,
        flagURL: `${baseUrl}/assets/images/{0}.jpg`,
        colorNoData: COLOR_UNVISITED_SOVEREIGN,
        colorMin: COLOR_UNVISITED_SOVEREIGN,
        colorMax: COLOR_VISITED_DEFAULT,
        onGetTooltip: (
          _tooltipDiv: HTMLElement,
          countryID: string,
          _countryValues: Record<string, unknown>
        ): HTMLElement => {
          return buildVisitsMapTooltip({
            countryID,
            countryNames,
            listedCodes,
            visitsByCountry,
            baseUrl,
            onViewMediaUrl,
          });
        },
        data: {
          data: {
            visited: {
              name: "Visited",
            },
          },
          applyData: "visited",
          values,
          colorNoData: COLOR_UNVISITED_SOVEREIGN,
          colorMin: COLOR_UNVISITED_SOVEREIGN,
          colorMax: COLOR_VISITED_DEFAULT,
        },
      }) as SvgMapWithPanZoom;

      const panZoom = mapInstance.mapPanZoom;
      if (!panZoom) {
        loading.dismiss();
        return;
      }

      // Fix inverted overview gutter clamp without locking pan/zoom gestures.
      panZoom.setBeforePan((_oldPan, newPan) =>
        constrainPanToShell(panZoom, newPan)
      );

      const mapSvg = container.querySelector(".svgMap-map-image");
      if (mapSvg instanceof SVGElement) {
        // Explicit pixel size so svg-pan-zoom’s fit/center uses the full shell.
        mapSvg.setAttribute("width", String(container.clientWidth));
        mapSvg.setAttribute("height", String(container.clientHeight));
      }

      // Take over touch: stock svg-pan-zoom has no pinch (pan + double-tap only).
      const touchRoot =
        container.querySelector(".svgMap-map-wrapper") instanceof HTMLElement
          ? (container.querySelector(".svgMap-map-wrapper") as HTMLElement)
          : container;
      detachTouch = attachTouchPanPinch(touchRoot, panZoom);

      const syncAlignment = (): void => {
        if (disposed) return;
        try {
          if (mapSvg instanceof SVGElement) {
            mapSvg.setAttribute("width", String(container.clientWidth));
            mapSvg.setAttribute("height", String(container.clientHeight));
          }
          alignMapToShellCenter(panZoom);
        } catch (err) {
          console.error("failed to align visits map:", err);
        }
      };

      // Align after layout settles (first paint can still report a short SVG).
      syncAlignment();
      requestAnimationFrame(() => {
        syncAlignment();
        requestAnimationFrame(() => {
          syncAlignment();
          if (!disposed) loading.dismiss();
        });
      });

      container.addEventListener("contextmenu", (e) => {
        e.preventDefault();
      });

      resizeObserver = new ResizeObserver(() => {
        if (disposed) return;
        try {
          if (mapSvg instanceof SVGElement) {
            mapSvg.setAttribute("width", String(container.clientWidth));
            mapSvg.setAttribute("height", String(container.clientHeight));
          }
          panZoom.resize();
          // Keep current pan inside the (now possibly reordered) gutter bounds.
          panZoom.pan(constrainPanToShell(panZoom, panZoom.getPan()));
        } catch (err) {
          console.error("failed to resize visits map:", err);
        }
      });
      resizeObserver.observe(container);
    } catch (err) {
      console.error("failed to create visits map:", err);
      loading.dismiss();
    }
  };

  requestAnimationFrame(startSvgMap);

  return {
    dispose: () => {
      disposed = true;
      detachTouch?.();
      detachTouch = null;
      resizeObserver?.disconnect();
      resizeObserver = null;
      loading.dismiss();
      container.remove();
    },
  };
}
