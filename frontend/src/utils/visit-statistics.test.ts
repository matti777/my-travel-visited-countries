import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Country } from "../types/country";
import type { CountryVisit } from "../types/visit";
import {
  STATISTICS_DEFAULT_FILL_COLOR,
  STATISTICS_REGION_ORDER,
  REGION_CODE_TO_FILL_COLOR,
  computeVisitStatistics,
  getMostRecentVisitedCountries,
  getRegionName,
  mostVisitedCountries,
  mostVisitedShareModeAvailable,
  visitsPerContinent,
} from "./visit-statistics";

function country(code: string, name: string, regionCode: string): Country {
  return { countryCode: code, name, regionCode };
}

function visit(
  countryCode: string,
  id = `${countryCode}-1`,
  visitedTime?: string,
): CountryVisit {
  return { id, countryCode, userId: "u1", score: 50, visitedTime };
}

const sampleCountries: Country[] = [
  country("EG", "Egypt", "AF"),
  country("KE", "Kenya", "AF"),
  country("CN", "China", "AS"),
  country("JP", "Japan", "AS"),
  country("FI", "Finland", "EU"),
  country("SE", "Sweden", "EU"),
  country("DE", "Germany", "EU"),
  country("US", "United States", "NA"),
  country("CA", "Canada", "NA"),
  country("AU", "Australia", "OC"),
  country("NZ", "New Zealand", "OC"),
  country("BR", "Brazil", "SA"),
  country("AR", "Argentina", "SA"),
];

describe("getRegionName", () => {
  it("maps known continent codes", () => {
    assert.equal(getRegionName("EU"), "Europe");
    assert.equal(getRegionName("AF"), "Africa");
  });

  it("falls back to the code for unknown regions", () => {
    assert.equal(getRegionName("ZZ"), "ZZ");
  });
});

describe("computeVisitStatistics", () => {
  it("returns zeros and stable area order for empty visits", () => {
    const stats = computeVisitStatistics([], sampleCountries);
    assert.equal(stats.uniqueVisitedCount, 0);
    assert.equal(stats.areas.length, 7);
    assert.deepEqual(
      stats.areas.map((a) => a.key),
      [...STATISTICS_REGION_ORDER, "world"],
    );
    assert.equal(stats.areas.at(-1)?.name, "The World");
    assert.equal(stats.areas.at(-1)?.total, sampleCountries.length);
    assert.equal(stats.areas.at(-1)?.percentage, 0);
    assert.equal(stats.areas.at(-1)?.fillColor, STATISTICS_DEFAULT_FILL_COLOR);
  });

  it("counts unique listed countries only", () => {
    const stats = computeVisitStatistics(
      [
        visit("FI"),
        visit("FI", "FI-2"),
        visit("US"),
        visit("XX"), // unknown — ignored
      ],
      sampleCountries,
    );
    assert.equal(stats.uniqueVisitedCount, 2);
    assert.ok(stats.uniqueVisitedCodes.has("FI"));
    assert.ok(stats.uniqueVisitedCodes.has("US"));
    assert.equal(stats.uniqueVisitedCodes.has("XX"), false);

    const eu = stats.areas.find((a) => a.key === "EU")!;
    assert.equal(eu.visited, 1);
    assert.equal(eu.total, 3);
    assert.equal(eu.percentage, Math.round((1 / 3) * 100));
    assert.equal(eu.fillColor, REGION_CODE_TO_FILL_COLOR.EU);

    const na = stats.areas.find((a) => a.key === "NA")!;
    assert.equal(na.visited, 1);
    assert.equal(na.total, 2);
    assert.equal(na.percentage, 50);

    const world = stats.areas.find((a) => a.key === "world")!;
    assert.equal(world.visited, 2);
    assert.equal(world.total, sampleCountries.length);
    assert.equal(
      world.percentage,
      Math.round((2 / sampleCountries.length) * 100),
    );
  });

  it("buckets by region and ignores case on country codes", () => {
    const stats = computeVisitStatistics(
      [visit("fi"), visit("br"), visit("au")],
      sampleCountries,
    );
    assert.equal(stats.uniqueVisitedCount, 3);
    assert.equal(stats.areas.find((a) => a.key === "EU")?.visited, 1);
    assert.equal(stats.areas.find((a) => a.key === "SA")?.visited, 1);
    assert.equal(stats.areas.find((a) => a.key === "OC")?.visited, 1);
    assert.equal(stats.areas.find((a) => a.key === "AF")?.visited, 0);
  });

  it("uses zero percentage when a region has no countries in the list", () => {
    const onlyEu: Country[] = [country("FI", "Finland", "EU")];
    const stats = computeVisitStatistics([visit("FI")], onlyEu);
    const af = stats.areas.find((a) => a.key === "AF")!;
    assert.equal(af.total, 0);
    assert.equal(af.visited, 0);
    assert.equal(af.percentage, 0);
  });
});

