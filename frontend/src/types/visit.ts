/**
 * Types matching GET /visits API response (backend CountryVisit, data-models.md).
 */
export interface CountryVisit {
  id?: string;
  countryCode: string;
  visitedTime?: string;
  userId: string;
}

export interface VisitsResponse {
  visits: CountryVisit[];
  shareToken?: string;
}
