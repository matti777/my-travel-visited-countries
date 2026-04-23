import "firebaseui/dist/firebaseui.css";
import {
  createCountryVisitEditor,
  type CountryVisitEditorSubmitPayload,
} from "Components/country-visit-editor";
import { errorToast } from "Components/toast";
import { renderAuthHeader } from "Components/auth";
import { createCountryCell } from "Components/country-cell";
import { createShareSection } from "Components/share-section";
import { createCircleGraphCell } from "Components/circle-graph-cell";
import { createVisitMap } from "Components/visit-map";
import { sanitizeTagInput } from "Components/tag-editor";
import { attachTooltip } from "Components/tooltip";
import {
  VISIT_LIST_EDIT_FLOAT_ID,
  createVisitListEditFloat,
  updateVisitListEditFloat,
} from "Components/visit-list-edit-float";
import { confirmDialog, openModal } from "Components/modal";
import {
  auth,
  completeRedirectSignIn,
  logAnalyticsEvent,
  subscribeToAuthStateChanged,
  signOut,
} from "./firebase";
import { api, ApiError } from "./api";
import type { Country } from "./types/country";
import type { Friend } from "./types/friend";
import type { CountryVisit } from "./types/visit";
import type firebase from "firebase/compat/app";
import firebaseApp from "firebase/compat/app";
import "firebase/compat/auth";
import * as firebaseui from "firebaseui";

type User = firebase.User;

/** Country list from GET /countries, filled after app start (from cache or backend). */
export let countries: Country[] = [];

/** Country visits from GET /visits, filled when user is authenticated (on load and on login). */
export let visits: CountryVisit[] = [];

/** Share token from GET /visits response; used for Share URL when logged in. */
let shareToken: string | null = null;

/** Friends list from GET /friends, filled when user is authenticated (on load and on login). */
let friends: Friend[] = [];

/** Shared visit list when URL path is /share/<token>. */
let sharedVisits: CountryVisit[] = [];
let sharedUserName: string | null = null;
/** Image URL of the shared user (from GET /share/visits). */
let sharedUserImageUrl: string | null = null;

const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Hover content for by-continent and timeline visit cards (see user-interface.md). */
function buildVisitListCardTooltipHtml(visit: CountryVisit): string | null {
  const tags = visit.tags ?? [];
  const hasTags = tags.length > 0;
  const mediaHint = visit.mediaUrl
    ? `<p class="visit-tooltip__media-hint">Click to view attached media</p>`
    : "";

  if (!hasTags && !visit.mediaUrl) {
    return null;
  }

  if (!hasTags && visit.mediaUrl) {
    return `<div class="visit-tooltip">${mediaHint}</div>`;
  }

  const pillsHtml = tags
    .map(
      (t) =>
        `<span class="tag-editor__pill">` +
        `<span class="tag-editor__pill-label">${escapeHtmlText(t)}</span></span>`,
    )
    .join("");

  return (
    `<div class="visit-tooltip">` +
    `<div class="visit-tooltip__title">Tags for this visit</div>` +
    `<div class="tag-editor__pills visit-tooltip__pills">${pillsHtml}</div>` +
    `${mediaHint}` +
    `</div>`
  );
}

function getShareTokenFromPath(): string | null {
  let pathname = window.location.pathname;
  if (baseUrl && pathname.startsWith(baseUrl)) {
    pathname = pathname.slice(baseUrl.length) || "/";
  }
  const m = pathname.match(/^\/share\/([^/]+)\/?$/);
  if (!m) return null;
  try {
    const decoded = decodeURIComponent(m[1]);
    return decoded.trim() || null;
  } catch {
    return null;
  }
}

function homePath(): string {
  return baseUrl ? `${baseUrl}/` : "/";
}

let firebaseUi: any | null = null;

const FIREBASE_UI_OVERLAY_ANIM_MS = 400;

const LINK_SESSION_EMAIL_KEY = "link:email";
const LINK_SESSION_PENDING_CRED_KEY = "link:pendingCredentialJSON";
const LINK_SESSION_ATTEMPTED_PROVIDER_KEY = "link:attemptedProviderId";
const LINK_SESSION_EXISTING_PROVIDER_KEY = "link:existingProviderId";

function ensureAuthCredentialFromJsonPolyfill(): void {
  const AuthCredentialAny = (firebaseApp.auth as any)?.AuthCredential as any;
  if (!AuthCredentialAny) return;
  if (typeof AuthCredentialAny.fromJSON === "function") return;

  AuthCredentialAny.fromJSON = (json: any): firebase.auth.AuthCredential => {
    const providerId = json?.providerId;
    if (providerId === "google.com") {
      const idToken = json.oauthIdToken ?? json.idToken ?? undefined;
      const accessToken = json.oauthAccessToken ?? json.accessToken ?? undefined;
      return (firebaseApp.auth as any).GoogleAuthProvider.credential(idToken, accessToken);
    }
    if (providerId === "twitter.com") {
      const token = json.oauthAccessToken ?? json.accessToken;
      const secret = json.oauthTokenSecret ?? json.secret;
      if (!token || !secret) {
        throw new Error("Missing Twitter credential token/secret for account linking.");
      }
      return (firebaseApp.auth as any).TwitterAuthProvider.credential(token, secret);
    }
    if (providerId === "github.com") {
      const accessToken = json.oauthAccessToken ?? json.accessToken;
      if (!accessToken) {
        throw new Error("Missing GitHub access token for account linking.");
      }
      return (firebaseApp.auth as any).GithubAuthProvider.credential(accessToken);
    }
    throw new Error(`Unsupported credential provider for linking: ${providerId ?? "unknown"}`);
  };
}

function closeFirebaseUiOverlay(overlay: HTMLElement): void {
  if (!overlay.isConnected) return;
  overlay.classList.remove("firebaseui-overlay--visible");
  overlay.classList.add("firebaseui-overlay--closing");
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    overlay.remove();
  };
  overlay.addEventListener(
    "transitionend",
    (e) => {
      if (e.target !== overlay || e.propertyName !== "opacity") return;
      finish();
    },
    { once: true },
  );
  window.setTimeout(finish, FIREBASE_UI_OVERLAY_ANIM_MS + 80);
}

function revealFirebaseUiOverlay(overlay: HTMLElement): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add("firebaseui-overlay--visible"));
  });
}

function providerLabel(providerId: string): string {
  switch (providerId) {
    case "google.com":
      return "Google";
    case "twitter.com":
      return "Twitter / X";
    case "github.com":
      return "GitHub";
    case "password":
      return "Email and password";
    default:
      return providerId;
  }
}

function providerForId(providerId: string): firebase.auth.AuthProvider | null {
  switch (providerId) {
    case "google.com":
      return new (firebaseApp.auth as any).GoogleAuthProvider();
    case "twitter.com":
      return new (firebaseApp.auth as any).TwitterAuthProvider();
    case "github.com":
      return new (firebaseApp.auth as any).GithubAuthProvider();
    default:
      return null;
  }
}

function ensureFirebaseUiOverlay(): { overlay: HTMLDivElement; container: HTMLDivElement } {
  const existing = document.getElementById("firebaseui-overlay");
  const existingContainer = document.getElementById("firebaseui-auth-container");
  if (existing instanceof HTMLDivElement && existingContainer instanceof HTMLDivElement) {
    revealFirebaseUiOverlay(existing);
    return { overlay: existing, container: existingContainer };
  }

  const overlay = document.createElement("div");
  overlay.id = "firebaseui-overlay";
  overlay.className = "firebaseui-overlay";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeFirebaseUiOverlay(overlay);
  });

  const panel = document.createElement("div");
  panel.className = "firebaseui-overlay__panel";

  const header = document.createElement("div");
  header.className = "firebaseui-overlay__header";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "firebaseui-overlay__close";
  closeBtn.textContent = "Close";
  closeBtn.setAttribute("aria-label", "Close sign-in");
  closeBtn.addEventListener("click", () => closeFirebaseUiOverlay(overlay));

  const titleBlock = document.createElement("div");
  titleBlock.className = "firebaseui-overlay__title-block";
  const title = document.createElement("h2");
  title.className = "firebaseui-overlay__title";
  title.textContent = "Sign in";
  const intro = document.createElement("p");
  intro.className = "firebaseui-overlay__intro";
  intro.textContent = "Select an authentication provider below to log into Countries of Earth.";
  titleBlock.appendChild(title);
  titleBlock.appendChild(intro);
  header.appendChild(closeBtn);
  header.appendChild(titleBlock);
  panel.appendChild(header);

  const container = document.createElement("div");
  container.id = "firebaseui-auth-container";
  panel.appendChild(container);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  revealFirebaseUiOverlay(overlay);
  return { overlay, container };
}

type PendingAccountLink = {
  email: string;
  pendingCred: firebase.auth.AuthCredential;
  attemptedProviderId: string;
  methods: string[];
};

