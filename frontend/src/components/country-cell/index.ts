export type CountryCellVariant = "default" | "compact";

export interface CountryCellOptions {
  /** When set, show visit time and delete button (edit mode). Ignored when variant is "compact". */
  visitTimeLabel?: string;
  onDelete?: () => void;
  /** "compact" for dropdown list items (thinner, flag + name only). */
  variant?: CountryCellVariant;
}

/**
 * Creates a country cell element: flag on the left, country name on the right.
 * Optionally shows visit time and an X delete button when onDelete is provided.
 * Fixed dimensions for consistent grid layout.
 */
export function createCountryCell(
  countryCode: string,
  countryName: string,
  baseUrl: string,
  options?: CountryCellOptions
): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "country-cell";
  const isCompact = options?.variant === "compact";
  if (isCompact) {
    cell.classList.add("country-cell--compact");
  } else if (options?.onDelete != null) {
    cell.classList.add("country-cell--edit");
  }

  const img = document.createElement("img");
  img.src = `${baseUrl}/assets/images/${countryCode.toLowerCase()}.jpg`;
  img.alt = countryName;
  cell.appendChild(img);

  if (!isCompact && options?.visitTimeLabel != null) {
    const main = document.createElement("div");
    main.className = "country-cell__main";
    const textWrap = document.createElement("span");
    textWrap.className = "country-cell__name";
    textWrap.textContent = countryName;
    main.appendChild(textWrap);
    const timeSpan = document.createElement("span");
    timeSpan.className = "country-cell__time";
    timeSpan.textContent = options.visitTimeLabel;
    main.appendChild(timeSpan);
    cell.appendChild(main);
  } else {
    const textWrap = document.createElement("span");
    textWrap.className = "country-cell__name";
    textWrap.textContent = countryName;
    cell.appendChild(textWrap);
  }

  if (!isCompact && options?.onDelete != null) {
    const xBtn = document.createElement("button");
    xBtn.type = "button";
    xBtn.className = "country-cell__delete";
    xBtn.textContent = "X";
    xBtn.setAttribute("aria-label", "Delete visit");
    xBtn.addEventListener("click", () => options.onDelete!());
    cell.appendChild(xBtn);
  }

  return cell;
}
