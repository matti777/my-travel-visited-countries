import svgMap from "svgmap";
import "svgmap/style";
import {
  buildCountryFillValues,
  COLOR_UNVISITED_SOVEREIGN,
  COLOR_VISITED_DEFAULT,
} from "../visits-map-shared/colors";
import type {
  VisitsVizHandle,
  VisitsVizOptions,
} from "../visits-map-shared/options";
import {
  buildCountryNames,
  buildVisitsMapTooltip,
  groupVisitsByCountry,
} from "../visits-map-shared/tooltip";

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
  setBeforePan: (
    fn: (
      oldPan: { x: number; y: number },
      newPan: { x: number; y: number }
    ) => { x: number; y: number } | boolean
  ) => unknown;
  setOnZoom: (fn: (scale: number) => void) => unknown;
}

interface SvgMapWithPanZoom {
  mapPanZoom?: SvgPanZoomPublic;
  setControlStatuses?: () => void;
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
 * svgMap’s stock beforePan uses 85% gutters. When the map is shorter than the shell
 * (overview / zoomed-out), topLimit > bottomLimit and Math.max/min always resolves to
 * topLimit — which parks the equator in the lower part of the container. Any pan()
 * (including center) is forced there too.
 *
 * When content fits an axis, pin that axis to the shell center (equator on center-Y).
 * When zoomed in past the shell, keep gutter-style pan limits with ordered bounds.
 */
function constrainPanToShell(
  panZoom: SvgPanZoomPublic,
  newPan: { x: number; y: number }
): { x: number; y: number } {
  const sizes = panZoom.getSizes();
  const contentW = sizes.viewBox.width * sizes.realZoom;
  const contentH = sizes.viewBox.height * sizes.realZoom;
  const center = contentCenterPan(sizes);
  // 1px slack for float / subpixel layout.
  const fitsX = contentW <= sizes.width + 1;
  const fitsY = contentH <= sizes.height + 1;

  let x = newPan.x;
  let y = newPan.y;

  if (fitsX) {
    x = center.x;
  } else {
    const gutterW = sizes.width * 0.85;
    const leftLimit =
      -((sizes.viewBox.x + sizes.viewBox.width) * sizes.realZoom) + gutterW;
    const rightLimit =
      sizes.width - gutterW - sizes.viewBox.x * sizes.realZoom;
    const minX = Math.min(leftLimit, rightLimit);
    const maxX = Math.max(leftLimit, rightLimit);
    x = Math.max(minX, Math.min(maxX, x));
  }

  if (fitsY) {
    y = center.y;
  } else {
    const gutterH = sizes.height * 0.85;
    const topLimit =
      -((sizes.viewBox.y + sizes.viewBox.height) * sizes.realZoom) + gutterH;
    const bottomLimit =
      sizes.height - gutterH - sizes.viewBox.y * sizes.realZoom;
    const minY = Math.min(topLimit, bottomLimit);
    const maxY = Math.max(topLimit, bottomLimit);
    y = Math.max(minY, Math.min(maxY, y));
  }

  return { x, y };
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

  const visitsByCountry = groupVisitsByCountry(visits);
  const listedCodes = new Set(countries.map((c) => c.countryCode.toUpperCase()));
  const values = buildCountryFillValues(countryCodes, countries, visits);
  const countryNames = buildCountryNames(countries);

  let disposed = false;
  let resizeObserver: ResizeObserver | null = null;

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
        return;
      }

      // Replace svgMap’s inverted overview clamp (see constrainPanToShell).
      panZoom.setBeforePan((_oldPan, newPan) =>
        constrainPanToShell(panZoom, newPan)
      );

      const mapSvg = container.querySelector(".svgMap-map-image");
      if (mapSvg instanceof SVGElement) {
        // Explicit pixel size so svg-pan-zoom’s fit/center uses the full shell.
        mapSvg.setAttribute("width", String(container.clientWidth));
        mapSvg.setAttribute("height", String(container.clientHeight));
      }

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

      /** After zoom-out past shell height, snap equator back to center-Y. */
      const recenterIfContentFits = (): void => {
        if (disposed) return;
        try {
          const sizes = panZoom.getSizes();
          const contentH = sizes.viewBox.height * sizes.realZoom;
          if (contentH <= sizes.height + 1) {
            panMapToShellCenter(panZoom);
          }
        } catch (err) {
          console.error("failed to recenter visits map:", err);
        }
      };

      panZoom.setOnZoom(() => {
        mapInstance.setControlStatuses?.();
        recenterIfContentFits();
      });

      // Align after layout settles (first paint can still report a short SVG).
      syncAlignment();
      requestAnimationFrame(() => {
        syncAlignment();
        requestAnimationFrame(syncAlignment);
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
          recenterIfContentFits();
        } catch (err) {
          console.error("failed to resize visits map:", err);
        }
      });
      resizeObserver.observe(container);
    } catch (err) {
      console.error("failed to create visits map:", err);
    }
  };

  requestAnimationFrame(startSvgMap);

  return {
    dispose: () => {
      disposed = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      container.remove();
    },
  };
}
