import { errorToast } from "Components/toast";

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

  setAuthToken(token: string): void {
    sessionStorage.setItem(Api.SESSION_KEY_AUTHTOKEN, token);
    if (token) {
      console.log("Auth token registered");
    }
  }

  getAuthToken(): string | null {
    return sessionStorage.getItem(Api.SESSION_KEY_AUTHTOKEN);
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

      return await response.json();
    } catch (error) {
      console.error("fetch failed with error: ", error);
      errorToast(`${error}`);
      if (error instanceof ApiError) {
        // If we get Not Authorized error this means that the login session has expired
        // and we need to re-authenticate
        if (error.responseCode === 401) {
          console.log(`Session expired, re-authenticating. Error: ${JSON.stringify(error)}`);
          // signOut();
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