let pendingAccountLink: PendingAccountLink | null = null;

function closeLinkAccountsOverlay(): void {
  const overlay = document.getElementById("link-accounts-overlay");
  if (overlay) closeFirebaseUiOverlay(overlay);
  pendingAccountLink = null;
}

function ensureLinkAccountsOverlay(): { overlay: HTMLDivElement; body: HTMLDivElement } {
  const existing = document.getElementById("link-accounts-overlay");
  const existingBody = document.getElementById("link-accounts-body");
  if (existing instanceof HTMLDivElement && existingBody instanceof HTMLDivElement) {
    revealFirebaseUiOverlay(existing);
    return { overlay: existing, body: existingBody };
  }

  const overlay = document.createElement("div");
  overlay.id = "link-accounts-overlay";
  overlay.className = "firebaseui-overlay";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeLinkAccountsOverlay();
  });

  const panel = document.createElement("div");
  panel.className = "firebaseui-overlay__panel";

  const header = document.createElement("div");
  header.className = "firebaseui-overlay__header";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "firebaseui-overlay__close";
  closeBtn.textContent = "Close";
  closeBtn.setAttribute("aria-label", "Close account linking");
  closeBtn.addEventListener("click", closeLinkAccountsOverlay);

  const titleBlock = document.createElement("div");
  titleBlock.className = "firebaseui-overlay__title-block";
  const title = document.createElement("h2");
  title.className = "firebaseui-overlay__title";
  title.textContent = "Link accounts";
  const intro = document.createElement("p");
  intro.className = "firebaseui-overlay__intro";
  intro.textContent =
    "You already have an account with this email. Sign in with the existing provider to link the new one.";
  titleBlock.appendChild(title);
  titleBlock.appendChild(intro);
  header.appendChild(closeBtn);
  header.appendChild(titleBlock);
  panel.appendChild(header);

  const body = document.createElement("div");
  body.id = "link-accounts-body";
  body.className = "link-accounts__body";
  panel.appendChild(body);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  revealFirebaseUiOverlay(overlay);
  return { overlay, body };
}

function renderLinkAccountsOverlay(state: PendingAccountLink): void {
  const { body } = ensureLinkAccountsOverlay();
  body.replaceChildren();

  const details = document.createElement("div");
  details.className = "link-accounts__details";
  const p1 = document.createElement("p");
  p1.className = "link-accounts__detail";
  p1.textContent = `Email: ${state.email}`;
  const p2 = document.createElement("p");
  p2.className = "link-accounts__detail";
  p2.textContent = `You tried: ${providerLabel(state.attemptedProviderId)}`;
  details.appendChild(p1);
  details.appendChild(p2);
  body.appendChild(details);

  const methods = state.methods.filter((m) => m !== state.attemptedProviderId);
  const supported = methods.filter((m) => providerForId(m) != null);

  if (supported.length === 0) {
    const msg = document.createElement("p");
    msg.className = "link-accounts__detail";
    msg.textContent = "No supported existing sign-in method was found for this email.";
    body.appendChild(msg);
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "link-accounts__btn";
    backBtn.textContent = "Back to sign in";
    backBtn.addEventListener("click", () => {
      closeLinkAccountsOverlay();
      startFirebaseUi();
    });
    body.appendChild(backBtn);
    return;
  }

  const list = document.createElement("div");
  list.className = "link-accounts__methods";
  body.appendChild(list);

  let busy = false;
  const setBusy = (b: boolean): void => {
    busy = b;
    list.querySelectorAll("button").forEach((btn) => {
      (btn as HTMLButtonElement).disabled = busy;
    });
  };

  for (const providerId of supported) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "link-accounts__btn";
    btn.textContent = `Continue with ${providerLabel(providerId)}`;
    btn.addEventListener("click", async () => {
      if (busy || !pendingAccountLink) return;
      setBusy(true);
      logAnalyticsEvent("auth_link_start", {
        attempted_provider: pendingAccountLink.attemptedProviderId,
        existing_provider: providerId,
      });
      try {
        const provider = providerForId(providerId);
        if (!provider) throw new Error("Unsupported provider");

        try {
          const result = await auth.signInWithPopup(provider);
          const user = result.user;
          if (!user) throw new Error("Sign-in failed");
          const currentEmail = (user.email ?? "").trim().toLowerCase();
          if (currentEmail !== pendingAccountLink.email.trim().toLowerCase()) {
            throw new Error(`Please choose the account for ${pendingAccountLink.email}.`);
          }
          await user.linkWithCredential(pendingAccountLink.pendingCred);
          logAnalyticsEvent("auth_link_success", {
            attempted_provider: pendingAccountLink.attemptedProviderId,
            existing_provider: providerId,
          });
          closeLinkAccountsOverlay();
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code && CANCELLED_AUTH_CODES.has(code)) return;
          if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
            const toJson = (pendingAccountLink.pendingCred as any)?.toJSON as (() => any) | undefined;
            if (!toJson) throw new Error("Account linking is not supported in this browser/session.");
            sessionStorage.setItem(LINK_SESSION_EMAIL_KEY, pendingAccountLink.email);
            sessionStorage.setItem(LINK_SESSION_PENDING_CRED_KEY, JSON.stringify(toJson.call(pendingAccountLink.pendingCred)));
            sessionStorage.setItem(LINK_SESSION_ATTEMPTED_PROVIDER_KEY, pendingAccountLink.attemptedProviderId);
            sessionStorage.setItem(LINK_SESSION_EXISTING_PROVIDER_KEY, providerId);
            await auth.signInWithRedirect(provider);
            return;
          }
          throw err;
        }
      } catch (err) {
        const code = (err as { code?: string })?.code;
        logAnalyticsEvent("auth_link_failed", { code: code ?? "unknown" });
        console.error("Account linking failed:", err);
        errorToast(err instanceof Error ? err.message : "Account linking failed");
      } finally {
        setBusy(false);
      }
    });
    list.appendChild(btn);
  }
}

function startFirebaseUi(): void {
  ensureAuthCredentialFromJsonPolyfill();
  const { container } = ensureFirebaseUiOverlay();
  if (!firebaseUi) {
    firebaseUi = new (firebaseui as any).auth.AuthUI(auth);
  }
  console.log("[auth] startFirebaseUi: start");
  firebaseUi.start(container, {
    signInFlow: "popup",
    signInOptions: [
      // Provider IDs are Firebase Auth constants.
      "google.com",
      "twitter.com",
      "github.com",
    ],
    callbacks: {
      signInSuccessWithAuthResult: () => {
        console.log("[auth] firebaseui: signInSuccessWithAuthResult");
        const overlay = document.getElementById("firebaseui-overlay");
        if (overlay) closeFirebaseUiOverlay(overlay);
        return false;
      },
      signInFailure: async (err: any) => {
        const code = (err as { code?: string })?.code;
        console.log("[auth] firebaseui: signInFailure", { code, err });
        if (code && CANCELLED_AUTH_CODES.has(code)) return;
        if (code !== "auth/account-exists-with-different-credential") {
          throw err;
        }

        // Important: FirebaseUI may render its own recovery UI (e.g. "Recover password")
        // while we await network calls. Reset/close it immediately so our custom linking
        // flow takes over deterministically.
        try {
          firebaseUi?.reset?.();
        } catch {
          // ignore
        }
        const firebaseUiOverlay = document.getElementById("firebaseui-overlay");
        if (firebaseUiOverlay) closeFirebaseUiOverlay(firebaseUiOverlay);

        const pendingCred = (err as { credential?: firebase.auth.AuthCredential })?.credential;
        const email =
          (err as { email?: string })?.email ??
          (err as { customData?: { email?: string } })?.customData?.email ??
          null;

        console.log("[auth] account-exists: extracted", {
          hasPendingCred: !!pendingCred,
          email,
          pendingCredProviderId: (pendingCred as any)?.providerId,
        });
        if (!pendingCred || !email) {
          errorToast("Sign in failed: could not determine account email for linking.");
          return;
        }

        try {
          const methods = await auth.fetchSignInMethodsForEmail(email);
          console.log("[auth] account-exists: methods", { email, methods });
          pendingAccountLink = {
            email,
            pendingCred,
            attemptedProviderId: (pendingCred as any)?.providerId ?? "unknown",
            methods,
          };
          renderLinkAccountsOverlay(pendingAccountLink);
          return;
        } catch (e) {
          console.error("Failed to fetch sign-in methods:", e);
          errorToast("Sign in failed");
          // Fall back to the normal sign-in UI.
          startFirebaseUi();
          return;
        }
      },
    },
  });
}

/** Visit IDs that were just added; used to trigger fade-in animation. Cleared after animation. */
const newVisitIds = new Set<string>();

/** Firebase Auth error codes that mean user cancelled or closed the sign-in popup. */
const CANCELLED_AUTH_CODES = new Set(["auth/cancelled-popup-request", "auth/popup-closed-by-user"]);

