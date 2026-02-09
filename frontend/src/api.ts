import { errorToast } from "Components/toast";
import type { Country, CountriesResponse } from "./types/country";
import type { CountryVisit, ShareVisitsResponse, VisitsResponse } from "./types/visit";


const COUNTRIES_CACHE_KEY = "app:countries:cache";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CountriesCache {
  countries: Country[];
  cachedAt: number;
}

export class ApiError extends Error {
  message: string;
  responseCode?: number;
  cause?: any;

  constructor({ message, responseCode, cause }: { message: string; responseCode?: number; cause?: any }) {
    super();

    this.message = message;
    this.responseCode = responseCode;
    this.cause = cause;
  }
}

export default class Api {
  private static SESSION_KEY_AUTHTOKEN = "session:api:auth_token";

  setAuthToken(token: string | null): void {
    if (token) {
      sessionStorage.setItem(Api.SESSION_KEY_AUTHTOKEN, token);
      console.log("Auth token registered");
    } else {
      sessionStorage.removeItem(Api.SESSION_KEY_AUTHTOKEN);
    }
  }

  getAuthToken(): string | null {
    return sessionStorage.getItem(Api.SESSION_KEY_AUTHTOKEN);
  }

  async getCountries(): Promise<Country[]> {
    try {
      const raw = localStorage.getItem(COUNTRIES_CACHE_KEY);
      if (raw) {
        const parsed: CountriesCache = JSON.parse(raw);
        if (parsed.cachedAt != null && Date.now() - parsed.cachedAt < CACHE_TTL_MS && Array.isArray(parsed.countries)) {
          console.log("Countries loaded from cache", parsed.countries.length);
          return parsed.countries;
        }
      }
      localStorage.removeItem(COUNTRIES_CACHE_KEY);
      const response = await this.performRequest("/countries", { method: "GET" }) as CountriesResponse;
      const countries = response?.countries ?? [];
      const cache: CountriesCache = { countries, cachedAt: Date.now() };
      localStorage.setItem(COUNTRIES_CACHE_KEY, JSON.stringify(cache));
      console.log("Countries loaded from backend", countries.length);
      return countries;
    } catch (err) {
      console.error("Failed to load countries", err);
      return [];
    }
  }

  async postLogin(): Promise<void> {
    const token = this.getAuthToken();
    if (!token) {
      throw new ApiError({ message: "Not authenticated" });
    }
    await this.performRequest("/login", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async getVisits(): Promise<{ visits: CountryVisit[]; shareToken?: string }> {
    const token = this.getAuthToken();
    if (!token) {
      return { visits: [] };
    }
    const response = (await this.performRequest("/visits", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    })) as VisitsResponse;
    return {
      visits: response?.visits ?? [],
      shareToken: response?.shareToken,
    };
  }

  async getShareVisits(shareToken: string): Promise<ShareVisitsResponse> {
    const response = (await this.performRequest(
      `/share/visits/${encodeURIComponent(shareToken)}`,
      { method: "GET" }
    )) as ShareVisitsResponse;
    return response;
  }

  async putVisits(countryCode: string, visitedTime?: number): Promise<CountryVisit> {
    const token = this.getAuthToken();
    if (!token) {
      throw new ApiError({ message: "Not authenticated" });
    }
    const body: { countryCode: string; visitedTime?: number } = { countryCode };
    if (visitedTime != null) {
      body.visitedTime = visitedTime;
    }
    const response = (await this.performRequest("/visits", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })) as CountryVisit;
    return response;
  }

  async deleteVisit(visitId: string): Promise<void> {
    const token = this.getAuthToken();
    if (!token) {
      throw new ApiError({ message: "Not authenticated" });
    }
    await this.performRequest(`/visits/${encodeURIComponent(visitId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  private parseContentType(contentTypeHeader: string): string {
    const parts = contentTypeHeader.split(";");
    const contentType = parts[0].trim();
    return contentType;
  }

  private async performRequest(endpoint: string, options: RequestInit): Promise<any> {
    try {
      console.log(`Making request to ${endpoint} with options: ${JSON.stringify(options)}`);

      const response = await fetch(endpoint, options);

      if (response.status < 200 || response.status >= 400) {
        console.log("throwing a new ApiError due to status");
        throw new ApiError({
          message: `Invalid status ${response.status}: ${response.statusText}`,
          responseCode: response.status,
        });
      }

      if (response.status === 204) {
        console.log("Request succeeded:", (options as RequestInit).method ?? "GET", endpoint);
        return undefined;
      }

      const contentType = this.parseContentType(response.headers.get("Content-Type") ?? "");
      if (contentType !== "application/json") {
        throw new ApiError({ message: `Invalid response type '${contentType}'` });
      }

      const data = await response.json();
      console.log("Request succeeded:", (options as RequestInit).method ?? "GET", endpoint);
      return data;
    } catch (error) {
      console.error("fetch failed with error: ", error);
      if (error instanceof ApiError) {
        if (error.responseCode !== 401) {
          errorToast(error.message);
        }
        throw error;
      }
      errorToast(`${error}`);
      throw new ApiError({ message: `${error}`, cause: error });
    }
  }
}

export let api = new Api();
