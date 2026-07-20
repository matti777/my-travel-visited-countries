import DOMPurify from "dompurify";
import { attachTooltip } from "Components/tooltip";

type AuthUser = {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
} | null;

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders the auth header content: optionally Home (when showHomeButton), then Login or
 * (clickable name + avatar for profile + Log out).
 */
export function renderAuthHeader(
  container: HTMLElement,
  user: AuthUser,
  onLogin: () => void,
  onLogout: () => void,
  showHomeButton?: boolean,
  onGoHome?: () => void,
  onOpenProfile?: () => void,
): void {
  container.replaceChildren();
  if (showHomeButton && onGoHome) {
    const homeBtn = document.createElement("button");
    homeBtn.type = "button";
    homeBtn.textContent = "Home";
    homeBtn.className = "auth-header__home-btn";
    homeBtn.addEventListener("click", onGoHome);
    container.appendChild(homeBtn);
  }
  if (user) {
    const name = document.createElement("span");
    name.textContent = user.displayName ?? user.email ?? "Signed in";

    const avatar = document.createElement("img");
    avatar.alt = "Avatar";
    avatar.width = 24;
    avatar.height = 24;
    avatar.referrerPolicy = "no-referrer";
    if (user.photoURL) {
      avatar.src = user.photoURL;
    }

    if (onOpenProfile) {
      const identity = document.createElement("span");
      identity.className = "auth-header__identity";
      identity.appendChild(name);
      if (user.photoURL) {
        identity.appendChild(avatar);
      }
      identity.addEventListener("click", onOpenProfile);

      if (user.email) {
        const html = DOMPurify.sanitize(
          `<div>${escapeHtmlText(user.email)}</div>` +
            `<div class="auth-header__identity-tooltip-hint">` +
            `Click to view your profile and settings</div>`,
        );
        attachTooltip(identity, html, { useHtml: true });
      } else {
        attachTooltip(identity, "Click to view your profile and settings");
      }
      container.appendChild(identity);
    } else {
      container.appendChild(name);
      if (user.photoURL) {
        container.appendChild(avatar);
        if (user.email) attachTooltip(avatar, user.email);
      }
    }

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Log out";
    logoutBtn.type = "button";
    logoutBtn.addEventListener("click", onLogout);
    container.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Login";
    loginBtn.type = "button";
    loginBtn.addEventListener("click", onLogin);
    container.appendChild(loginBtn);
  }
}

