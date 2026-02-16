import { errorToast } from "Components/toast";
import type { Country, CountriesResponse } from "./types/country";
import type { Friend, FriendsResponse } from "./types/friend";
import type { CountryVisit, ShareVisitsResponse, VisitsResponse } from "./types/visit";


const COUNTRIES_CACHE_KEY = "app:countries:cache";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REQUEST_TIMEOUT_MS = 5_000; // connection/request timeout
const RETRY_DELAY_MS = 1_500; // wait before retry after connection failure

interface CountriesCache {
  countries: Country[];
  cachedAt: number;
}

function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof ApiError) return false;
  const err = error as Error;
  if (err instanceof TypeError && err.message === "Failed to fetch") return true;
  if (err?.name === "AbortError") return true;
  return false;
}

function fetchWithTimeout(endpoint: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(endpoint, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
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

  async getFriends(): Promise<{ friends: Friend[] }> {
    const token = this.getAuthToken();
    if (!token) {
      return { friends: [] };
    }
    const response = (await this.performRequest("/friends", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    })) as FriendsResponse;
    return { friends: response?.friends ?? [] };
  }

  async getShareVisits(shareToken: string): Promise<ShareVisitsResponse> {
    const response = (await this.performRequest(
      `/share/visits/${encodeURIComponent(shareToken)}`,
      { method: "GET" }
    )) as ShareVisitsResponse;
    return response;
  }

  async putVisits(countryCode: string, visitedTime: number, mediaUrl?: string): Promise<CountryVisit> {
    const token = this.getAuthToken();
    if (!token) {
      throw new ApiError({ message: "Not authenticated" });
    }
    const body: { countryCode: string; visitedTime: number; mediaUrl?: string } = { countryCode, visitedTime };
    if (mediaUrl != null && mediaUrl !== "") {
      body.mediaUrl = mediaUrl;
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

  async postFriend(shareToken: string, name: string, imageUrl?: string): Promise<Friend> {
    const token = this.getAuthToken();
    if (!token) {
      throw new ApiError({ message: "Not authenticated" });
    }
    const body: { shareToken: string; name: string; imageUrl?: string } = { shareToken, name };
    if (imageUrl != null && imageUrl !== "") {
      body.imageUrl = imageUrl;
    }
    const response = (await this.performRequest("/friends", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })) as Friend;
    return response;
  }

  async deleteFriend(shareToken: string): Promise<void> {
    const token = this.getAuthToken();
    if (!token) {
      throw new ApiError({ message: "Not authenticated" });
    }
    await this.performRequest(`/friends/${encodeURIComponent(shareToken)}`, {
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
    let response: Response;
    try {
      response = await fetchWithTimeout(endpoint, options, REQUEST_TIMEOUT_MS);
    } catch (firstError) {
      if (!isRetryableNetworkError(firstError)) {
        console.error("fetch failed with error: ", firstError);
        errorToast(`${firstError}`);
        throw new ApiError({ message: `${firstError}`, cause: firstError });
      }
      console.warn("API request failed (e.g. connection closed), retrying in", RETRY_DELAY_MS / 1000, "s:", endpoint, firstError);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      try {
        response = await fetchWithTimeout(endpoint, options, REQUEST_TIMEOUT_MS);
      } catch (retryError) {
        console.error("fetch failed on retry: ", retryError);
        errorToast(`${retryError}`);
        throw new ApiError({ message: `${retryError}`, cause: retryError });
      }
    }

    if (response.status < 200 || response.status >= 400) {
      const apiError = new ApiError({
        message: `Invalid status ${response.status}: ${response.statusText}`,
        responseCode: response.status,
      });
      if (response.status !== 401) {
        errorToast(apiError.message);
      }
      throw apiError;
    }

    if (response.status === 204) {
      return undefined;
    }

    const contentType = this.parseContentType(response.headers.get("Content-Type") ?? "");
    if (contentType !== "application/json") {
      throw new ApiError({ message: `Invalid response type '${contentType}'` });
    }

    return response.json();
  }
}

export let api = new Api();
