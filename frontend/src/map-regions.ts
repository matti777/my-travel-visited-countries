/**
 * svgMap territory codes not returned by GET /countries but shown on the map.
 * Source of truth for display names, tooltips, and optional visit/flag overrides.
 */
export interface MapOnlyRegionDef {
  displayName: string;
  /** Use this sovereign country's visits when hovering the map region (e.g. GL → DK). */
  visitSourceCode?: string;
  /** assets/images/<flagCode>.jpg — omit to use the map region code lowercased. */
  flagCode?: string;
}

/** Uppercase svgMap ids → metadata */
export const MAP_ONLY_REGIONS: Record<string, MapOnlyRegionDef> = {
  GL: {
    displayName: "Greenland (Denmark)",
    visitSourceCode: "DK",
    flagCode: "dk",
  },
  XK: {
    displayName: "Kosovo",
  },
  EH: {
    displayName: "Western Sahara",
  },
  PS: {
    displayName: "Palestine",
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
export const MAP_ONLY_FLAG_ASSET_CODES_LOWER: readonly string[] = Object.entries(
  MAP_ONLY_REGIONS
)
  .filter(([code, def]) => {
    const lower = code.toLowerCase();
    const assetName = (def.flagCode ?? lower).toLowerCase();
    return assetName === lower;
  })
  .map(([code]) => code.toLowerCase());
