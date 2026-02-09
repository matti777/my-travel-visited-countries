import type { User } from "firebase/auth";

/**
 * Renders the auth header content: optionally Home (when showHomeButton), then Login or (name + avatar + Log out).
 */
export function renderAuthHeader(
  container: HTMLElement,
  user: User | null,
  onLogin: () => void,
  onLogout: () => void,
  showHomeButton?: boolean,
  onGoHome?: () => void
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
    avatar.style.borderRadius = "50%";
    avatar.referrerPolicy = "no-referrer";
    if (user.photoURL) {
      avatar.src = user.photoURL;
    }
    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "Log out";
    logoutBtn.type = "button";
    logoutBtn.addEventListener("click", onLogout);
    container.appendChild(name);
    if (user.photoURL) container.appendChild(avatar);
    container.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Login";
    loginBtn.type = "button";
    loginBtn.addEventListener("click", onLogin);
    container.appendChild(loginBtn);
  }
}
