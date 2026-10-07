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
export interface CountryVisitCountRow {
  countryCode: string;
  name: string;
  count: number;
  mostRecentVisitedTime: string;
}

export interface ContinentVisitCountRow {
  regionCode: string;
  name: string;
  count: number;
  fillColor: string;
}

function listedVisits(visits: CountryVisit[], countries: Country[]): CountryVisit[] {
  const listedCodeSet = new Set(countries.map((c) => c.countryCode.toUpperCase()));
  return visits.filter((v) => listedCodeSet.has(v.countryCode.toUpperCase()));
}

function countryNameFromList(countries: Country[], countryCode: string): string {
  const upper = countryCode.toUpperCase();
  const country = countries.find((c) => c.countryCode.toUpperCase() === upper);
  return country?.name ?? countryCode;
}

/**
 * Visit rows per country (listed only), countries with ≥2 visits, top `limit`.
 * Sort: count desc, most recent visit desc, name asc.
 */
export function mostVisitedCountries(
  visits: CountryVisit[],
  countries: Country[],
  limit = 5,
): CountryVisitCountRow[] {
  const filtered = listedVisits(visits, countries);
  const byCode = new Map<string, CountryVisit[]>();
  for (const v of filtered) {
    const code = v.countryCode.toUpperCase();
    const group = byCode.get(code);
    if (group) group.push(v);
    else byCode.set(code, [v]);
  }

  const rows: CountryVisitCountRow[] = [];
  for (const [code, group] of byCode) {
    if (group.length < 2) continue;
    const mostRecent = group.reduce((best, v) => {
      const t = v.visitedTime ?? "";
      return t.localeCompare(best) > 0 ? t : best;
    }, "");
    rows.push({
      countryCode: group[0]!.countryCode,
      name: countryNameFromList(countries, code),
      count: group.length,
      mostRecentVisitedTime: mostRecent,
    });
  }

  rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const timeDiff = b.mostRecentVisitedTime.localeCompare(a.mostRecentVisitedTime);
    if (timeDiff !== 0) return timeDiff;
    return a.name.localeCompare(b.name);
  });

  return rows.slice(0, limit);
}

/** True when ≥3 distinct listed countries each have ≥2 visit rows. */
export function mostVisitedShareModeAvailable(
  visits: CountryVisit[],
  countries: Country[],
): boolean {
  const filtered = listedVisits(visits, countries);
  const byCode = new Map<string, number>();
  for (const v of filtered) {
    const code = v.countryCode.toUpperCase();
    byCode.set(code, (byCode.get(code) ?? 0) + 1);
  }
  let qualifying = 0;
  for (const count of byCode.values()) {
    if (count >= 2) qualifying++;
  }
  return qualifying >= 3;
}

/**
 * Visit rows per continent (listed visits only). Same region mapping as statistics.
 * Sort: count desc, continent name asc.
 */
export function visitsPerContinent(
  visits: CountryVisit[],
  countries: Country[],
): ContinentVisitCountRow[] {
  const filtered = listedVisits(visits, countries);
  const countryCodeToRegion = new Map<string, string>();
  for (const c of countries) {
    countryCodeToRegion.set(c.countryCode.toUpperCase(), c.regionCode);
  }

  const counts = new Map<string, number>();
  for (const v of filtered) {
    const code = v.countryCode.toUpperCase();
    const region = countryCodeToRegion.get(code) ?? "ZZ";
    counts.set(region, (counts.get(region) ?? 0) + 1);
  }

  const rows: ContinentVisitCountRow[] = [];
  for (const [regionCode, count] of counts) {
    if (count < 1) continue;
    rows.push({
      regionCode,
      name: getRegionName(regionCode),
      count,
      fillColor:
        REGION_CODE_TO_FILL_COLOR[regionCode] ?? STATISTICS_DEFAULT_FILL_COLOR,
    });
  }

  rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });

  return rows;
}

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
