import { openModal } from "Components/modal";
import { errorToast } from "Components/toast";
import { createCountryDropdown } from "Components/country-dropdown";
import { createCharCountLabel } from "Components/char-count-label";
import { ApiError } from "../../api";
import type { Country } from "../../types/country";
import type { UserSettings } from "../../types/settings";

const MAX_DESCRIPTION_LENGTH = 1000;

const DESCRIPTION_PLACEHOLDER =
  "Optional traveller description. Markdown formatting supported!";

type SettingsApi = {
  getSettings(): Promise<UserSettings>;
  updateSettings(settings: UserSettings): Promise<UserSettings>;
};

export interface OpenUserSettingsDialogOptions {
  api: SettingsApi;
  countries: Country[];
  baseUrl: string;
  onUnauthorized?: () => void;
  onSaved?: (settings: UserSettings) => void;
}

function truncateDescription(value: string): string {
  if (value.length <= MAX_DESCRIPTION_LENGTH) {
    return value;
  }
  return value.slice(0, MAX_DESCRIPTION_LENGTH);
}

function buildPutBody(
  homeCountryCode: string,
  description: string,
  sharing: UserSettings["sharing"],
): UserSettings {
  const settings: UserSettings = { sharing };
  const home = homeCountryCode.trim();
  if (home) {
    settings.homeCountryCode = home;
  }
  const desc = description.trim();
  if (desc) {
    settings.description = desc;
  }
  return settings;
}

/**
 * Opens the user settings dialog (GET /settings on open, PUT on Save).
 * See frontend/spec/components/user-settings-dialog.md.
 */