const REGION_CODE_TO_NAME: Record<string, string> = {
  AF: "Africa",
  AN: "Antarctica",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  OC: "Oceania",
  SA: "South America",
};

/** Fill colors per continent for statistics circle graph (same as map tab, user-interface.md). */
const REGION_CODE_TO_FILL_COLOR: Record<string, string> = {
  EU: "#add8e6",
  NA: "#e0ffff",
  SA: "#90ee90",
  AF: "#f08080",
  AS: "#fffacd",
  OC: "#40e0d0",
};
const STATISTICS_DEFAULT_FILL_COLOR = "#40e0d0";

function getRegionName(regionCode: string): string {
  return REGION_CODE_TO_NAME[regionCode] ?? regionCode;
}

function formatVisitTime(visitedTime?: string): string {
  if (!visitedTime) return "—";
  const d = new Date(visitedTime);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Parses an ISO date string or YYYY-MM-DD to year, month (1–12), day for analytics. Returns zeros if missing/invalid.
 */
function parseVisitDateToYMD(isoOrVisitedTime?: string | null): { year: number; month: number; day: number } {
  if (!isoOrVisitedTime) return { year: 0, month: 0, day: 0 };
  const d = new Date(isoOrVisitedTime);
  if (Number.isNaN(d.getTime())) return { year: 0, month: 0, day: 0 };
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Unix seconds for start of day UTC from YYYY-MM-DD visit form value. */
function isoDateToUnixSeconds(isoDate: string): number {
  return Math.floor(new Date(isoDate + "T00:00:00Z").getTime() / 1000);
}

function tagsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((t, i) => t === sb[i]);
}

/** Build PUT body fields only for changes; omit keys the backend should leave unchanged. */
function buildVisitUpdatePatch(
  visit: CountryVisit,
  payload: CountryVisitEditorSubmitPayload,
): { visitedTime?: number; tags?: string[]; mediaUrl?: string } {
  const patch: { visitedTime?: number; tags?: string[]; mediaUrl?: string } = {};
  const newUnix = isoDateToUnixSeconds(payload.isoDate);
  const oldUnix = visit.visitedTime
    ? Math.floor(new Date(visit.visitedTime).getTime() / 1000)
    : NaN;
  if (Number.isNaN(oldUnix) || newUnix !== oldUnix) {
    patch.visitedTime = newUnix;
  }
  const newTags = payload.tags ?? [];
  const oldTags = visit.tags ?? [];
  if (!tagsEqual(newTags, oldTags)) {
    patch.tags = newTags;
  }
  const newMedia = (payload.mediaUrl ?? "").trim();
  const oldMedia = (visit.mediaUrl ?? "").trim();
  if (newMedia !== oldMedia) {
    patch.mediaUrl = newMedia;
  }
  return patch;
}

/**
 * Merge PUT response into local visit. `patch` is the body we sent so we can apply a cleared
 * `mediaUrl` when the backend omits the key from JSON (`omitempty`).
 */
function mergeVisitAfterPut(
  prev: CountryVisit,
  put: CountryVisit,
  patch: { visitedTime?: number; tags?: string[]; mediaUrl?: string },
): CountryVisit {
  const base: CountryVisit = {
    ...prev,
    visitedTime: put.visitedTime ?? prev.visitedTime,
    tags: put.tags ?? [],
    userId: put.userId || prev.userId,
    id: prev.id ?? put.id,
    countryCode: prev.countryCode,
  };
  if (patch.mediaUrl !== undefined) {
    return {
      ...base,
      mediaUrl: patch.mediaUrl === "" ? undefined : patch.mediaUrl,
    };
  }
  return {
    ...base,
    mediaUrl: put.mediaUrl !== undefined ? put.mediaUrl : prev.mediaUrl,
  };
}

/**
 * Returns list of visits unique by country code (first occurrence each). Used for non-edit display.
 */
function uniqueVisitsByCountry(list: CountryVisit[]): CountryVisit[] {
  const seen = new Set<string>();
  return list.filter((v) => {
    if (seen.has(v.countryCode)) return false;
    seen.add(v.countryCode);
    return true;
  });
}

/**
 * Returns visits sorted alphabetically by country name (using countries to resolve name).
 */
function sortedVisitsAlphabetically(list: CountryVisit[], countriesList: Country[]): CountryVisit[] {
  const nameFor = (code: string) => countriesList.find((c) => c.countryCode === code)?.name ?? code;
  return [...list].sort((a, b) => nameFor(a.countryCode).localeCompare(nameFor(b.countryCode)));
}

/**
 * Groups visits by regionCode; each group sorted by country name. Continents sorted by display name.
 */
function groupVisitsByContinent(
  list: CountryVisit[],
  countriesList: Country[],
): { regionCode: string; regionName: string; visits: CountryVisit[] }[] {
  const byRegion = new Map<string, CountryVisit[]>();
  const nameFor = (code: string) => countriesList.find((c) => c.countryCode === code)?.name ?? code;
  for (const v of list) {
    const country = countriesList.find((c) => c.countryCode === v.countryCode);
    const regionCode = country?.regionCode ?? "ZZ";
    if (!byRegion.has(regionCode)) byRegion.set(regionCode, []);
    byRegion.get(regionCode)!.push(v);
  }
  const regionNames = new Map<string, string>();
  byRegion.forEach((_, code) => {
    regionNames.set(code, getRegionName(code));
  });
  const sortedRegions = [...byRegion.entries()].sort((a, b) =>
    regionNames.get(a[0])!.localeCompare(regionNames.get(b[0])!),
  );
  return sortedRegions.map(([regionCode, visits]) => ({
    regionCode,
    regionName: getRegionName(regionCode),
    visits: [...visits].sort((a, b) => {
      const nameCmp = nameFor(a.countryCode).localeCompare(nameFor(b.countryCode));
      if (nameCmp !== 0) return nameCmp;
      return (a.visitedTime ?? "").localeCompare(b.visitedTime ?? "");
    }),
  }));
}

/**
 * Groups visits by year (from visitedTime); years sorted ascending. Visits within a year sorted by visitedTime then country name.
 */
function groupVisitsByYear(
  list: CountryVisit[],
  countriesList: Country[],
): { year: number; visits: CountryVisit[] }[] {
  const byYear = new Map<number, CountryVisit[]>();
  const nameFor = (code: string) => countriesList.find((c) => c.countryCode === code)?.name ?? code;
  for (const v of list) {
    let year = 0;
    if (v.visitedTime) {
      const d = new Date(v.visitedTime);
      if (!Number.isNaN(d.getTime())) year = d.getUTCFullYear();
    }
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(v);
  }
  const sortedYears = [...byYear.keys()].sort((a, b) => a - b);
  return sortedYears.map((year) => ({
    year,
    visits: [...(byYear.get(year)!)].sort((a, b) => {
      const timeCmp = (a.visitedTime ?? "").localeCompare(b.visitedTime ?? "");
      if (timeCmp !== 0) return timeCmp;
      return nameFor(a.countryCode).localeCompare(nameFor(b.countryCode));
    }),
  }));
}

export interface RenderOptions {
  countries: Country[];
  visits: CountryVisit[];
  user: User | null;
  isEditMode: boolean;
  onRefresh: () => void;
  selectedCountryCode: string;
  onSelectCountry: (code: string) => void;
  formVisitDate: string | null;
  onFormVisitDateChange: (value: string | null) => void;
  formMediaUrl: string;
  onFormMediaUrlChange: (value: string) => void;
  shareToken: string | null;
  isSharedMode: boolean;
  sharedVisits: CountryVisit[];
  sharedUserName: string | null;
  sharedUserImageUrl: string | null;
  onGoHome: () => void;
  visitListTab: "alphabetical" | "byContinent" | "map" | "timeline" | "statistics";
  onVisitListTabChange: (tab: "alphabetical" | "byContinent" | "map" | "timeline" | "statistics") => void;
  onLogin: () => void;
  friends: Friend[];
  onAddFriend: () => void;
  onDeleteFriend: (shareToken: string) => void;
  onViewMediaUrl?: (visit: CountryVisit) => void;
  onCountryVisitEditorSubmit: (payload: CountryVisitEditorSubmitPayload) => Promise<void>;
}

const TAG_FILTER_DEBOUNCE_MS = 1000;

let tagFilterInputValue = "";
let tagFilterActiveQuery = "";
let tagFilterDebounceTimer: number | null = null;

/** Refreshes visited UI after debounced tag filter updates; assigned in main(). */
let refreshAfterTagFilter: () => void = () => {};

function applyTagFilterToVisits(list: CountryVisit[], query: string): CountryVisit[] {
  if (query.length < 2) return list;
  return list.filter((v) => (v.tags ?? []).some((t) => t.includes(query)));
}

function clearTagFilterDebounceTimer(): void {
  if (tagFilterDebounceTimer !== null) {
    window.clearTimeout(tagFilterDebounceTimer);
    tagFilterDebounceTimer = null;
  }
}

function scheduleTagFilterDebounce(): void {
  clearTagFilterDebounceTimer();
  tagFilterDebounceTimer = window.setTimeout(() => {
    tagFilterDebounceTimer = null;
    const next = tagFilterInputValue.length >= 2 ? tagFilterInputValue : "";
    if (next !== tagFilterActiveQuery) {
      tagFilterActiveQuery = next;
      refreshAfterTagFilter();
    }
  }, TAG_FILTER_DEBOUNCE_MS);
}

function buildVisitDisplayList(
  fullList: CountryVisit[],
  visitListTab: RenderOptions["visitListTab"],
  isEditMode: boolean,
): CountryVisit[] {
  const filtered = applyTagFilterToVisits(fullList, tagFilterActiveQuery);
  if (isEditMode || visitListTab === "byContinent" || visitListTab === "timeline") {
    return filtered;
  }
  return uniqueVisitsByCountry(filtered);
}

function buildFilteredVisitsForMap(fullList: CountryVisit[]): CountryVisit[] {
  return applyTagFilterToVisits(fullList, tagFilterActiveQuery);
}

function visitedCountryTitleCount(fullList: CountryVisit[]): number {
  if (tagFilterActiveQuery.length >= 2) {
    const filtered = applyTagFilterToVisits(fullList, tagFilterActiveQuery);
    return uniqueVisitsByCountry(filtered).length;
  }
  return uniqueVisitsByCountry(fullList).length;
}

function createTagFilterRow(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "visit-list-tag-filter";
  const field = document.createElement("div");
  field.className = "visit-list-tag-filter__field";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "visit-list-tag-filter__input tag-editor__input";
  input.placeholder = "Filter by tags";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Filter by tags");
  input.value = tagFilterInputValue;

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "visit-list-tag-filter__clear";
  clearBtn.setAttribute("aria-label", "Clear search filter");
  clearBtn.textContent = "×";
  clearBtn.hidden = tagFilterInputValue.length === 0;
  attachTooltip(clearBtn, "Clear search filter");

  function syncClearVisible(): void {
    clearBtn.hidden = tagFilterInputValue.length === 0;
  }

  input.addEventListener("input", () => {
    tagFilterInputValue = sanitizeTagInput(input.value);
    input.value = tagFilterInputValue;
    syncClearVisible();
    scheduleTagFilterDebounce();
  });

  clearBtn.addEventListener("click", () => {
    tagFilterInputValue = "";
    input.value = "";
    syncClearVisible();
    clearTagFilterDebounceTimer();
    if (tagFilterActiveQuery !== "") {
      tagFilterActiveQuery = "";
      refreshAfterTagFilter();
    }
    input.focus();
  });

  field.appendChild(input);
  field.appendChild(clearBtn);
  wrap.appendChild(field);
  return wrap;
}

async function handleDeleteVisit(visit: CountryVisit, cell: HTMLElement, onRefresh: () => void): Promise<void> {
  if (!visit.id) return;
  try {
    await api.deleteVisit(visit.id);
    const d = parseVisitDateToYMD(visit.visitedTime);
    logAnalyticsEvent("remove_visit", {
      country_code: visit.countryCode,
      year: d.year,
      month: d.month,
      day: d.day,
    });
    cell.classList.add("cell-fade-out");
    cell.addEventListener(
      "transitionend",
      () => {
        visits = visits.filter((v) => v.id !== visit.id);
        onRefresh();
      },
      { once: true },
    );
  } catch (err) {
    if (err instanceof ApiError && err.responseCode === 401) {
      signOut();
      errorToast("Session expired");
    } else {
      errorToast(err instanceof Error ? err.message : "Failed to delete visit");
    }
  }
}

function unixSecondsToIsoDate(visitedTime?: string | null): string | null {
  if (!visitedTime) return null;
  const d = new Date(visitedTime);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function createVisitListTabRow(
  visitListTab: RenderOptions["visitListTab"],
  onVisitListTabChange: RenderOptions["onVisitListTabChange"],
): HTMLElement {
  const tabRow = document.createElement("div");
  tabRow.className = "visit-list-tabs";
  const tabs: { tab: "alphabetical" | "byContinent" | "map" | "timeline" | "statistics"; label: string }[] = [
    { tab: "alphabetical", label: "Alphabetical" },
    { tab: "byContinent", label: "By continent" },
    { tab: "map", label: "Map" },
    { tab: "timeline", label: "Timeline" },
    { tab: "statistics", label: "Statistics" },
  ];
  for (const { tab, label } of tabs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "visit-list-tabs__tab";
    if (visitListTab === tab) btn.classList.add("visit-list-tabs__tab--active");
    btn.textContent = label;
    btn.addEventListener("click", () => onVisitListTabChange(tab));
    tabRow.appendChild(btn);
  }
  return tabRow;
}

interface FillVisitListContentParams {
  contentArea: HTMLElement;
  displayList: CountryVisit[];
  countriesList: Country[];
  visitListTab: RenderOptions["visitListTab"];
  /** Visits shown on map (tag-filtered); tooltips use this set. */
  visitsForMap: CountryVisit[];
  /** Full RAM list for Statistics tab only (no tag filter). */
  statisticsSourceVisits: CountryVisit[];
  isEditMode?: boolean;
  onRefresh?: () => void;
  onViewMediaUrl?: (visit: CountryVisit) => void;
}

function fillVisitListContent(params: FillVisitListContentParams): void {
  const {
    contentArea,
    displayList,
    countriesList,
    visitListTab,
    visitsForMap,
    statisticsSourceVisits,
    isEditMode = false,
    onRefresh,
    onViewMediaUrl,
  } = params;

  if (visitListTab === "map") {
    const uniqueCodes = [...new Set(displayList.map((v) => v.countryCode))];
    createVisitMap(contentArea, {
      countryCodes: uniqueCodes,
      countries: countriesList,
      visits: visitsForMap,
      baseUrl,
      onViewMediaUrl,
    });
    return;
  }
  if (visitListTab === "statistics") {
    const listedCodeSet = new Set(countriesList.map((c) => c.countryCode.toUpperCase()));
    const visitsForStatistics = statisticsSourceVisits.filter((v) =>
      listedCodeSet.has(v.countryCode.toUpperCase())
    );
    const countryCodeToRegion = new Map<string, string>();
    const regionTotals = new Map<string, number>();
    for (const c of countriesList) {
      const code = c.countryCode.toUpperCase();
      countryCodeToRegion.set(code, c.regionCode);
      regionTotals.set(c.regionCode, (regionTotals.get(c.regionCode) ?? 0) + 1);
    }
    const worldTotal = countriesList.length;
    const uniqueCodes = new Set(visitsForStatistics.map((v) => v.countryCode.toUpperCase()));
    const visitedByRegion = new Map<string, number>();
    for (const code of uniqueCodes) {
      const region = countryCodeToRegion.get(code) ?? "ZZ";
      visitedByRegion.set(region, (visitedByRegion.get(region) ?? 0) + 1);
    }
    const worldVisited = uniqueCodes.size;
    const STATISTICS_REGION_ORDER = ["AF", "AS", "EU", "NA", "OC", "SA"] as const;
    const wrapper = document.createElement("div");
    wrapper.className = "statistics-section";
    const areas: { key: string; name: string; visited: number; total: number }[] = [
      ...STATISTICS_REGION_ORDER.map((regionCode) => ({
        key: regionCode,
        name: getRegionName(regionCode),
        visited: visitedByRegion.get(regionCode) ?? 0,
        total: regionTotals.get(regionCode) ?? 0,
      })),
      { key: "world", name: "The World", visited: worldVisited, total: worldTotal },
    ];
    for (const area of areas) {
      const percentage = area.total > 0 ? Math.round((area.visited / area.total) * 100) : 0;
      const fillColor =
        area.key === "world"
          ? STATISTICS_DEFAULT_FILL_COLOR
          : REGION_CODE_TO_FILL_COLOR[area.key] ?? STATISTICS_DEFAULT_FILL_COLOR;
      const cell = createCircleGraphCell({
        percentage,
        fillColor,
        label: area.name,
      });
      const notVisitedCountries =
        area.key === "world"
          ? countriesList.filter((c) => !uniqueCodes.has(c.countryCode.toUpperCase()))
          : countriesList.filter(
              (c) => c.regionCode === area.key && !uniqueCodes.has(c.countryCode.toUpperCase()),
            );
      const notVisitedNames = notVisitedCountries.map((c) => c.name).sort();
      const escapeHtml = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const firstLine = `${area.visited} / ${area.total} countries visited in ${area.name}`;
      const maxList = 30;
      const shown = notVisitedNames.slice(0, maxList).map(escapeHtml).join(", ");
      const remaining = notVisitedNames.length - maxList;
      const notVisitedList =
        notVisitedNames.length === 0
          ? "—"
          : remaining > 0
            ? `${shown} and ${remaining} more`
            : shown;
      const tooltipHtml =
        `<span style="display:block; padding-bottom:0.5em">${escapeHtml(firstLine)}</span>` +
        `<strong>Countries not visited:</strong> ${notVisitedList}`;
      attachTooltip(cell, tooltipHtml, { useHtml: true });
      wrapper.appendChild(cell);
    }
    contentArea.appendChild(wrapper);
    return;
  }
  if (displayList.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No visited countries yet";
    empty.className = "visited-empty";
    contentArea.appendChild(empty);
    return;
  }

  function addCellToGrid(
    grid: HTMLElement,
    visit: CountryVisit,
    name: string,
    withEdit: boolean,
    showVisitTimeAlways?: boolean,
  ): void {
    const cellRef: { current: HTMLElement | null } = { current: null };
    const showVisitTime = showVisitTimeAlways || (withEdit && visit.id && onRefresh);
    const cellOptions = showVisitTime
      ? {
          visitTimeLabel: formatVisitTime(visit.visitedTime),
          onDelete:
            withEdit && visit.id && onRefresh
              ? () => {
                  void (async () => {
                    const ok = await confirmDialog({
                      title: "Confirm deletion",
                      message: `Are you sure you want to delete the visit to ${name} at ${formatVisitTime(visit.visitedTime)}?`,
                      danger: true,
                      confirmText: "Yes, delete",
                      cancelText: "No",
                    });
                    if (!ok) return;
                    if (cellRef.current) await handleDeleteVisit(visit, cellRef.current, onRefresh);
                  })();
                }
              : undefined,
        }
      : undefined;
    const cell = createCountryCell(visit.countryCode, name, baseUrl, cellOptions);
    cellRef.current = cell;
    if (showVisitTimeAlways && isEditMode) {
      cell.classList.add("country-cell--edit-clickable");
    }
    if (showVisitTimeAlways) {
      if (isEditMode) {
        attachTooltip(cell, "Click to edit this visit");
        cell.addEventListener("click", (e) => {
          if ((e.target as HTMLElement).closest?.(".country-cell__delete")) return;
          if (!visit.id) return;

          let editorCountry = visit.countryCode;
          let editorIsoDate = unixSecondsToIsoDate(visit.visitedTime) ?? new Date().toISOString().slice(0, 10);
          let editorMediaUrl = visit.mediaUrl ?? "";
          const editorTags = visit.tags ?? [];

          const body = document.createElement("div");
          let closeModal: (() => void) | null = null;
          const editor = createCountryVisitEditor({
            mode: "edit",
            title: `Edit your visit to ${name}`,
            countryNameForEditMode: name,
            countries: countriesList,
            baseUrl,
            selectedCountryCode: editorCountry,
            onSelectCountry: (code) => {
              editorCountry = code;
            },
            formVisitDate: editorIsoDate,
            onFormVisitDateChange: (v) => {
              editorIsoDate = v ?? editorIsoDate;
            },
            formMediaUrl: editorMediaUrl,
            onFormMediaUrlChange: (v) => {
              editorMediaUrl = v;
            },
            initialTags: editorTags,
            onSubmit: async (payload) => {
              if (!visit.id) return;
              try {
                const patch = buildVisitUpdatePatch(visit, payload);
                const patchKeys = Object.keys(patch) as (keyof typeof patch)[];
                if (patchKeys.length === 0) {
                  closeModal?.();
                  return;
                }
                const updated = await api.updateVisit(visit.id, patch);
                visits = visits.map((v) =>
                  v.id === visit.id ? mergeVisitAfterPut(v, updated, patch) : v,
                );
                onRefresh?.();
                closeModal?.();
              } catch (err) {
                if (err instanceof ApiError && err.responseCode === 401) {
                  signOut();
                  errorToast("Session expired");
                } else {
                  errorToast(err instanceof Error ? err.message : "Failed to update visit");
                }
              }
            },
          });
          body.appendChild(editor);

          const footer = document.createElement("div");
          footer.className = "app-confirm__actions";
          const closeBtn = document.createElement("button");
          closeBtn.type = "button";
          closeBtn.className = "app-confirm__btn";
          closeBtn.textContent = "Close without saving";
          closeBtn.setAttribute("aria-label", "Close without saving");
          footer.appendChild(closeBtn);

          const { close } = openModal({
            ariaLabel: `Edit visit to ${name}`,
            body,
            footer,
            showCloseButton: false,
            footerPlain: true,
          });
          closeModal = () => close("programmatic");
          closeBtn.addEventListener("click", () => close("closeButton"));
        });
      } else {
        const tooltipHtml = buildVisitListCardTooltipHtml(visit);
        if (tooltipHtml) {
          attachTooltip(cell, tooltipHtml, { useHtml: true });
        }
      }
    }
    if (visit.mediaUrl && showVisitTimeAlways && !isEditMode) {
      cell.classList.add("country-cell--has-media");
      cell.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest?.(".country-cell__delete")) return;
        const d = parseVisitDateToYMD(visit.visitedTime);
        logAnalyticsEvent("view_media_url", {
          country_code: visit.countryCode,
          year: d.year,
          month: d.month,
          day: d.day,
        });
        window.open(visit.mediaUrl!, "_blank");
      });
    }
    const isNew = visit.id != null && newVisitIds.has(visit.id);
    if (isNew) {
      cell.classList.add("cell-fade-in");
      requestAnimationFrame(() => {
        cell.classList.add("visible");
        if (visit.id) newVisitIds.delete(visit.id);
      });
    }
    grid.appendChild(cell);
  }

  if (visitListTab === "alphabetical") {
    const sortedList = sortedVisitsAlphabetically(displayList, countriesList);
    const grid = document.createElement("div");
    grid.className = "visited-grid visited-grid--enter";
    requestAnimationFrame(() => grid.classList.add("visible"));
    for (const visit of sortedList) {
      const name = countriesList.find((c) => c.countryCode === visit.countryCode)?.name ?? visit.countryCode;
      addCellToGrid(grid, visit, name, false);
    }
    contentArea.appendChild(grid);
    return;
  }

  if (visitListTab === "timeline") {
    const yearGroups = groupVisitsByYear(displayList, countriesList);
    const wrapper = document.createElement("div");
    wrapper.className = "visit-list-by-continent";
    for (const { year, visits: groupVisits } of yearGroups) {
      const section = document.createElement("div");
      section.className = "visit-list-by-continent__section";
      const subTitle = document.createElement("h3");
      subTitle.className = "visit-list-by-continent__title";
      subTitle.textContent = `${year} (${groupVisits.length})`;
      section.appendChild(subTitle);
      const grid = document.createElement("div");
      grid.className = "visited-grid visited-grid--enter";
      requestAnimationFrame(() => grid.classList.add("visible"));
      for (const visit of groupVisits) {
        const name = countriesList.find((c) => c.countryCode === visit.countryCode)?.name ?? visit.countryCode;
        addCellToGrid(grid, visit, name, isEditMode, true);
      }
      section.appendChild(grid);
      wrapper.appendChild(section);
    }
    contentArea.appendChild(wrapper);
    return;
  }

  const groups = groupVisitsByContinent(displayList, countriesList);
  const wrapper = document.createElement("div");
  wrapper.className = "visit-list-by-continent";
  for (const { regionName, visits: groupVisits } of groups) {
    const section = document.createElement("div");
    section.className = "visit-list-by-continent__section";
    const subTitle = document.createElement("h3");
    subTitle.className = "visit-list-by-continent__title";
    const countryCount = new Set(groupVisits.map((v) => v.countryCode)).size;
    subTitle.textContent = `${regionName} (${countryCount})`;
    section.appendChild(subTitle);
    const grid = document.createElement("div");
    grid.className = "visited-grid visited-grid--enter";
    requestAnimationFrame(() => grid.classList.add("visible"));
    for (const visit of groupVisits) {
      const name = countriesList.find((c) => c.countryCode === visit.countryCode)?.name ?? visit.countryCode;
      addCellToGrid(grid, visit, name, isEditMode, true);
    }
    section.appendChild(grid);
    wrapper.appendChild(section);
  }
  contentArea.appendChild(wrapper);
}

