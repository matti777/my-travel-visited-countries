import type { Country } from "../types/country";
import type { CountryVisit } from "../types/visit";

/** Continent display names (ISO continent codes used as regionCode). */
export const REGION_CODE_TO_NAME: Record<string, string> = {
  AF: "Africa",
  AN: "Antarctica",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  OC: "Oceania",
  SA: "South America",
};

/** Fill colors per continent for statistics circle graph (same as map tab). */
export const REGION_CODE_TO_FILL_COLOR: Record<string, string> = {
  EU: "#add8e6",
  NA: "#e0ffff",
  SA: "#90ee90",
  AF: "#f08080",
  AS: "#fffacd",
  OC: "#40e0d0",
};

export const STATISTICS_DEFAULT_FILL_COLOR = "#40e0d0";

/** Statistics ring order: continents then The World. */
export const STATISTICS_REGION_ORDER = ["AF", "AS", "EU", "NA", "OC", "SA"] as const;

export function getRegionName(regionCode: string): string {
  return REGION_CODE_TO_NAME[regionCode] ?? regionCode;
}

export interface VisitStatisticsArea {
  key: string;
  name: string;
  visited: number;
  total: number;
  percentage: number;
  fillColor: string;
}

export interface VisitStatistics {
  uniqueVisitedCount: number;
  uniqueVisitedCodes: Set<string>;
  areas: VisitStatisticsArea[];
}

/**
 * Computes continent / world visit percentages from visits and the canonical
 * country list. Only visits whose countryCode exists in `countries` count.
 */
export function computeVisitStatistics(
  visits: CountryVisit[],
  countries: Country[],
): VisitStatistics {
  const listedCodeSet = new Set(countries.map((c) => c.countryCode.toUpperCase()));
  const visitsForStatistics = visits.filter((v) =>
    listedCodeSet.has(v.countryCode.toUpperCase()),
  );

  const countryCodeToRegion = new Map<string, string>();
  const regionTotals = new Map<string, number>();
  for (const c of countries) {
    const code = c.countryCode.toUpperCase();
    countryCodeToRegion.set(code, c.regionCode);
    regionTotals.set(c.regionCode, (regionTotals.get(c.regionCode) ?? 0) + 1);
  }

  const worldTotal = countries.length;
  const uniqueVisitedCodes = new Set(
    visitsForStatistics.map((v) => v.countryCode.toUpperCase()),
  );
  const visitedByRegion = new Map<string, number>();
  for (const code of uniqueVisitedCodes) {
    const region = countryCodeToRegion.get(code) ?? "ZZ";
    visitedByRegion.set(region, (visitedByRegion.get(region) ?? 0) + 1);
  }

  const uniqueVisitedCount = uniqueVisitedCodes.size;
  const rawAreas: { key: string; name: string; visited: number; total: number }[] = [
    ...STATISTICS_REGION_ORDER.map((regionCode) => ({
      key: regionCode,
      name: getRegionName(regionCode),
      visited: visitedByRegion.get(regionCode) ?? 0,
      total: regionTotals.get(regionCode) ?? 0,
    })),
    {
      key: "world",
      name: "The World",
      visited: uniqueVisitedCount,
      total: worldTotal,
    },
  ];

  const areas: VisitStatisticsArea[] = rawAreas.map((area) => {
    const percentage =
      area.total > 0 ? Math.round((area.visited / area.total) * 100) : 0;
    const fillColor =
      area.key === "world"
        ? STATISTICS_DEFAULT_FILL_COLOR
        : (REGION_CODE_TO_FILL_COLOR[area.key] ?? STATISTICS_DEFAULT_FILL_COLOR);
    return { ...area, percentage, fillColor };
  });

  return { uniqueVisitedCount, uniqueVisitedCodes, areas };
}

export interface RecentVisitedCountry {
  countryCode: string;
  name: string;
  visitedTime?: string;
}

/**
 * Up to `limit` unique countries by most recent visit time (desc).
 * Only visits whose countryCode exists in `countries` are considered.
 */
export function getMostRecentVisitedCountries(
  visits: CountryVisit[],
  countries: Country[],
  limit = 7,
): RecentVisitedCountry[] {
  const byCode = new Map(
    countries.map((c) => [c.countryCode.toUpperCase(), c] as const),
  );
  const listed = visits.filter((v) => byCode.has(v.countryCode.toUpperCase()));
  const sorted = [...listed].sort((a, b) => {
    const ta = a.visitedTime ?? "";
    const tb = b.visitedTime ?? "";
    if (ta !== tb) return tb.localeCompare(ta);
    return a.countryCode.localeCompare(b.countryCode);
  });

  const seen = new Set<string>();
  const out: RecentVisitedCountry[] = [];
  for (const v of sorted) {
    const code = v.countryCode.toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    const country = byCode.get(code)!;
    out.push({
      countryCode: country.countryCode,
      name: country.name,
      visitedTime: v.visitedTime,
    });
    if (out.length >= limit) break;
  }
  return out;
}
