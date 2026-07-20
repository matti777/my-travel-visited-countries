import DOMPurify from "dompurify";
import { marked } from "marked";
import { attachTooltip } from "Components/tooltip";
import type { Country } from "../../types/country";

export interface UserProfileData {
  name: string;
  imageUrl?: string;
  homeCountryCode?: string;
  instagramUserName?: string;
  description?: string;
  countriesVisited: number;
}

export interface CreateUserProfileOptions extends UserProfileData {
  countries: Country[];
  baseUrl: string;
}

export interface UserProfileHandle {
  element: HTMLElement;
  update(data: Partial<UserProfileData>): void;
}

function renderMarkdownHtml(markdown: string): string {
  const raw = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(raw);
}

function isMobileUserAgent(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function instagramWebUrl(username: string): string {
  return `https://www.instagram.com/${encodeURIComponent(username)}/`;
}

function openInstagramProfile(username: string): void {
  const webUrl = instagramWebUrl(username);
  if (!isMobileUserAgent()) {
    window.open(webUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const appUrl = `instagram://user?username=${encodeURIComponent(username)}`;
  let fellBack = false;
  const fallback = (): void => {
    if (fellBack) return;
    fellBack = true;
    window.location.href = webUrl;
  };

  const onVisibility = (): void => {
    if (document.hidden) {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  const timer = window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibility);
    if (!document.hidden) {
      fallback();
    }
  }, 900);

  window.location.href = appUrl;
}

function createInstagramIconSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("user-profile__instagram-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5zM17.5 6.75a1.25 1.25 0 1 1-1.25 1.25 1.25 1.25 0 0 1 1.25-1.25z",
  );
  path.setAttribute("fill", "currentColor");
  svg.appendChild(path);
  return svg;
}

/**
 * Read-only traveller profile. See frontend/spec/components/user-profile.md.
 */
export function createUserProfile(options: CreateUserProfileOptions): UserProfileHandle {
  const { countries, baseUrl } = options;
  let state: UserProfileData = {
    name: options.name,
    imageUrl: options.imageUrl,
    homeCountryCode: options.homeCountryCode,
    instagramUserName: options.instagramUserName,
    description: options.description,
    countriesVisited: options.countriesVisited,
  };

  const root = document.createElement("section");
  root.className = "app-section user-profile";

  const avatarWrap = document.createElement("div");
  avatarWrap.className = "user-profile__avatar-wrap";
  const avatar = document.createElement("img");
  avatar.className = "user-profile__avatar";
  avatar.alt = "Avatar";
  avatar.referrerPolicy = "no-referrer";
  avatarWrap.appendChild(avatar);
  root.appendChild(avatarWrap);

  const fields = document.createElement("div");
  fields.className = "user-profile__fields";

  const nameRow = document.createElement("div");
  nameRow.className = "user-profile__row";
  const nameLabel = document.createElement("span");
  nameLabel.className = "user-profile__label";
  nameLabel.textContent = "Traveller name:";
  const nameValue = document.createElement("span");
  nameValue.className = "user-profile__value";
  nameRow.appendChild(nameLabel);
  nameRow.appendChild(nameValue);
  fields.appendChild(nameRow);

  const homeRow = document.createElement("div");
  homeRow.className = "user-profile__row";
  const homeLabel = document.createElement("span");
  homeLabel.className = "user-profile__label";
  homeLabel.textContent = "Home country:";
  const homeValue = document.createElement("span");
  homeValue.className = "user-profile__value user-profile__home";
  homeRow.appendChild(homeLabel);
  homeRow.appendChild(homeValue);
  fields.appendChild(homeRow);

  const igRow = document.createElement("div");
  igRow.className = "user-profile__row";
  const igLabel = document.createElement("span");
  igLabel.className = "user-profile__label";
  igLabel.textContent = "Instagram:";
  const igValue = document.createElement("span");
  igValue.className = "user-profile__value user-profile__instagram";
  igRow.appendChild(igLabel);
  igRow.appendChild(igValue);
  // Inserted only when set — [hidden] loses to display:inline-flex under display:contents.

  const visitedRow = document.createElement("div");
  visitedRow.className = "user-profile__row";
  const visitedLabel = document.createElement("span");
  visitedLabel.className = "user-profile__label";
  visitedLabel.textContent = "Countries visited:";
  const visitedValue = document.createElement("span");
  visitedValue.className = "user-profile__value";
  visitedRow.appendChild(visitedLabel);
  visitedRow.appendChild(visitedValue);
  fields.appendChild(visitedRow);

  const descLabel = document.createElement("div");
  descLabel.className = "user-profile__label user-profile__desc-label";
  descLabel.textContent = "Traveller description:";
  fields.appendChild(descLabel);

  const descBox = document.createElement("div");
  descBox.className = "user-profile__description";
  fields.appendChild(descBox);

  root.appendChild(fields);

  function render(): void {
    if (state.imageUrl) {
      avatar.src = state.imageUrl;
      avatar.hidden = false;
      avatarWrap.hidden = false;
    } else {
      avatar.removeAttribute("src");
      avatar.hidden = true;
      avatarWrap.hidden = true;
    }

    nameValue.textContent = state.name || "";

    homeValue.replaceChildren();
    const code = (state.homeCountryCode ?? "").trim();
    if (code) {
      const country = countries.find((c) => c.countryCode === code);
      const flag = document.createElement("img");
      flag.className = "user-profile__flag";
      flag.src = `${baseUrl}/assets/images/${code.toLowerCase()}.jpg`;
      flag.alt = country?.name ?? code;
      const nameSpan = document.createElement("span");
      nameSpan.textContent = country?.name ?? code;
      homeValue.appendChild(flag);
      homeValue.appendChild(nameSpan);
    }

    igValue.replaceChildren();
    const ig = (state.instagramUserName ?? "").trim();
    if (ig) {
      const link = document.createElement("a");
      link.className = "user-profile__instagram-link";
      link.href = instagramWebUrl(ig);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", "Open Instagram profile");
      link.appendChild(createInstagramIconSvg());
      const igHandle = document.createElement("span");
      igHandle.className = "user-profile__instagram-handle";
      igHandle.textContent = `@${ig}`;
      link.appendChild(igHandle);
      link.addEventListener("click", (e) => {
        e.preventDefault();
        openInstagramProfile(ig);
      });
      attachTooltip(link, "Open Instagram profile");
      igValue.appendChild(link);
      if (!igRow.isConnected) {
        fields.insertBefore(igRow, visitedRow);
      }
    } else if (igRow.isConnected) {
      igRow.remove();
    }

    visitedValue.textContent = String(state.countriesVisited);

    const desc = (state.description ?? "").trim();
    if (desc) {
      descBox.innerHTML = renderMarkdownHtml(desc);
      descBox.hidden = false;
    } else {
      descBox.replaceChildren();
      descBox.hidden = true;
    }
  }

  render();

  return {
    element: root,
    update(data: Partial<UserProfileData>): void {
      state = { ...state, ...data };
      render();
    },
  };
}
