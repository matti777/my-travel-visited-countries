/**
 * svgMap territory codes not returned by GET /countries but shown on the map.
 * Source of truth for display names, tooltips, and optional visit/flag overrides.
 */
export interface MapOnlyRegionDef {
  displayName: string;
  /**
   * Host ISO code for overseas / dependent territories: map color and tooltips follow this country.
   * When the host has no visit in the current (e.g. filtered) set, the territory uses unvisited sovereign
   * gray — not the darkest “non-country” map color.
   * Omit for disputed or non-sovereign map-only areas (Kosovo, Palestine, Western Sahara): those use
   * the darkest map-only gray only.
   */
  visitSourceCode?: string;
  /** Flag asset basename: `assets/images/<flagCode>.jpg`. */
  flagCode: string;
}

/** Uppercase svgMap ids → metadata (svgMap regions not returned by GET /countries). */
export const MAP_ONLY_REGIONS: Record<string, MapOnlyRegionDef> = {
  /* Disputed / non-sovereign map-only — darkest gray on map only; no visitSourceCode. */
  XK: {
    displayName: "Kosovo",
    flagCode: "xk",
  },
  EH: {
    displayName: "Western Sahara",
    flagCode: "eh",
  },
  PS: {
    displayName: "Palestine",
    flagCode: "ps",
  },
  /* Overseas / dependent territories — follow host country for fill; never the disputed-only dark gray. */
  GL: {
    displayName: "Greenland (Denmark)",
    visitSourceCode: "DK",
    flagCode: "dk",
  },
  PR: {
    displayName: "Puerto Rico (USA)",
    visitSourceCode: "US",
    flagCode: "us",
  },
  VI: {
    displayName: "Virgin Islands (USA)",
    visitSourceCode: "US",
    flagCode: "us",
  },
  VG: {
    displayName: "Virgin Islands (United Kingdom)",
    visitSourceCode: "GB",
    flagCode: "gb",
  },
  MS: {
    displayName: "Montserrat (United Kingdom)",
    visitSourceCode: "GB",
    flagCode: "gb",
  },
  GP: {
    displayName: "Guadeloupe (France)",
    visitSourceCode: "FR",
    flagCode: "fr",
  },
  MQ: {
    displayName: "Martinique (France)",
    visitSourceCode: "FR",
    flagCode: "fr",
  },
  GF: {
    displayName: "French Guyana (France)",
    visitSourceCode: "FR",
    flagCode: "fr",
  },
  NC: {
    displayName: "New Caledonia (France)",
    visitSourceCode: "FR",
    flagCode: "fr",
  },
};

/**
 * Lowercase svgMap ids whose flag file is `<id>.jpg` under `assets/images/`
 * (map-only regions that do not borrow a parent flag via `flagCode`).
 * Used with {@link MAP_ONLY_REGIONS} by `scripts/download-flag-assets.ts`.
 */
export const MAP_ONLY_FLAG_ASSET_CODES_LOWER: readonly string[] = Object.entries(MAP_ONLY_REGIONS)
  .filter(([code, def]) => {
    const lower = code.toLowerCase();
    const assetName = def.flagCode.toLowerCase();
    return assetName === lower;
  })
  .map(([code]) => code.toLowerCase());
