import type { User } from "firebase/auth";

/**
 * Renders the auth header content: either LOGIN or (name + avatar + LOG OUT).
 */
export function renderAuthHeader(
  container: HTMLElement,
  user: User | null,
  onLogin: () => void,
  onLogout: () => void
): void {
  container.replaceChildren();
  if (user) {
    const name = document.createElement("span");
    name.textContent = user.displayName ?? user.email ?? "Signed in";
    const avatar = document.createElement("img");
    avatar.alt = "Avatar";
    avatar.width = 24;
    avatar.height = 24;
    avatar.style.borderRadius = "50%";
    if (user.photoURL) {
      avatar.src = user.photoURL;
    }
    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "LOG OUT";
    logoutBtn.type = "button";
    logoutBtn.addEventListener("click", onLogout);
    container.appendChild(name);
    if (user.photoURL) container.appendChild(avatar);
    container.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "LOGIN";
    loginBtn.type = "button";
    loginBtn.addEventListener("click", onLogin);
    container.appendChild(loginBtn);
  }
}
