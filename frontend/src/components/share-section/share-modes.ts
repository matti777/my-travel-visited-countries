import type { Country } from "../../types/country";
import type { CountryVisit, WishListCountry } from "../../types/visit";
import { topCountriesByAverageScore } from "../../utils/visit-averages";
import { mostVisitedShareModeAvailable } from "../../utils/visit-statistics";
import type { ShareImageMode, WishListShareRow } from "./share-image";

export const MAX_WISH_LIST_ENTRIES = 5;

export function countryNameFor(countries: Country[], code: string): string {
  const upper = code.toUpperCase();
  const country = countries.find((c) => c.countryCode.toUpperCase() === upper);
  return country?.name ?? code;
}

function isKnownCountryCode(countries: Country[], code: string): boolean {
  const upper = code.toUpperCase();
  return countries.some((c) => c.countryCode.toUpperCase() === upper);
}

function wishListShareModeAvailable(
  wishList: WishListCountry[],
  countries: Country[],
): boolean {
  return wishList.some((e) => isKnownCountryCode(countries, e.countryCode));
}

export function buildWishListShareRows(
  wishList: WishListCountry[],
  countries: Country[],
): WishListShareRow[] {
  const rows: WishListShareRow[] = [];
  for (const entry of wishList) {
    if (!isKnownCountryCode(countries, entry.countryCode)) {
      continue;
    }
    rows.push({
      countryCode: entry.countryCode,
      name: countryNameFor(countries, entry.countryCode),
      description: (entry.description ?? "").trim(),
    });
    if (rows.length >= MAX_WISH_LIST_ENTRIES) {
      break;
    }
  }
  return rows;
}

export function buildAvailableModes(
  visits: CountryVisit[],
  countries: Country[],
  wishList: WishListCountry[] = [],
): ShareImageMode[] {
  const modes: ShareImageMode[] = ["statistics"];
  const nameFor = (code: string) => countryNameFor(countries, code);
  if (topCountriesByAverageScore(visits, nameFor).length > 0) {
    modes.push("favourite");
  }
  if (mostVisitedShareModeAvailable(visits, countries)) {
    modes.push("mostVisited");
  }
  if (wishListShareModeAvailable(wishList, countries)) {
    modes.push("wishList");
  }
  return modes;
}
