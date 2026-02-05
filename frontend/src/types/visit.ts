/**
 * Types matching GET /visits API response (backend CountryVisit, data-models.md).
 */
export interface CountryVisit {
  countryCode: string;
  visitedTime?: string;
  userId: string;
}

export interface VisitsResponse {
  visits: CountryVisit[];
}