export function openUserSettingsDialog(
  options: OpenUserSettingsDialogOptions,
): void {
  const { api, countries, baseUrl, onUnauthorized, onSaved } = options;

  const body = document.createElement("div");
  body.className = "user-settings-dialog";

  const intro = document.createElement("p");
  intro.className = "user-settings-dialog__intro";
  intro.textContent =
    "Update your profile details and choose what visitors see on your Share URL.";
  body.appendChild(intro);

  let homeCountryCode = "";
  const homeLabel = document.createElement("div");
  homeLabel.className = "user-settings-dialog__field-label";
  homeLabel.textContent = "Home country";
  body.appendChild(homeLabel);

  const homeDropdown = createCountryDropdown({
    countries,
    baseUrl,
    selectedCountryCode: "",
    clearable: true,
    onSelect: (code) => {
      homeCountryCode = code;
    },
  });
  homeDropdown.element.classList.add("user-settings-dialog__country");
  body.appendChild(homeDropdown.element);

  const descFieldId = `user-settings-description-${Math.random().toString(36).slice(2, 9)}`;
  const descCount = createCharCountLabel({
    title: "Free-form traveller description",
    maxLength: MAX_DESCRIPTION_LENGTH,
    htmlFor: descFieldId,
    className: "user-settings-dialog__field-label",
  });
  body.appendChild(descCount.element);

  const descInput = document.createElement("textarea");
  descInput.id = descFieldId;
  descInput.className = "user-settings-dialog__description";
  descInput.rows = 4;
  descInput.maxLength = MAX_DESCRIPTION_LENGTH;
  descInput.placeholder = DESCRIPTION_PLACEHOLDER;
  descInput.disabled = true;
  body.appendChild(descInput);

  const descHint = document.createElement("p");
  descHint.className = "user-settings-dialog__hint";
  descHint.textContent = "Markdown formatting supported.";
  body.appendChild(descHint);

  descInput.addEventListener("input", () => {
    const truncated = truncateDescription(descInput.value);
    if (truncated !== descInput.value) {
      descInput.value = truncated;
    }
    descCount.setCount(descInput.value.length);
  });

  const mediaLabel = document.createElement("label");
  mediaLabel.className = "user-settings-dialog__row";
  const mediaCb = document.createElement("input");
  mediaCb.type = "checkbox";
  mediaCb.className = "user-settings-dialog__checkbox";
  mediaCb.disabled = true;
  const mediaText = document.createElement("span");
  mediaText.className = "user-settings-dialog__label-text";
  mediaText.textContent = "Share media URLs on shared visit lists";
  mediaLabel.appendChild(mediaCb);
  mediaLabel.appendChild(mediaText);
  body.appendChild(mediaLabel);

  const notesLabel = document.createElement("label");
  notesLabel.className = "user-settings-dialog__row";
  const notesCb = document.createElement("input");
  notesCb.type = "checkbox";
  notesCb.className = "user-settings-dialog__checkbox";
  notesCb.disabled = true;
  const notesText = document.createElement("span");
  notesText.className = "user-settings-dialog__label-text";
  notesText.textContent = "Share notes on shared visit lists";
  notesLabel.appendChild(notesCb);
  notesLabel.appendChild(notesText);
  body.appendChild(notesLabel);

  const tagsLabel = document.createElement("label");
  tagsLabel.className = "user-settings-dialog__row";
  const tagsCb = document.createElement("input");
  tagsCb.type = "checkbox";
  tagsCb.className = "user-settings-dialog__checkbox";
  tagsCb.disabled = true;
  const tagsText = document.createElement("span");
  tagsText.className = "user-settings-dialog__label-text";
  tagsText.textContent = "Share tags on shared visit lists";
  tagsLabel.appendChild(tagsCb);
  tagsLabel.appendChild(tagsText);
  body.appendChild(tagsLabel);

  const saveRow = document.createElement("div");
  saveRow.className = "user-settings-dialog__save-row";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "user-settings-dialog__save-btn";
  saveBtn.textContent = "Save settings";
  saveBtn.disabled = true;
  saveRow.appendChild(saveBtn);
  body.appendChild(saveRow);

  const footer = document.createElement("div");
  footer.className = "app-confirm__actions";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "app-confirm__btn app-confirm__btn--secondary";
  closeBtn.textContent = "Close without saving";
  closeBtn.setAttribute("aria-label", "Close without saving");
  footer.appendChild(closeBtn);

  let closeModal: (() => void) | null = null;
  let saving = false;

  const setControlsEnabled = (enabled: boolean): void => {
    mediaCb.disabled = !enabled;
    notesCb.disabled = !enabled;
    tagsCb.disabled = !enabled;
    descInput.disabled = !enabled;
    const homeInput = homeDropdown.element.querySelector(
      "input",
    ) as HTMLInputElement | null;
    if (homeInput) {
      homeInput.disabled = !enabled;
    }
    saveBtn.disabled = !enabled || saving;
  };

  const handleUnauthorized = (): void => {
    onUnauthorized?.();
    errorToast("Session expired");
  };

  const { close } = openModal({
    title: "Settings",
    body,
    footer,
    showCloseButton: false,
    footerPlain: true,
    closeOnOutsideClick: true,
  });
  closeModal = () => close("programmatic");
  closeBtn.addEventListener("click", () => close("closeButton"));

  saveBtn.addEventListener("click", async () => {
    if (saving) return;
    saving = true;
    setControlsEnabled(false);
    const settings = buildPutBody(homeCountryCode, descInput.value, {
      shareMediaUrl: mediaCb.checked,
      shareNotes: notesCb.checked,
      shareTags: tagsCb.checked,
    });
    try {
      const saved = await api.updateSettings(settings);
      onSaved?.(saved);
      closeModal?.();
    } catch (err) {
      console.error("Failed to update settings", err);
      if (err instanceof ApiError && err.responseCode === 401) {
        handleUnauthorized();
        closeModal?.();
      } else {
        errorToast(err instanceof Error ? err.message : "Failed to save settings");
        saving = false;
        setControlsEnabled(true);
      }
    }
  });

  void (async () => {
    try {
      const settings = await api.getSettings();
      homeCountryCode = settings.homeCountryCode ?? "";
      homeDropdown.setSelected(homeCountryCode);
      descInput.value = truncateDescription(settings.description ?? "");
      descCount.setCount(descInput.value.length);
      mediaCb.checked = Boolean(settings?.sharing?.shareMediaUrl);
      notesCb.checked = Boolean(settings?.sharing?.shareNotes);
      tagsCb.checked = Boolean(settings?.sharing?.shareTags);
      setControlsEnabled(true);
    } catch (err) {
      console.error("Failed to load settings", err);
      if (err instanceof ApiError && err.responseCode === 401) {
        handleUnauthorized();
        closeModal?.();
        return;
      }
      errorToast(err instanceof Error ? err.message : "Failed to load settings");
      closeModal?.();
    }
  })();
}
