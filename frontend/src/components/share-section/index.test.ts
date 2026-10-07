import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Country } from "../../types/country";
import type { CountryVisit, WishListCountry } from "../../types/visit";
import { buildAvailableModes } from "./share-modes";

const countries: Country[] = [
  { countryCode: "FI", name: "Finland", regionCode: "EU" },
  { countryCode: "SE", name: "Sweden", regionCode: "EU" },
  { countryCode: "NO", name: "Norway", regionCode: "EU" },
  { countryCode: "DK", name: "Denmark", regionCode: "EU" },
  { countryCode: "IS", name: "Iceland", regionCode: "EU" },
  { countryCode: "EE", name: "Estonia", regionCode: "EU" },
];

describe("buildAvailableModes wishList", () => {
  const visits: CountryVisit[] = [];

  it("omits wishList when the list is empty", () => {
    const modes = buildAvailableModes(visits, countries, []);
    assert.equal(modes.includes("wishList"), false);
  });

  it("omits wishList when every code is unknown", () => {
    const wishList: WishListCountry[] = [{ countryCode: "XX", description: "" }];
    const modes = buildAvailableModes(visits, countries, wishList);
    assert.equal(modes.includes("wishList"), false);
  });

  it("includes wishList as the only optional mode for a known entry", () => {
    const wishList: WishListCountry[] = [
      { countryCode: "FI", description: "Northern lights" },
    ];
    const modes = buildAvailableModes(visits, countries, wishList);
    assert.deepEqual(modes, ["statistics", "wishList"]);
  });

  it("places wishList after all existing optional modes", () => {
    const qualifyingVisits = countries.flatMap((country, index) => [
      {
        id: `${country.countryCode}-1`,
        countryCode: country.countryCode,
        score: 90 - index,
        userId: "u1",
      },
      {
        id: `${country.countryCode}-2`,
        countryCode: country.countryCode,
        score: 90 - index,
        userId: "u1",
      },
    ]);

    assert.deepEqual(
      buildAvailableModes(qualifyingVisits, countries, [
        { countryCode: "FI" },
      ]),
      ["statistics", "favourite", "mostVisited", "wishList"],
    );
  });
});
