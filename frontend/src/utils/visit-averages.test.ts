import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CountryVisit } from "../types/visit";
import {
  averageVisitsByCountry,
  topCountriesByAverageScore,
} from "./visit-averages";

function visit(
  countryCode: string,
  score?: number,
  id = `${countryCode}-1`,
): CountryVisit {
  return { id, countryCode, userId: "u1", score };
}

const names: Record<string, string> = {
  FI: "Finland",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  IS: "Iceland",
  EE: "Estonia",
  LV: "Latvia",
  DE: "Germany",
};

function nameFor(code: string): string {
  return names[code] ?? code;
}

describe("averageVisitsByCountry", () => {
  it("returns empty for empty input", () => {
    assert.deepEqual(averageVisitsByCountry([]), []);
  });

  it("keeps first-occurrence order and one row per country", () => {
    const list = [
      visit("FI", 80),
      visit("SE", 60),
      visit("FI", 40, "FI-2"),
      visit("NO", 70),
    ];
    const out = averageVisitsByCountry(list);
    assert.deepEqual(
      out.map((v) => v.countryCode),
      ["FI", "SE", "NO"],
    );
  });

  it("uses score ?? 50 and rounds the mean (Alphabetical-style)", () => {
    // (80 + 40) / 2 = 60
    assert.equal(averageVisitsByCountry([visit("FI", 80), visit("FI", 40, "FI-2")])[0]?.score, 60);
    // (undefined→50 + 51) / 2 = 50.5 → 51
    assert.equal(
      averageVisitsByCountry([visit("SE"), visit("SE", 51, "SE-2")])[0]?.score,
      51,
    );
    // single undefined → 50
    assert.equal(averageVisitsByCountry([visit("NO")])[0]?.score, 50);
    // (1 + 2) / 2 = 1.5 → 2
    assert.equal(
      averageVisitsByCountry([visit("DK", 1), visit("DK", 2, "DK-2")])[0]?.score,
      2,
    );
  });

  it("preserves other fields from the first visit of each country", () => {
    const first = {
      ...visit("FI", 10),
      notes: "first",
      tags: ["a"],
    };
    const second = { ...visit("FI", 90, "FI-2"), notes: "second" };
    const [row] = averageVisitsByCountry([first, second]);
    assert.equal(row?.id, first.id);
    assert.equal(row?.notes, "first");
    assert.deepEqual(row?.tags, ["a"]);
    assert.equal(row?.score, 50);
  });
});

describe("topCountriesByAverageScore", () => {
  it("returns empty when fewer than 5 countries have average > 50", () => {
    const list = [
      visit("FI", 90),
      visit("SE", 80),
      visit("NO", 70),
      visit("DK", 60),
      // EE avg 50 — does not qualify (> 50 required)
      visit("EE", 50),
      visit("LV", 40),
    ];
    assert.deepEqual(topCountriesByAverageScore(list, nameFor), []);
  });

  it("excludes average exactly 50 (and missing scores defaulting to 50)", () => {
    const list = [
      visit("FI", 90),
      visit("SE", 80),
      visit("NO", 70),
      visit("DK", 60),
      visit("IS", 51),
      visit("EE"), // → 50, not > 50
      visit("LV", 50),
    ];
    // 5 qualifying (FI–IS); EE/LV excluded
    const ranked = topCountriesByAverageScore(list, nameFor);
    assert.equal(ranked.length, 5);
    assert.ok(!ranked.some((v) => v.countryCode === "EE" || v.countryCode === "LV"));
  });

  it("shows top 5 when ≥5 countries qualify, score desc", () => {
    const list = [
      visit("FI", 55),
      visit("SE", 90),
      visit("NO", 70),
      visit("DK", 80),
      visit("IS", 60),
      visit("EE", 95),
    ];
    const ranked = topCountriesByAverageScore(list, nameFor);
    assert.deepEqual(
      ranked.map((v) => [v.countryCode, v.score]),
      [
        ["EE", 95],
        ["SE", 90],
        ["DK", 80],
        ["NO", 70],
        ["IS", 60],
      ],
    );
  });

  it("tie-breaks equal averages by country name ascending", () => {
    const list = [
      visit("SE", 70), // Sweden
      visit("NO", 70), // Norway
      visit("FI", 70), // Finland
      visit("DK", 70), // Denmark
      visit("IS", 70), // Iceland
      visit("EE", 70), // Estonia — 6th by name among equals after slice
    ];
    const ranked = topCountriesByAverageScore(list, nameFor);
    assert.deepEqual(
      ranked.map((v) => v.countryCode),
      ["DK", "EE", "FI", "IS", "NO"],
    );
  });

  it("averages multi-visit countries before ranking", () => {
    const list = [
      visit("FI", 100),
      visit("FI", 0, "FI-2"), // avg 50 — not qualifying
      visit("SE", 90),
      visit("NO", 80),
      visit("DK", 70),
      visit("IS", 60),
      visit("EE", 51),
    ];
    // Only 5 qualify if FI is out: SE,NO,DK,IS,EE
    const ranked = topCountriesByAverageScore(list, nameFor);
    assert.equal(ranked.length, 5);
    assert.ok(!ranked.some((v) => v.countryCode === "FI"));
    assert.equal(ranked[0]?.countryCode, "SE");
  });

  it("returns empty for empty list and respects custom limit", () => {
    assert.deepEqual(topCountriesByAverageScore([], nameFor), []);
    const list = [
      visit("FI", 90),
      visit("SE", 80),
      visit("NO", 70),
      visit("DK", 60),
      visit("IS", 55),
      visit("EE", 51),
    ];
    const top3 = topCountriesByAverageScore(list, nameFor, 3);
    assert.deepEqual(
      top3.map((v) => v.countryCode),
      ["FI", "SE", "NO"],
    );
  });

  it("uses nameFor fallback when code is unknown", () => {
    const list = [
      visit("ZZ", 90),
      visit("YY", 80),
      visit("XX", 70),
      visit("WW", 60),
      visit("VV", 55),
    ];
    const ranked = topCountriesByAverageScore(list, (c) => c);
    assert.equal(ranked.length, 5);
    assert.equal(ranked[0]?.countryCode, "ZZ");
  });
});
