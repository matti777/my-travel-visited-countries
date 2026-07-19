import { MAP_ONLY_REGIONS, type MapOnlyRegionDef } from "../../map-regions";
import type { Country } from "../../types/country";
import type { CountryVisit } from "../../types/visit";

/** Fill colors per continent for visited countries (user-interface.md). */
export const REGION_CODE_TO_COLOR: Record<string, string> = {
  EU: "#add8e6", /* Europe: light blue */
  NA: "#e0ffff", /* North America: light cyan */
  SA: "#90ee90", /* South America: light green */
  AF: "#f08080", /* Africa: light red */
  AS: "#fffacd", /* Asia: light yellow */
  OC: "#40e0d0", /* Oceania: turquoise */
};

/** Fallback for Antarctica or unknown region. */
export const COLOR_VISITED_DEFAULT = "#40e0d0";

/**
 * Default fill for sovereign states with no matching visit — matches svg-map.css
 * `.svgMap-country` fallback (`#E2E2E2`).
 */
export const COLOR_UNVISITED_SOVEREIGN = "#E2E2E2";

/**
 * Darkest gray: only for map-only disputed rows without `visitSourceCode`
 * (Palestine PS, Kosovo XK, Western Sahara EH).
 */
export const COLOR_NON_COUNTRY_MAP = "#2c2c2c";

export function getFillColorForRegion(regionCode: string): string {
  return REGION_CODE_TO_COLOR[regionCode] ?? COLOR_VISITED_DEFAULT;
}

function parentHasFilteredVisit(visits: CountryVisit[], parentIso: string): boolean {
  const p = parentIso.toUpperCase();
  return visits.some((v) => v.countryCode.toUpperCase() === p);
}

/** Host ISO set → overseas territory; omitted or empty → disputed-only dark gray. */
export function isOverseasTerritory(def: MapOnlyRegionDef): boolean {
  return Boolean(def.visitSourceCode?.trim());
}

export interface CountryFillValue {
  visited: number;
  color: string;
}

/**
 * Build per-ISO fill values for maps (visited continent colors + map-only rules).
 */
export function buildCountryFillValues(
  countryCodes: string[],
  countries: Country[],
  visits: CountryVisit[]
): Record<string, CountryFillValue> {
  const countryByCode = new Map<string, Country>();
  for (const c of countries) {
    countryByCode.set(c.countryCode.toUpperCase(), c);
  }

  const values: Record<string, CountryFillValue> = {};

  for (const c of countries) {
    const upper = c.countryCode.toUpperCase();
    values[upper] = { visited: 0, color: COLOR_UNVISITED_SOVEREIGN };
  }

  for (const code of countryCodes) {
    const upper = code.toUpperCase();
    const country = countryByCode.get(upper);
    const regionCode = country?.regionCode ?? "";
    values[upper] = { visited: 1, color: getFillColorForRegion(regionCode) };
  }

  for (const [code, def] of Object.entries(MAP_ONLY_REGIONS)) {
    if (isOverseasTerritory(def)) continue;
    values[code] = { visited: 0, color: COLOR_NON_COUNTRY_MAP };
  }

  for (const [code, def] of Object.entries(MAP_ONLY_REGIONS)) {
    if (!isOverseasTerritory(def)) continue;
    const host = def.visitSourceCode!.trim().toUpperCase();
    if (!parentHasFilteredVisit(visits, host)) {
      values[code] = { visited: 0, color: COLOR_UNVISITED_SOVEREIGN };
      continue;
    }
    const hostVals = values[host];
    if (hostVals) {
      values[code] = { visited: hostVals.visited, color: hostVals.color };
    } else {
      const country = countryByCode.get(host);
      values[code] = {
        visited: 1,
        color: getFillColorForRegion(country?.regionCode ?? ""),
      };
    }
  }

  return values;
}

/** ISO codes that should show as visited highlights (visited === 1). */
export function getVisitedHighlightCodes(
  values: Record<string, CountryFillValue>
): Set<string> {
  const codes = new Set<string>();
  for (const [code, v] of Object.entries(values)) {
    if (v.visited === 1) codes.add(code.toUpperCase());
  }
  return codes;
}
