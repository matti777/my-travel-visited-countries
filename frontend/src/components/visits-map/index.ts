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
}

interface SvgMapWithPanZoom {
  mapPanZoom?: SvgPanZoomPublic;
}

/** Fit to width and place the map’s vertical center on the shell’s center Y. */
function alignMapToShellCenter(panZoom: SvgPanZoomPublic): void {
  panZoom.resize();
  panZoom.fit();
  panZoom.center();
  const sizes = panZoom.getSizes();
  const pan = panZoom.getPan();
  const centerY =
    (sizes.height - sizes.viewBox.height * sizes.realZoom) / 2 -
    sizes.viewBox.y * sizes.realZoom;
  panZoom.pan({ x: pan.x, y: centerY });
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

      // Align after layout settles (first paint can still report a short SVG).
      syncAlignment();
      requestAnimationFrame(() => {
        syncAlignment();
        requestAnimationFrame(syncAlignment);
      });

      resizeObserver = new ResizeObserver(() => {
        if (disposed) return;
        try {
          panZoom.resize();
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