function renderSharedVisitSection(container: HTMLElement, options: RenderOptions): void {
  const {
    countries: countriesList,
    sharedVisits: sharedVisitsList,
    sharedUserName: sharedUserNameVal,
    sharedUserImageUrl: _sharedUserImageUrl,
    onGoHome,
  } = options;
  const visitedSection = document.createElement("section");
  visitedSection.className = "app-section";
  const title = document.createElement("h1");
  title.textContent = sharedUserNameVal ? `${sharedUserNameVal}'s visited countries` : "Shared visit list";
  visitedSection.appendChild(title);
  if (options.visitListTab !== "statistics") {
    visitedSection.appendChild(createTagFilterRow());
  }

  let displayList = buildVisitDisplayList(sharedVisitsList, options.visitListTab, false);
  if (
    options.visitListTab !== "byContinent" &&
    options.visitListTab !== "timeline"
  ) {
    displayList = sortedVisitsAlphabetically(displayList, countriesList);
  }

  const contentArea = document.createElement("div");
  contentArea.className = "visit-list-content";
  fillVisitListContent({
    contentArea,
    displayList,
    countriesList,
    visitListTab: options.visitListTab,
    visitsForMap: buildFilteredVisitsForMap(sharedVisitsList),
    statisticsSourceVisits: sharedVisitsList,
    onViewMediaUrl: options.onViewMediaUrl,
  });
  const tabRow = createVisitListTabRow(options.visitListTab, options.onVisitListTabChange);
  const listFrame = document.createElement("div");
  listFrame.className =
    "visit-list-frame visit-list-frame--tab-" +
    (options.visitListTab === "alphabetical"
      ? "0"
      : options.visitListTab === "byContinent"
        ? "1"
        : options.visitListTab === "map"
          ? "2"
          : options.visitListTab === "timeline"
            ? "3"
            : "4");
  listFrame.appendChild(contentArea);
  listFrame.appendChild(tabRow);
  visitedSection.appendChild(listFrame);
  const homeWrap = document.createElement("div");
  homeWrap.className = "share-home-wrap";
  const homeBtn = document.createElement("button");
  homeBtn.type = "button";
  homeBtn.textContent = "Home";
  homeBtn.className = "share-home-btn";
  homeBtn.addEventListener("click", onGoHome);
  homeWrap.appendChild(homeBtn);
  visitedSection.appendChild(homeWrap);
  container.appendChild(visitedSection);
}