describe("getMostRecentVisitedCountries", () => {
  it("returns empty when there are no visits", () => {
    assert.deepEqual(getMostRecentVisitedCountries([], sampleCountries), []);
  });

  it("returns up to 7 unique countries by visitedTime desc", () => {
    const recent = getMostRecentVisitedCountries(
      [
        visit("FI", "fi-old", "2020-01-01T00:00:00.000Z"),
        visit("US", "us-1", "2024-06-01T00:00:00.000Z"),
        visit("BR", "br-1", "2023-01-01T00:00:00.000Z"),
        visit("FI", "fi-new", "2025-01-01T00:00:00.000Z"),
        visit("JP", "jp-1", "2022-01-01T00:00:00.000Z"),
        visit("AU", "au-1", "2021-01-01T00:00:00.000Z"),
        visit("DE", "de-1", "2019-01-01T00:00:00.000Z"),
        visit("SE", "se-1", "2018-01-01T00:00:00.000Z"),
        visit("CA", "ca-1", "2017-01-01T00:00:00.000Z"),
      ],
      sampleCountries,
      7,
    );
    assert.deepEqual(
      recent.map((c) => c.countryCode),
      ["FI", "US", "BR", "JP", "AU", "DE", "SE"],
    );
    assert.equal(recent[0]?.name, "Finland");
  });

  it("ignores unknown country codes", () => {
    const recent = getMostRecentVisitedCountries(
      [visit("XX", "x-1", "2025-01-01T00:00:00.000Z"), visit("FI", "f-1", "2024-01-01T00:00:00.000Z")],
      sampleCountries,
    );
    assert.deepEqual(
      recent.map((c) => c.countryCode),
      ["FI"],
    );
  });
});

describe("mostVisitedCountries", () => {
  it("returns only countries with at least two listed visits", () => {
    const rows = mostVisitedCountries(
      [
        visit("FI", "fi-1"),
        visit("FI", "fi-2"),
        visit("US", "us-1"),
        visit("DE", "de-1"),
        visit("DE", "de-2"),
        visit("DE", "de-3"),
      ],
      sampleCountries,
    );
    assert.deepEqual(
      rows.map((r) => r.countryCode),
      ["DE", "FI"],
    );
    assert.equal(rows[0]?.count, 3);
  });

  it("sorts by count then recency then name", () => {
    const rows = mostVisitedCountries(
      [
        visit("FI", "fi-1", "2020-01-01T00:00:00.000Z"),
        visit("FI", "fi-2", "2024-01-01T00:00:00.000Z"),
        visit("US", "us-1", "2023-01-01T00:00:00.000Z"),
        visit("US", "us-2", "2022-01-01T00:00:00.000Z"),
        visit("BR", "br-1", "2025-01-01T00:00:00.000Z"),
        visit("BR", "br-2", "2021-01-01T00:00:00.000Z"),
      ],
      sampleCountries,
      5,
    );
    assert.deepEqual(
      rows.map((r) => r.countryCode),
      ["BR", "FI", "US"],
    );
  });
});

describe("mostVisitedShareModeAvailable", () => {
  it("requires three distinct countries with two or more visits", () => {
    assert.equal(
      mostVisitedShareModeAvailable(
        [visit("FI"), visit("FI", "fi-2"), visit("US"), visit("US", "us-2")],
        sampleCountries,
      ),
      false,
    );
    assert.equal(
      mostVisitedShareModeAvailable(
        [
          visit("FI"),
          visit("FI", "fi-2"),
          visit("US"),
          visit("US", "us-2"),
          visit("DE"),
          visit("DE", "de-2"),
        ],
        sampleCountries,
      ),
      true,
    );
  });
});

describe("visitsPerContinent", () => {
  it("counts visit rows per continent", () => {
    const rows = visitsPerContinent(
      [
        visit("FI"),
        visit("FI", "fi-2"),
        visit("US"),
        visit("BR"),
      ],
      sampleCountries,
    );
    const eu = rows.find((r) => r.regionCode === "EU");
    const na = rows.find((r) => r.regionCode === "NA");
    assert.equal(eu?.count, 2);
    assert.equal(na?.count, 1);
    assert.equal(rows[0]?.count, 2);
  });
});
