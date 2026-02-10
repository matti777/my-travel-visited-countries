import svgMap from "svgmap";
import "svgmap/style";
import type { Country } from "../../types/country";
import type { CountryVisit } from "../../types/visit";

/** Same turquoise as button color (--color-turquoise). */
const COLOR_VISITED = "#40e0d0";
/** Dark gray for unvisited countries so they stand out from ocean/background. */
const COLOR_NO_DATA = "#4a4a4a";

function formatVisitTime(visitedTime?: string): string {
  if (!visitedTime) return "—";
  const d = new Date(visitedTime);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export interface CreateVisitMapOptions {
  countryCodes: string[];
  countries: Country[];
  visits: CountryVisit[];
  baseUrl: string;
  /** Optional fixed height in px; default from CSS. */
  height?: number;
}

/**
 * Creates a world map inside the given parent element using svgMap.
 * Visited countries are highlighted with the app turquoise;
 * unvisited countries use a darker gray. Tooltips show Visits: N and each visit date.
 */
export function createVisitMap(
  parent: HTMLElement,
  options: CreateVisitMapOptions
): void {
  const { countryCodes, countries, visits, baseUrl } = options;
  const container = document.createElement("div");
  container.className = "visit-list-map";
  const id = "visit-map-" + Math.random().toString(36).slice(2);
  container.id = id;
  if (options.height != null) {
    container.style.height = `${options.height}px`;
  }
  parent.appendChild(container);

  const visitsByCountry = new Map<string, CountryVisit[]>();
  for (const v of visits) {
    const code = v.countryCode.toUpperCase();
    if (!visitsByCountry.has(code)) visitsByCountry.set(code, []);
    visitsByCountry.get(code)!.push(v);
  }

  const values: Record<string, { visited: number; color: string }> = {};
  for (const code of countryCodes) {
    values[code.toUpperCase()] = { visited: 1, color: COLOR_VISITED };
  }

  const countryNames: Record<string, string> = {};
  for (const c of countries) {
    countryNames[c.countryCode] = c.name;
  }

  // Defer so the container is in the document (parent may not be attached yet).
  requestAnimationFrame(() => {
    if (!document.getElementById(id)) return;
    new svgMap({
      targetElementID: id,
      countryNames,
      showZoomReset: true,
      flagURL: `${baseUrl}/assets/images/{0}.jpg`,
      onGetTooltip: (
        _tooltipDiv: HTMLElement,
        countryID: string,
        _countryValues: Record<string, unknown>
      ): HTMLElement => {
        const wrapper = document.createElement("div");
        wrapper.className = "svgMap-tooltip-content-container";
        const flagContainer = document.createElement("div");
        flagContainer.className =
          "svgMap-tooltip-flag-container svgMap-tooltip-flag-container-image";
        const img = document.createElement("img");
        img.className = "svgMap-tooltip-flag";
        img.src = `${baseUrl}/assets/images/${countryID.toLowerCase()}.jpg`;
        img.alt = "";
        flagContainer.appendChild(img);
        wrapper.appendChild(flagContainer);
        const title = document.createElement("div");
        title.className = "svgMap-tooltip-title";
        title.textContent = countryNames[countryID] ?? countryID;
        wrapper.appendChild(title);
        const content = document.createElement("div");
        content.className = "svgMap-tooltip-content";
        const list = visitsByCountry.get(countryID) ?? [];
        const visitsLabel = document.createElement("div");
        visitsLabel.textContent = `Visits: ${list.length}`;
        content.appendChild(visitsLabel);
        for (const v of list) {
          const line = document.createElement("div");
          if (v.mediaUrl) {
            line.appendChild(document.createTextNode("- "));
            const link = document.createElement("a");
            link.href = v.mediaUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.title = "Click to view attached media";
            link.className = "visit-map-tooltip__visit-link";
            link.textContent = formatVisitTime(v.visitedTime);
            line.appendChild(link);
          } else {
            line.textContent = `- ${formatVisitTime(v.visitedTime)}`;
          }
          content.appendChild(line);
        }
        wrapper.appendChild(content);
        return wrapper;
      },
      data: {
        data: {
          visited: {
            name: "Visited",
          },
        },
        applyData: "visited",
        values,
        colorNoData: COLOR_NO_DATA,
        colorMin: COLOR_NO_DATA,
        colorMax: COLOR_VISITED,
      },
    });
  });
}
