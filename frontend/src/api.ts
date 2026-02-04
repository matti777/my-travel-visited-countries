import { errorToast } from "Components/toast";
import type { Country, CountriesResponse } from "./types/country";

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

      const contentType = this.parseContentType(response.headers.get("Content-Type") ?? "");
      if (contentType !== "application/json") {
        throw new ApiError({ message: `Invalid response type '${contentType}'` });
      }

      const data = await response.json();
      console.log("Request succeeded:", (options as RequestInit).method ?? "GET", endpoint);
      return data;
    } catch (error) {
      console.error("fetch failed with error: ", error);
      errorToast(`${error}`);
      if (error instanceof ApiError) {
        // If we get Not Authorized error this means that the login session has expired
        // and we need to re-authenticate
        if (error.responseCode === 401) {
          console.error("Session expired, re-authenticating.", error);
          errorToast("Session expired");
          location.hash = "";
          location.reload();
          return;
        }

        throw error;
      } else {
        throw new ApiError({ message: `${error}`, cause: error });
      }
    }
  }
}

export let api = new Api();
