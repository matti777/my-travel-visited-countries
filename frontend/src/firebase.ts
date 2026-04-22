/**
 * Firebase App and Auth initialization.
 * The config values below come from env (VITE_FIREBASE_*) and are safe to expose
 * in client-side code: they identify the project, not authorize access. Security
 * is enforced by Firebase Security Rules and App Check.
 * See: https://firebase.google.com/docs/projects/api-keys
 */

import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/analytics";

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics();
export const auth = firebase.auth();

const LINK_SESSION_EMAIL_KEY = "link:email";
const LINK_SESSION_PENDING_CRED_KEY = "link:pendingCredentialJSON";
const LINK_SESSION_ATTEMPTED_PROVIDER_KEY = "link:attemptedProviderId";
const LINK_SESSION_EXISTING_PROVIDER_KEY = "link:existingProviderId";

type PendingCredJson = {
  providerId?: string;
  signInMethod?: string;
  oauthAccessToken?: string;
  oauthTokenSecret?: string;
  oauthIdToken?: string;
  accessToken?: string;
  secret?: string;
  idToken?: string;
};

function ensureAuthCredentialFromJsonPolyfill(): void {
  const AuthCredentialAny = (firebase.auth as any)?.AuthCredential as any;
  if (!AuthCredentialAny) return;
  if (typeof AuthCredentialAny.fromJSON === "function") return;

  AuthCredentialAny.fromJSON = (json: PendingCredJson): firebase.auth.AuthCredential => {
    const providerId = json?.providerId;
    if (providerId === "google.com") {
      const idToken = json.oauthIdToken ?? json.idToken ?? undefined;
      const accessToken = json.oauthAccessToken ?? json.accessToken ?? undefined;
      return (firebase.auth as any).GoogleAuthProvider.credential(idToken, accessToken);
    }
    if (providerId === "twitter.com") {
      const token = json.oauthAccessToken ?? json.accessToken;
      const secret = json.oauthTokenSecret ?? json.secret;
      if (!token || !secret) {
        throw new Error("Missing Twitter credential token/secret for account linking.");
      }
      return (firebase.auth as any).TwitterAuthProvider.credential(token, secret);
    }
    throw new Error(`Unsupported credential provider for linking: ${providerId ?? "unknown"}`);
  };
}

export function logAnalyticsEvent(
  eventName: string,
  params?: Record<string, string | number>,
): void {
  try {
    analytics.logEvent(eventName, params as Record<string, any> | undefined);
  } catch {
    // Ignore so missing or invalid Analytics config does not break the app.
  }
}

export async function completeRedirectSignIn(): Promise<void> {
  console.log("[auth] completeRedirectSignIn: start");
  ensureAuthCredentialFromJsonPolyfill();
  // Needed when sign-in uses redirects. Also surfaces redirect errors reliably.
  const redirectResult = await auth.getRedirectResult();
  console.log("[auth] completeRedirectSignIn: redirectResult", {
    hasUser: !!redirectResult?.user,
    hasCredential: !!(redirectResult as any)?.credential,
  });

  // If we previously started a linking flow that had to fall back to redirect,
  // complete it now that we are back in-app with an authenticated user.
  const email = sessionStorage.getItem(LINK_SESSION_EMAIL_KEY);
  const pendingCredJson = sessionStorage.getItem(LINK_SESSION_PENDING_CRED_KEY);
  console.log("[auth] completeRedirectSignIn: pendingLink", {
    hasEmail: !!email,
    hasPendingCredJson: !!pendingCredJson,
    existingProviderId: sessionStorage.getItem(LINK_SESSION_EXISTING_PROVIDER_KEY),
    attemptedProviderId: sessionStorage.getItem(LINK_SESSION_ATTEMPTED_PROVIDER_KEY),
  });
  if (email && pendingCredJson) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Sign-in completed, but no user was available to link accounts.");
    }
    const currentEmail = (user.email ?? "").trim().toLowerCase();
    if (currentEmail !== email.trim().toLowerCase()) {
      sessionStorage.removeItem(LINK_SESSION_EMAIL_KEY);
      sessionStorage.removeItem(LINK_SESSION_PENDING_CRED_KEY);
      sessionStorage.removeItem(LINK_SESSION_ATTEMPTED_PROVIDER_KEY);
      sessionStorage.removeItem(LINK_SESSION_EXISTING_PROVIDER_KEY);
      throw new Error(`Please sign in using the account for ${email}.`);
    }

    ensureAuthCredentialFromJsonPolyfill();
    const fromJson = (firebase.auth as any)?.AuthCredential?.fromJSON as
      | ((json: any) => firebase.auth.AuthCredential)
      | undefined;
    if (!fromJson) {
      throw new Error("Account linking is not supported in this browser/session.");
    }

    const pendingCred = fromJson(JSON.parse(pendingCredJson));
    console.log("[auth] completeRedirectSignIn: linking pending credential", {
      providerId: (pendingCred as any)?.providerId,
    });
    await user.linkWithCredential(pendingCred);
    console.log("[auth] completeRedirectSignIn: linkWithCredential success");

    sessionStorage.removeItem(LINK_SESSION_EMAIL_KEY);
    sessionStorage.removeItem(LINK_SESSION_PENDING_CRED_KEY);
    sessionStorage.removeItem(LINK_SESSION_ATTEMPTED_PROVIDER_KEY);
    sessionStorage.removeItem(LINK_SESSION_EXISTING_PROVIDER_KEY);
  }

  console.log("[auth] completeRedirectSignIn: done");
}

export function signOut(): Promise<void> {
  return auth.signOut();
}

export function subscribeToAuthStateChanged(callback: (user: firebase.User | null) => void): () => void {
  return auth.onAuthStateChanged(callback);
}
