import { MAP_ONLY_REGIONS } from "../../map-regions";
import type { Country } from "../../types/country";
import type { CountryVisit } from "../../types/visit";

export function formatVisitTime(visitedTime?: string): string {
  if (!visitedTime) return "—";
  const d = new Date(visitedTime);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function buildCountryNames(
  countries: Country[]
): Record<string, string> {
  const countryNames: Record<string, string> = {};
  for (const c of countries) {
    countryNames[c.countryCode.toUpperCase()] = c.name;
  }
  for (const [code, def] of Object.entries(MAP_ONLY_REGIONS)) {
    countryNames[code] = def.displayName;
  }
  return countryNames;
}

export function groupVisitsByCountry(
  visits: CountryVisit[]
): Map<string, CountryVisit[]> {
  const visitsByCountry = new Map<string, CountryVisit[]>();
  for (const v of visits) {
    const code = v.countryCode.toUpperCase();
    if (!visitsByCountry.has(code)) visitsByCountry.set(code, []);
    visitsByCountry.get(code)!.push(v);
  }
  return visitsByCountry;
}

export interface BuildVisitsMapTooltipOptions {
  countryID: string;
  countryNames: Record<string, string>;
  listedCodes: Set<string>;
  visitsByCountry: Map<string, CountryVisit[]>;
  baseUrl: string;
  onViewMediaUrl?: (visit: CountryVisit) => void;
}

/**
 * Builds DOM for map/globe country hover tooltips (flag, title, visits, media links).
 */
export function buildVisitsMapTooltip(
  options: BuildVisitsMapTooltipOptions
): HTMLElement {
  const {
    countryID,
    countryNames,
    listedCodes,
    visitsByCountry,
    baseUrl,
    onViewMediaUrl,
  } = options;

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

  const flagImageCode = mapOnly
    ? mapOnly.flagCode.toLowerCase()
    : idUpper.toLowerCase();
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
}
