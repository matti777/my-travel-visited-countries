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
  // Needed when sign-in uses redirects. Also surfaces redirect errors reliably.
  await auth.getRedirectResult();
}

export function signOut(): Promise<void> {
  return auth.signOut();
}

export function subscribeToAuthStateChanged(callback: (user: firebase.User | null) => void): () => void {
  return auth.onAuthStateChanged(callback);
}