function renderAddFriendSection(container: HTMLElement, options: RenderOptions): void {
  const currentShareToken = getShareTokenFromPath();
  const { sharedUserName: name, friends: friendsList, onAddFriend } = options;
  if (!currentShareToken || name == null) return;
  const isAlreadyFriend = friendsList.some((f) => f.shareToken === currentShareToken);
  const section = document.createElement("section");
  section.className = "app-section add-friend-section";
  if (isAlreadyFriend) {
    const text = document.createElement("p");
    text.className = "add-friend-section__text";
    text.textContent = `${name} is in your friend list.`;
    section.appendChild(text);
  } else {
    const box = document.createElement("div");
    box.className = "add-friend-section__box";
    const text = document.createElement("p");
    text.className = "add-friend-section__text";
    text.textContent = `Would you like to add ${name} to your friends list?`;
    box.appendChild(text);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "add-friend-section__btn";
    btn.textContent = "Add friend";
    btn.addEventListener("click", () => onAddFriend());
    box.appendChild(btn);
    section.appendChild(box);
  }
  container.appendChild(section);
}

function renderNormalVisitedSection(container: HTMLElement, options: RenderOptions, displayList: CountryVisit[]): void {
  container.replaceChildren();
  const { countries: countriesList, visits: visitsList, isEditMode } = options;
  const visitedSection = document.createElement("section");
  visitedSection.className = "app-section";
  const titleRow = document.createElement("div");
  titleRow.className = "app-section__title-row";
  const visitedTitle = document.createElement("h1");
  visitedTitle.textContent = `Your visited countries (${visitedCountryTitleCount(visitsList)})`;
  titleRow.appendChild(visitedTitle);
  visitedSection.appendChild(titleRow);
  if (options.visitListTab !== "statistics") {
    visitedSection.appendChild(createTagFilterRow());
  }
  const contentArea = document.createElement("div");
  contentArea.className = "visit-list-content";
  fillVisitListContent({
    contentArea,
    displayList,
    countriesList,
    visitListTab: options.visitListTab,
    visitsForMap: buildFilteredVisitsForMap(visitsList),
    statisticsSourceVisits: visitsList,
    isEditMode,
    onRefresh: options.onRefresh,
    onViewMediaUrl: options.onViewMediaUrl,
  });
  const tabRow = createVisitListTabRow(options.visitListTab, options.onVisitListTabChange);
  const listFrame = document.createElement("div");
  listFrame.className =
    "visit-list-frame visit-list-frame--tab-" +
    (options.visitListTab === "alphabetical"
      ? "0"
      : options.visitListTab === "byContinent"
        ? "1"
        : options.visitListTab === "map"
          ? "2"
          : options.visitListTab === "timeline"
            ? "3"
            : "4");
  listFrame.appendChild(contentArea);
  listFrame.appendChild(tabRow);
  visitedSection.appendChild(listFrame);
  container.appendChild(visitedSection);
}

