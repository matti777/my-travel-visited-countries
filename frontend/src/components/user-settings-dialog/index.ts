import { openModal } from "Components/modal";
import { errorToast } from "Components/toast";
import { ApiError } from "../../api";
import type { UserSettings } from "../../types/settings";

type SettingsApi = {
  getSettings(): Promise<UserSettings>;
  updateSettings(settings: UserSettings): Promise<UserSettings>;
};

export interface OpenUserSettingsDialogOptions {
  api: SettingsApi;
  onUnauthorized?: () => void;
}

/**
 * Opens the user settings dialog (GET /settings on open, PUT on Save).
 * See frontend/spec/user-settings-dialog.md.
 */
export function openUserSettingsDialog(
  options: OpenUserSettingsDialogOptions,
): void {
  const { api, onUnauthorized } = options;

  const body = document.createElement("div");
  body.className = "user-settings-dialog";

  const intro = document.createElement("p");
  intro.className = "user-settings-dialog__intro";
  intro.textContent =
    "Choose what visitors see when they open your Share URL.";
  body.appendChild(intro);

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
    const settings: UserSettings = {
      sharing: {
        shareMediaUrl: mediaCb.checked,
        shareNotes: notesCb.checked,
        shareTags: tagsCb.checked,
      },
    };
    try {
      await api.updateSettings(settings);
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
