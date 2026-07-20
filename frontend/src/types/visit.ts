/**
 * Types matching GET /visits API response (backend CountryVisit, data-models.md).
 */
export interface CountryVisit {
  id?: string;
  countryCode: string;
  visitedTime?: string;
  mediaUrl?: string;
  notes?: string;
  tags?: string[];
  userId: string;
}

export interface VisitsResponse {
  visits: CountryVisit[];
  shareToken?: string;
}

/** GET /share/profile/:shareToken */
export interface ShareProfileResponse {
  visits: CountryVisit[];
  userName: string;
  imageUrl?: string;
  homeCountryCode?: string;
  description?: string;
}