/** Stable id for partial refresh of the visited-countries block (see #app-visited). */
const APP_VISITED_SECTION_ID = "app-visited";

function removeVisitListEditFloatFromDom(): void {
  document.getElementById(VISIT_LIST_EDIT_FLOAT_ID)?.remove();
}

/** 4 Polaroid images: [left top, left bottom, right top, right bottom] */
const WELCOME_POLAROID_IMAGES = [
  "welcome-polaroid-1.jpg",
  "welcome-polaroid-2.jpg",
  "welcome-polaroid-3.jpg",
  "welcome-polaroid-4.jpg",
];

const WELCOME_POLAROID_ALTS = [
  "Polaroid-style travel photo from a visited city",
  "Travel snapshot from a trip abroad",
  "Landmark photo from a country on the world map",
  "Scenic travel memory from a visited destination",
];

/** Rotation in degrees for fridge-pin look: left top, left bottom, right top, right bottom */
const WELCOME_POLAROID_ROTATIONS = ["-4deg", "3deg", "2deg", "-5deg"];

function renderWelcomeView(container: HTMLElement, onLogin: () => void): void {
  const wrap = document.createElement("div");
  wrap.className = "welcome-view";

  const brand = document.createElement("div");
  brand.className = "welcome-view__brand";
  const brandTitle = document.createElement("h1");
  brandTitle.className = "welcome-view__brand-title";
  brandTitle.textContent = "Countries of Earth";
  brand.appendChild(brandTitle);
  wrap.appendChild(brand);

  const inner = document.createElement("div");
  inner.className = "welcome-view__inner";

  const leftSide = document.createElement("div");
  leftSide.className = "welcome-view__side welcome-view__side--left";
  for (let i = 0; i < 2; i++) {
    const frame = document.createElement("div");
    frame.className = "welcome-view__photo";
    frame.style.transform = `rotate(${WELCOME_POLAROID_ROTATIONS[i]})`;
    const img = document.createElement("img");
    img.src = `${baseUrl}/assets/images/${WELCOME_POLAROID_IMAGES[i]}`;
    img.alt = WELCOME_POLAROID_ALTS[i] ?? "Travel photo from the welcome collage";
    img.loading = "lazy";
    frame.appendChild(img);
    leftSide.appendChild(frame);
  }
  inner.appendChild(leftSide);

  const content = document.createElement("div");
  content.className = "welcome-view__content";
  const p1 = document.createElement("p");
  p1.className = "welcome-view__text";
  p1.textContent =
    "A free online tool for keeping track of the countries you have visited. " +
    "After you sign in, you can browse your list alphabetically, by continent, on a map, or along a timeline—and share a read-only link with friends.";
  content.appendChild(p1);
  const p2 = document.createElement("p");
  p2.className = "welcome-view__text";
  p2.textContent =
    "Add visit dates and attach media links and similar metadata—photo collections, video URLs, and more—from the places you've explored.";
  content.appendChild(p2);
  const p3 = document.createElement("p");
  p3.className = "welcome-view__text";
  p3.textContent = "Log in to start creating your travel history!";
  content.appendChild(p3);
  inner.appendChild(content);

  const rightSide = document.createElement("div");
  rightSide.className = "welcome-view__side welcome-view__side--right";
  for (let i = 2; i < 4; i++) {
    const frame = document.createElement("div");
    frame.className = "welcome-view__photo";
    frame.style.transform = `rotate(${WELCOME_POLAROID_ROTATIONS[i]})`;
    const img = document.createElement("img");
    img.src = `${baseUrl}/assets/images/${WELCOME_POLAROID_IMAGES[i]}`;
    img.alt = WELCOME_POLAROID_ALTS[i] ?? "Travel photo from the welcome collage";
    img.loading = "lazy";
    frame.appendChild(img);
    rightSide.appendChild(frame);
  }
  inner.appendChild(rightSide);

  wrap.appendChild(inner);

  const loginWrap = document.createElement("div");
  loginWrap.className = "welcome-view__login-wrap";
  const loginBtn = document.createElement("button");
  loginBtn.type = "button";
  loginBtn.className = "welcome-view__login-btn";
  loginBtn.textContent = "Login";
  loginBtn.addEventListener("click", onLogin);
  loginWrap.appendChild(loginBtn);
  wrap.appendChild(loginWrap);

  container.appendChild(wrap);
}

