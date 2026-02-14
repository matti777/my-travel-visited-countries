/**
 * Firebase App and Auth initialization.
 * The config values below come from env (VITE_FIREBASE_*) and are safe to expose
 * in client-side code: they identify the project, not authorize access. Security
 * is enforced by Firebase Security Rules and App Check.
 * See: https://firebase.google.com/docs/projects/api-keys
 */

import { getAnalytics, logEvent } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

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

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

export function logAnalyticsEvent(
  eventName: string,
  params?: Record<string, string | number>,
): void {
  try {
    logEvent(analytics, eventName, params);
  } catch {
    // Ignore so missing or invalid Analytics config does not break the app.
  }
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, googleAuthProvider);
}

export function signOut(): Promise<void> {
  return firebaseSignOut(auth);
}

export function subscribeToAuthStateChanged(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
