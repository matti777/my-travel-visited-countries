import type { CountryVisit } from "../types/visit";

/**
 * One visit-shaped row per country with `score` set to the rounded mean
 * (`score ?? 50` per visit). Order follows first occurrence in `list`.
 */
export function averageVisitsByCountry(list: CountryVisit[]): CountryVisit[] {
  const byCode = new Map<string, CountryVisit[]>();
  for (const v of list) {
    const group = byCode.get(v.countryCode);
    if (group) group.push(v);
    else byCode.set(v.countryCode, [v]);
  }
  const seen = new Set<string>();
  const out: CountryVisit[] = [];
  for (const v of list) {
    if (seen.has(v.countryCode)) continue;
    seen.add(v.countryCode);
    const group = byCode.get(v.countryCode)!;
    const avg = Math.round(
      group.reduce((sum, x) => sum + (x.score ?? 50), 0) / group.length,
    );
    out.push({ ...v, score: avg });
  }
  return out;
}

/**
 * Top countries by average visit score: only when ≥5 countries have average
 * score > 50; then returns up to `limit` (default 5), score desc, name asc.
 */
export function topCountriesByAverageScore(
  list: CountryVisit[],
  nameFor: (countryCode: string) => string,
  limit = 5,
): CountryVisit[] {
  const averaged = averageVisitsByCountry(list);
  const qualifying = averaged.filter((v) => (v.score ?? 0) > 50);
  if (qualifying.length < 5) {
    return [];
  }
  return qualifying
    .sort((a, b) => {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return nameFor(a.countryCode).localeCompare(nameFor(b.countryCode));
    })
    .slice(0, limit);
}
