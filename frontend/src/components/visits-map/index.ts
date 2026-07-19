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

  const startSvgMap = (): void => {
    if (disposed || !document.getElementById(id)) return;
    // svgMap zoom fails with a non-invertible SVGMatrix when the wrapper is 0×0.
    if (container.clientWidth < 2 || container.clientHeight < 2) {
      requestAnimationFrame(startSvgMap);
      return;
    }
    try {
      new svgMap({
        targetElementID: id,
        countryNames,
        showZoomReset: true,
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
      });
      const mapSvg = container.querySelector(".svgMap-map-image");
      if (mapSvg instanceof SVGElement) {
        // Full-width fit; vertically centered in the tall shell viewport.
        mapSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      }
    } catch (err) {
      console.error("failed to create visits map:", err);
    }
  };

  requestAnimationFrame(startSvgMap);

  return {
    dispose: () => {
      disposed = true;
      container.remove();
    },
  };
}
