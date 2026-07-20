import DOMPurify from "dompurify";
import { marked } from "marked";
import type { Country } from "../../types/country";

export interface UserProfileData {
  name: string;
  imageUrl?: string;
  homeCountryCode?: string;
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

/**
 * Read-only traveller profile. See frontend/spec/user-profile-component.md.
 */
export function createUserProfile(options: CreateUserProfileOptions): UserProfileHandle {
  const { countries, baseUrl } = options;
  let state: UserProfileData = {
    name: options.name,
    imageUrl: options.imageUrl,
    homeCountryCode: options.homeCountryCode,
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
