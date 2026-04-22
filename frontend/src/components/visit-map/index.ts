import svgMap from "svgmap";
import "svgmap/style";
import { MAP_ONLY_REGIONS } from "../../map-regions";
import type { Country } from "../../types/country";
import type { CountryVisit } from "../../types/visit";

/** Fill colors per continent for visited countries (user-interface.md). */
const REGION_CODE_TO_COLOR: Record<string, string> = {
  EU: "#add8e6", /* Europe: light blue */
  NA: "#e0ffff", /* North America: light cyan */
  SA: "#90ee90", /* South America: light green */
  AF: "#f08080", /* Africa: light red */
  AS: "#fffacd", /* Asia: light yellow */
  OC: "#40e0d0", /* Oceania: turquoise */
};
/** Fallback for Antarctica or unknown region. */
const COLOR_VISITED_DEFAULT = "#40e0d0";
/** Dark gray for unvisited sovereign countries so they stand out from ocean/background. */
const COLOR_NO_DATA = "#4a4a4a";
/** Darker gray for map-only rows with no visit source, or when a parent sovereign (e.g. US) is unvisited. */
const COLOR_NON_COUNTRY_MAP = "#2c2c2c";

function getFillColorForRegion(regionCode: string): string {
  return REGION_CODE_TO_COLOR[regionCode] ?? COLOR_VISITED_DEFAULT;
}

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
  /** Called when the user clicks a media link in the tooltip. */
  onViewMediaUrl?: (visit: CountryVisit) => void;
}

/**
 * Creates a world map inside the given parent element using svgMap.
 * Visited countries are highlighted with the app turquoise;
 * unvisited sovereign countries use medium gray; map-only territories (not in GET /countries)
 * use a darker gray. Tooltips show Visits: N and each visit date where applicable.
 */
export function createVisitMap(
  parent: HTMLElement,
  options: CreateVisitMapOptions
): void {
  const { countryCodes, countries, visits, baseUrl, onViewMediaUrl } = options;
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

  const countryByCode = new Map<string, Country>();
  for (const c of countries) {
    countryByCode.set(c.countryCode.toUpperCase(), c);
  }

  const listedCodes = new Set(countries.map((c) => c.countryCode.toUpperCase()));

  const values: Record<string, { visited: number; color: string }> = {};
  for (const code of countryCodes) {
    const upper = code.toUpperCase();
    const country = countryByCode.get(upper);
    const regionCode = country?.regionCode ?? "";
    const fillColor = getFillColorForRegion(regionCode);
    values[upper] = { visited: 1, color: fillColor };
  }

  for (const [code, def] of Object.entries(MAP_ONLY_REGIONS)) {
    if (def.visitSourceCode) {
      const parent = def.visitSourceCode.toUpperCase();
      const parentVals = values[parent];
      values[code] = parentVals
        ? { ...parentVals }
        : { visited: 0, color: COLOR_NON_COUNTRY_MAP };
    } else {
      values[code] = { visited: 0, color: COLOR_NON_COUNTRY_MAP };
    }
  }

  const countryNames: Record<string, string> = {};
  for (const c of countries) {
    countryNames[c.countryCode.toUpperCase()] = c.name;
  }
  for (const [code, def] of Object.entries(MAP_ONLY_REGIONS)) {
    countryNames[code] = def.displayName;
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
        const idUpper = countryID.toUpperCase();
        const mapOnly = MAP_ONLY_REGIONS[idUpper];
        const showVisitBlock = !!(mapOnly?.visitSourceCode || listedCodes.has(idUpper));
        const visitDataKey = mapOnly?.visitSourceCode ?? idUpper;
        const list = showVisitBlock ? visitsByCountry.get(visitDataKey) ?? [] : [];

        const titleText =
          countryNames[idUpper] ??
          countryNames[countryID] ??
          mapOnly?.displayName ??
          countryID;

        const flagImageCode = (mapOnly?.flagCode ?? idUpper).toLowerCase();
        const showFlag = listedCodes.has(idUpper) || mapOnly !== undefined;

        const wrapper = document.createElement("div");
        wrapper.className = "svgMap-tooltip-content-container";

        if (showFlag) {
          const flagContainer = document.createElement("div");
          flagContainer.className =
            "svgMap-tooltip-flag-container svgMap-tooltip-flag-container-image";
          const img = document.createElement("img");
          img.className = "svgMap-tooltip-flag";
          img.src = `${baseUrl}/assets/images/${flagImageCode}.jpg`;
          img.alt = "";
          flagContainer.appendChild(img);
          wrapper.appendChild(flagContainer);
        }

        const title = document.createElement("div");
        title.className = "svgMap-tooltip-title";
        title.textContent = titleText;
        wrapper.appendChild(title);

        if (!showVisitBlock) {
          return wrapper;
        }

        const content = document.createElement("div");
        content.className = "svgMap-tooltip-content";
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
            link.addEventListener("click", () => {
              onViewMediaUrl?.(v);
            });
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
        colorMax: COLOR_VISITED_DEFAULT,
      },
    });
  });
}