/**
 * Renders the main #app content from current state: visited countries section and add-visit form when logged in, or shared list when URL is /share/<token>.
 */
function renderAppContent(container: HTMLElement, options: RenderOptions): void {
  const { user, isEditMode, visits: visitsList, isSharedMode } = options;
  removeVisitListEditFloatFromDom();
  container.replaceChildren();

  if (isSharedMode) {
    renderSharedVisitSection(container, options);
    if (user) {
      renderAddFriendSection(container, options);
    }
    return;
  }
  if (!user) {
    renderWelcomeView(container, options.onLogin);
    return;
  }

  const displayList = buildVisitDisplayList(visitsList, options.visitListTab, isEditMode);
  const visitedWrap = document.createElement("div");
  visitedWrap.id = APP_VISITED_SECTION_ID;
  renderNormalVisitedSection(visitedWrap, options, displayList);
  container.appendChild(visitedWrap);
  const addShareWrapper = document.createElement("div");
  addShareWrapper.id = "app-add-share";
  addShareWrapper.appendChild(
    createCountryVisitEditor({
      countries: options.countries,
      baseUrl,
      selectedCountryCode: options.selectedCountryCode,
      onSelectCountry: options.onSelectCountry,
      formVisitDate: options.formVisitDate,
      onFormVisitDateChange: options.onFormVisitDateChange,
      formMediaUrl: options.formMediaUrl,
      onFormMediaUrlChange: options.onFormMediaUrlChange,
      onSubmit: options.onCountryVisitEditorSubmit,
    }),
  );
  addShareWrapper.appendChild(createShareSection(options.shareToken));
  container.appendChild(addShareWrapper);

  renderFriendsListSection(container, options);
}

function renderFriendsListSection(container: HTMLElement, options: RenderOptions): void {
  const { friends: friendsList, onDeleteFriend } = options;
  const section = document.createElement("section");
  section.className = "app-section friends-section";
  const title = document.createElement("h2");
  title.className = "friends-section__title";
  title.textContent = "Friends";
  section.appendChild(title);
  const list = document.createElement("div");
  list.className = "friends-list";
  if (friendsList.length === 0) {
    const empty = document.createElement("p");
    empty.className = "friends-section__empty";
    empty.textContent = "No friends yet";
    list.appendChild(empty);
  } else {
    for (const friend of friendsList) {
      const cell = document.createElement("div");
      cell.className = "friend-cell";
      const linkArea = document.createElement("div");
      linkArea.className = "friend-cell__link-area";
      if (friend.imageUrl) {
        const img = document.createElement("img");
        img.src = friend.imageUrl;
        img.alt = "";
        img.className = "friend-cell__avatar";
        linkArea.appendChild(img);
      }
      const nameEl = document.createElement("span");
      nameEl.className = "friend-cell__name";
      nameEl.textContent = friend.name;
      linkArea.appendChild(nameEl);
      const viewLink = document.createElement("span");
      viewLink.className = "friend-cell__view";
      viewLink.textContent = "View";
      linkArea.appendChild(viewLink);
      linkArea.addEventListener("click", () => {
        history.pushState(
          null,
          "",
          `${baseUrl}/share/${encodeURIComponent(friend.shareToken)}`,
        );
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      attachTooltip(linkArea, `Click to view country visits by ${friend.name}`);
      cell.appendChild(linkArea);
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "friend-cell__delete";
      deleteBtn.textContent = "✕";
      deleteBtn.setAttribute("aria-label", "Remove friend");
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        void (async () => {
          const ok = await confirmDialog({
            title: "Confirm removal",
            message: `Are you sure you want to remove friend ${friend.name}?`,
            danger: true,
            confirmText: "Yes, remove",
            cancelText: "No",
          });
          if (!ok) return;
          onDeleteFriend(friend.shareToken);
        })();
      });
      attachTooltip(deleteBtn, `Click to remove ${friend.name} as friend`);
      cell.appendChild(deleteBtn);
      list.appendChild(cell);
    }
  }
  section.appendChild(list);
  container.appendChild(section);
}

