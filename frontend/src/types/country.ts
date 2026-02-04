/**
 * Country type matching the GET /countries API response (data-models.md).
 */
export interface Country {
  countryCode: string;
  name: string;
  regionCode: string;
}

export interface CountriesResponse {
  countries: Country[];
}
