import type { Country } from "../../types/country";
import type { CountryVisit } from "../../types/visit";

/** Shared options for visits-map and visits-globe. */
export interface VisitsVizOptions {
  countryCodes: string[];
  countries: Country[];
  visits: CountryVisit[];
  baseUrl: string;
  /** Optional fixed height in px; default from CSS. */
  height?: number;
  /** Called when the user clicks a media link in the tooltip. */
  onViewMediaUrl?: (visit: CountryVisit) => void;
}

/** Handle returned by create factories for clean unmount. */
export interface VisitsVizHandle {
  dispose: () => void;
}