export async function main(): Promise<void> {
  const authHeaderEl = document.getElementById("auth-header");
  const appEl = document.getElementById("app");
  if (!appEl) return;

  try {
    await completeRedirectSignIn();
  } catch (err) {
    console.error("Redirect sign-in failed:", err);
    errorToast(err instanceof Error ? err.message : "Sign in failed");
  }

  let currentUser: firebase.User | null = null;
  let isEditMode = false;
  let visitListTab: "alphabetical" | "byContinent" | "map" | "timeline" | "statistics" = "alphabetical";
  let selectedCountryCode = "";
  let formVisitDate: string | null = null;
  let formMediaUrl = "";

  async function applyShareRoute(): Promise<void> {
    const token = getShareTokenFromPath();
    if (token) {
      try {
        const r = await api.getShareVisits(token);
        sharedVisits = r.visits;
        sharedUserName = r.userName;
        sharedUserImageUrl = r.imageUrl ?? null;
        logAnalyticsEvent("open_shared_url", { share_token: token });
      } catch (err) {
        console.error("Failed to load shared visits", err);
        errorToast("Invalid or expired share link");
        sharedVisits = [];
        sharedUserName = null;
        sharedUserImageUrl = null;
      }
    } else {
      sharedVisits = [];
      sharedUserName = null;
      sharedUserImageUrl = null;
    }
    if (authHeaderEl) {
      renderAuthHeader(
        authHeaderEl,
        currentUser,
        onLogin,
        onLogout,
        !!getShareTokenFromPath(),
        navigateHome,
      );
    }
    refreshAppContent();
  }

  function navigateHome(): void {
    history.pushState(null, "", homePath());
    void applyShareRoute();
  }

  function onLogin(): void {
    console.log("[auth] onLogin: clicked");
    sessionStorage.setItem("login:initiated", "1");
    Promise.resolve()
      .then(() => startFirebaseUi())
      .catch((err) => {
      sessionStorage.removeItem("login:initiated");
      const code = (err as { code?: string })?.code;
      if (code && CANCELLED_AUTH_CODES.has(code)) {
        return;
      }
      console.error("Sign in failed:", err);
      errorToast(err instanceof Error ? err.message : "Sign in failed");
      });
  }
  function onLogout(): void {
    api.clearCountriesCache();
    signOut().then(async () => {
      logAnalyticsEvent("logout");
      api.setAuthToken(null);
      try {
        countries = await api.getCountries();
        console.log("Countries reloaded after logout", countries.length);
      } catch {
        countries = [];
      }
      refreshAppContent();
      console.log("Signed out");
    });
  }

  function queueVisitListEditFloatExit(): void {
    const el = document.getElementById(VISIT_LIST_EDIT_FLOAT_ID);
    if (!el) return;
    if (!el.classList.contains("visit-list-edit-float--visible")) {
      el.remove();
      return;
    }
    const onEnd = (e: TransitionEvent): void => {
      if (e.target !== el || e.propertyName !== "opacity") return;
      el.removeEventListener("transitionend", onEnd);
      el.remove();
    };
    el.addEventListener("transitionend", onEnd);
    el.classList.remove("visit-list-edit-float--visible");
  }

  function enterEditModeAndRefresh(): void {
    isEditMode = true;
    refreshVisitListSection();
  }

  function exitEditModeAndRefresh(): void {
    if (!isEditMode) return;
    isEditMode = false;
    refreshVisitListSection();
  }

  function syncVisitListEditFloat(): void {
    const shouldShow =
      !!currentUser &&
      !getShareTokenFromPath() &&
      (visitListTab === "byContinent" || visitListTab === "timeline");

    if (!shouldShow) {
      queueVisitListEditFloatExit();
      return;
    }

    const mode = isEditMode ? "editing" : "idle";
    const onPrimary = mode === "idle" ? enterEditModeAndRefresh : exitEditModeAndRefresh;

    let el = document.getElementById(VISIT_LIST_EDIT_FLOAT_ID);
    if (!el) {
      el = createVisitListEditFloat({ mode, onPrimary });
      document.body.appendChild(el);
    } else {
      updateVisitListEditFloat(el, { mode, onPrimary });
    }

    const primaryBtn = el.querySelector(".visit-list-edit-float__action");
    if (primaryBtn instanceof HTMLElement) {
      attachTooltip(
        primaryBtn,
        mode === "idle" ? "Click to edit the visits list" : "Click to complete editing",
      );
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => el!.classList.add("visit-list-edit-float--visible"));
    });
  }

  function refreshVisitListSection(): void {
    if (!appEl) return;
    const wrap = document.getElementById(APP_VISITED_SECTION_ID);
    if (!wrap) {
      refreshAppContent();
      return;
    }
    const opts = getRenderOptions();
    const displayList = buildVisitDisplayList(visits, opts.visitListTab, opts.isEditMode);
    renderNormalVisitedSection(wrap, opts, displayList);
    syncVisitListEditFloat();
  }

  function getRenderOptions(): RenderOptions {
    return {
      countries,
      visits,
      user: currentUser,
      isEditMode,
      onRefresh: refreshVisitListSection,
      selectedCountryCode,
      onSelectCountry: (code: string) => {
        selectedCountryCode = code;
        refreshAddFormAndShare();
      },
      formVisitDate,
      onFormVisitDateChange: (value: string | null) => {
        formVisitDate = value;
        refreshAddFormAndShare();
      },
      formMediaUrl,
      onFormMediaUrlChange: (value: string) => {
        formMediaUrl = value;
      },
      shareToken,
      isSharedMode: !!getShareTokenFromPath(),
      sharedVisits,
      sharedUserName,
      sharedUserImageUrl,
      onGoHome: navigateHome,
      visitListTab,
      onVisitListTabChange: (tab: "alphabetical" | "byContinent" | "map" | "timeline" | "statistics") => {
        const supportsEditing = tab === "byContinent" || tab === "timeline";
        if (!supportsEditing) {
          exitEditModeAndRefresh();
        }
        visitListTab = tab;
        const tabParam = tab === "byContinent" ? "by_continent" : tab;
        logAnalyticsEvent("select_tab", { tab: tabParam });
        if (currentUser && !getShareTokenFromPath() && document.getElementById(APP_VISITED_SECTION_ID)) {
          refreshVisitListSection();
        } else {
          refreshAppContent();
        }
        if (tab === "map" || tab === "statistics") {
          window.scrollTo(0, 0);
        }
      },
      onLogin,
      friends,
      onAddFriend: async () => {
        const token = getShareTokenFromPath();
        if (!token || sharedUserName == null) return;
        try {
          await api.postFriend(token, sharedUserName, sharedUserImageUrl ?? undefined);
          logAnalyticsEvent("add_friend", { share_token: token });
          friends = [
            ...friends,
            { shareToken: token, name: sharedUserName, imageUrl: sharedUserImageUrl ?? undefined },
          ];
          refreshAppContent();
        } catch (err) {
          if (err instanceof ApiError && err.responseCode === 401) {
            signOut();
            errorToast("Session expired");
          } else {
            errorToast(err instanceof Error ? err.message : "Failed to add friend");
          }
        }
      },
      onDeleteFriend: async (shareTokenToDelete: string) => {
        try {
          await api.deleteFriend(shareTokenToDelete);
          logAnalyticsEvent("remove_friend", { share_token: shareTokenToDelete });
          friends = friends.filter((f) => f.shareToken !== shareTokenToDelete);
          refreshAppContent();
        } catch (err) {
          if (err instanceof ApiError && err.responseCode === 401) {
            signOut();
            errorToast("Session expired");
          } else {
            errorToast(err instanceof Error ? err.message : "Failed to remove friend");
          }
        }
      },
      onViewMediaUrl: (visit) => {
        const d = parseVisitDateToYMD(visit.visitedTime);
        logAnalyticsEvent("view_media_url", {
          country_code: visit.countryCode,
          year: d.year,
          month: d.month,
          day: d.day,
        });
      },
      onCountryVisitEditorSubmit: async (payload: CountryVisitEditorSubmitPayload) => {
        const { countryCode, isoDate, mediaUrl, tags } = payload;
        const visitedTime = isoDateToUnixSeconds(isoDate);
        try {
          const created = await api.postVisit(countryCode, visitedTime, mediaUrl, tags);
          visits = [...visits, created];
          if (created.id) newVisitIds.add(created.id);
          const d = parseVisitDateToYMD(isoDate);
          logAnalyticsEvent("add_visit", {
            country_code: countryCode,
            year: d.year,
            month: d.month,
            day: d.day,
          });
          selectedCountryCode = "";
          formVisitDate = null;
          formMediaUrl = "";
          refreshAppContent();
        } catch (err) {
          console.error("Add visit failed:", err);
          if (err instanceof ApiError && err.responseCode === 401) {
            signOut();
            errorToast("Session expired");
          } else {
            errorToast(err instanceof Error ? err.message : "Failed to add visit");
          }
        }
      },
    };
  }

  function refreshAddFormAndShare(): void {
    if (!appEl) return;
    const addShareWrapper = document.getElementById("app-add-share");
    if (!addShareWrapper) return;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    addShareWrapper.replaceChildren();
    const opts = getRenderOptions();
    addShareWrapper.appendChild(
      createCountryVisitEditor({
        countries: opts.countries,
        baseUrl,
        selectedCountryCode: opts.selectedCountryCode,
        onSelectCountry: opts.onSelectCountry,
        formVisitDate: opts.formVisitDate,
        onFormVisitDateChange: opts.onFormVisitDateChange,
        formMediaUrl: opts.formMediaUrl,
        onFormMediaUrlChange: opts.onFormMediaUrlChange,
        onSubmit: opts.onCountryVisitEditorSubmit,
      }),
    );
    addShareWrapper.appendChild(createShareSection(shareToken));
    window.scrollTo(scrollX, scrollY);
  }

  function refreshAppContent(): void {
    if (!appEl) return;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    renderAppContent(appEl, getRenderOptions());
    window.scrollTo(scrollX, scrollY);
    syncVisitListEditFloat();
  }

  refreshAfterTagFilter = () => {
    if (!appEl) return;
    if (currentUser && !getShareTokenFromPath() && document.getElementById(APP_VISITED_SECTION_ID)) {
      refreshVisitListSection();
    } else {
      refreshAppContent();
    }
  };

  if (authHeaderEl) {
    const unsubscribe = subscribeToAuthStateChanged(async (user) => {
      console.log("[auth] onAuthStateChanged", {
        hasUser: !!user,
        uid: user?.uid,
        email: user?.email,
        providers: user?.providerData?.map((p) => p?.providerId).filter(Boolean),
        loginInitiated: !!sessionStorage.getItem("login:initiated"),
      });
      currentUser = user;
      if (user) {
        const token = await user.getIdToken();
        api.setAuthToken(token);
        // POST /login only when user just completed the Login button flow (ensures user in DB before GET /visits).
        const loginInitiated = sessionStorage.getItem("login:initiated");
        if (loginInitiated) {
          try {
            console.log("[auth] postLogin: start");
            await api.postLogin();
            console.log("[auth] postLogin: success");
          } catch (err) {
            console.error("Post-login failed", err);
            if (err instanceof ApiError && err.responseCode === 401) {
              signOut();
              errorToast("Session expired");
            } else {
              errorToast("Failed to complete login");
            }
            sessionStorage.removeItem("login:initiated");
            renderAuthHeader(authHeaderEl, user, onLogin, onLogout, false, navigateHome);
            refreshAppContent();
            return;
          }
          sessionStorage.removeItem("login:initiated");
          logAnalyticsEvent("login");
        }
        if (!getShareTokenFromPath()) {
          console.log("[auth] loadUserData: start");
          const [visitsSettled, friendsSettled] = await Promise.allSettled([api.getVisits(), api.getFriends()]);
          if (visitsSettled.status === "fulfilled") {
            visits = visitsSettled.value.visits;
            shareToken = visitsSettled.value.shareToken ?? null;
          } else {
            visits = [];
            shareToken = null;
            console.error("Failed to load visits", visitsSettled.reason);
            if (visitsSettled.reason instanceof ApiError && visitsSettled.reason.responseCode === 401) {
              signOut();
              errorToast("Session expired");
            } else {
              errorToast("Failed to load visits");
            }
          }
          if (friendsSettled.status === "fulfilled") {
            friends = friendsSettled.value.friends;
          } else {
            friends = [];
            console.error("Failed to load friends", friendsSettled.reason);
          }
          console.log("[auth] loadUserData: done");
        }
      } else {
        api.setAuthToken(null);
        visits = [];
        shareToken = null;
        friends = [];
      }
      const showHome = !!getShareTokenFromPath();
      renderAuthHeader(authHeaderEl, user, onLogin, onLogout, showHome, navigateHome);
      refreshAppContent();
    });
    void unsubscribe;
  }

  try {
    countries = await api.getCountries();
    console.log("App initialized with", countries.length, "countries");
  } catch (err) {
    countries = [];
    console.error("Countries load failed", err);
  }

  window.addEventListener("popstate", () => {
    void applyShareRoute();
  });

  await applyShareRoute();

  window.addEventListener("error", function (event) {
    console.error(
      "Caught an error:",
      event.message,
      "at",
      event.filename,
      "line",
      event.lineno,
      "column",
      event.colno,
      "error object:",
      event.error,
    );
    errorToast(`Error occurred: ${event.message}`);
    event.preventDefault();
  });

  window.addEventListener("unhandledrejection", function (event) {
    console.error("Unhandled promise rejection:", event.reason);
    errorToast("Something went wrong");
    event.preventDefault();
  });
}

document.addEventListener("DOMContentLoaded", function () {
  main();
});
