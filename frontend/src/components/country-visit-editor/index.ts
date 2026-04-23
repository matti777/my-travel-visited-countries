import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { errorToast } from "Components/toast";
import { createCountryDropdown } from "Components/country-dropdown";
import { createTagEditor } from "Components/tag-editor";
import type { Country } from "../../types/country";

const VISIT_DATE_MIN = "1900-01-01";
const MIN_DATE = new Date(1900, 0, 1);

/** Parse YYYY-MM-DD to Date at local midnight (for flatpickr). */
function parseIsoToLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isMediaUrlValid(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  try {
    const u = new URL(trimmed);
    const scheme = u.protocol.replace(/:$/, "").toLowerCase();
    return scheme === "http" || scheme === "https";
  } catch {
    return false;
  }
}

function isVisitDateValid(isoDate: string | null): boolean {
  if (!isoDate) return false;
  const d = new Date(isoDate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  const min = new Date(VISIT_DATE_MIN + "T00:00:00Z").getTime();
  const now = new Date();
  const max = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const t = d.getTime();
  return t >= min && t <= max;
}

export interface CountryVisitEditorSubmitPayload {
  countryCode: string;
  isoDate: string;
  mediaUrl?: string;
  tags: string[];
}

export interface CountryVisitEditorOptions {
  countries: Country[];
  baseUrl: string;
  /** Section heading; default "Add a visit to a country". */
  title?: string;
  selectedCountryCode: string;
  onSelectCountry: (code: string) => void;
  formVisitDate: string | null;
  onFormVisitDateChange: (value: string | null) => void;
  formMediaUrl: string;
  onFormMediaUrlChange: (value: string) => void;
  onSubmit: (payload: CountryVisitEditorSubmitPayload) => Promise<void>;
}

/**
 * Country visit editor: country dropdown, visit date (flatpickr), optional media URL, tags, submit.
 * Use a thin border via `.country-visit-editor` in CSS.
 */
export function createCountryVisitEditor(options: CountryVisitEditorOptions): HTMLElement {
  const {
    countries: countriesList,
    baseUrl,
    title = "Add a visit to a country",
    selectedCountryCode,
    onSelectCountry,
    formVisitDate,
    onFormVisitDateChange,
    formMediaUrl,
    onFormMediaUrlChange,
    onSubmit,
  } = options;
  const today = new Date();

  const addSection = document.createElement("section");
  addSection.className = "app-section country-visit-editor";
  const addTitle = document.createElement("h2");
  addTitle.textContent = title;
  addSection.appendChild(addTitle);

  const form = document.createElement("form");
  form.className = "add-visit-form";
  form.addEventListener("submit", (e) => e.preventDefault());

  const row = document.createElement("div");
  row.className = "add-visit-form__row";
  row.appendChild(
    createCountryDropdown({
      countries: countriesList,
      baseUrl,
      selectedCountryCode,
      onSelect: onSelectCountry,
    }),
  );
  const visitTimeLabel = document.createElement("span");
  visitTimeLabel.className = "add-visit-form__visit-time-label";
  visitTimeLabel.textContent = "Visit date";
  row.appendChild(visitTimeLabel);
  const dateInput = document.createElement("input");
  dateInput.type = "text";
  dateInput.placeholder = "Enter visit date";
  dateInput.name = "visitDate";
  dateInput.className = "add-visit-form__date-input";
  dateInput.autocomplete = "off";
  row.appendChild(dateInput);
  form.appendChild(row);
  const visitTimeHint = document.createElement("p");
  visitTimeHint.className = "add-visit-form__visit-time-hint";
  visitTimeHint.textContent = "Visit date is required and must be between Jan 1, 1900 and today.";
  form.appendChild(visitTimeHint);

  const mediaUrlRow = document.createElement("div");
  mediaUrlRow.className = "add-visit-form__row";
  const mediaUrlInput = document.createElement("input");
  mediaUrlInput.type = "text";
  mediaUrlInput.placeholder = "Optional media URL";
  mediaUrlInput.name = "mediaUrl";
  mediaUrlInput.className = "add-visit-form__media-url";
  mediaUrlInput.autocomplete = "off";
  mediaUrlInput.value = formMediaUrl;
  mediaUrlRow.appendChild(mediaUrlInput);
  form.appendChild(mediaUrlRow);
  const mediaUrlHint = document.createElement("p");
  mediaUrlHint.className = "add-visit-form__media-url-hint";
  mediaUrlHint.textContent = "You can attach a link to media such as a picture collection or video from your trip.";
  form.appendChild(mediaUrlHint);

  const tagEditor = createTagEditor();
  const tagEditorWrap = document.createElement("div");
  tagEditorWrap.className = "add-visit-form__tag-editor-wrap";
  tagEditorWrap.appendChild(tagEditor.element);
  form.appendChild(tagEditorWrap);

  const addBtnRow = document.createElement("div");
  addBtnRow.className = "add-visit-form__add-row";
  const addBtn = document.createElement("button");
  addBtn.type = "submit";
  addBtn.textContent = "Add visit";
  addBtn.className = "add-visit-form__add-btn";
  addBtn.disabled = true;
  addBtnRow.appendChild(addBtn);
  form.appendChild(addBtnRow);

  function updateValidationUI(): void {
    const dateValid = isVisitDateValid(formVisitDate);
    const mediaUrlValid = isMediaUrlValid(mediaUrlInput.value);
    dateInput.classList.toggle("invalid", formVisitDate != null && !dateValid);
    mediaUrlInput.classList.toggle("invalid", mediaUrlInput.value.trim() !== "" && !mediaUrlValid);
    addBtn.disabled = !(selectedCountryCode && dateValid && mediaUrlValid);
  }

  mediaUrlInput.addEventListener("input", () => {
    onFormMediaUrlChange(mediaUrlInput.value);
    updateValidationUI();
  });
  mediaUrlInput.addEventListener("blur", updateValidationUI);

  const defaultDate = formVisitDate ? parseIsoToLocalDate(formVisitDate) : today;
  const fp = flatpickr(dateInput, {
    allowInput: true,
    dateFormat: "M j, Y",
    defaultDate,
    minDate: MIN_DATE,
    maxDate: today,
    disable: [],
    onChange: (selectedDates) => {
      const d = selectedDates[0];
      if (d) {
        const iso =
          d.getFullYear() +
          "-" +
          String(d.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(d.getDate()).padStart(2, "0");
        onFormVisitDateChange(iso);
      } else {
        onFormVisitDateChange(null);
      }
      updateValidationUI();
    },
  });

  fp.setDate(defaultDate, false);
  dateInput.value = fp.input.value ?? "";

  updateValidationUI();

  addBtn.addEventListener("click", async () => {
    if (!selectedCountryCode) {
      errorToast("Please select a country");
      return;
    }
    const isoDate = formVisitDate;
    if (!isoDate || !isVisitDateValid(isoDate)) {
      errorToast("Please select a valid visit date");
      return;
    }
    const mediaUrl = mediaUrlInput.value.trim() || undefined;
    await onSubmit({
      countryCode: selectedCountryCode,
      isoDate,
      mediaUrl,
      tags: tagEditor.getTags(),
    });
  });

  addSection.appendChild(form);
  return addSection;
}
