import { createDeleteButton } from "Components/delete-button";
import { attachTooltip } from "Components/tooltip";

export type CountryCellVariant = "default" | "compact";

const SCORE_TOOLTIP_VISIT =
  "Visit rating from 1 (poor) to 100 (excellent).";
const SCORE_TOOLTIP_AVERAGE =
  "Average rating of visits to this country (1–100).";

export interface CountryCellOptions {
  /** When set, show visit time and delete button (edit mode). Ignored when variant is "compact". */
  visitTimeLabel?: string;
  onDelete?: () => void;
  /** "compact" for dropdown list items (thinner, flag + name only). */
  variant?: CountryCellVariant;
  /**
   * Visit score 1–100 shown on the right (non-edit). Color lerps red→yellow→green.
   * Omit in edit mode (delete stays alone on the right).
   */
  score?: number;
  /** When true, score is a country average (Alphabetical); affects tooltip copy. */
  scoreIsAverage?: boolean;
}

/** RGB lerp: 1 red → 50 yellow → 100 green (alpha 0.4). */
export function scoreToColor(score: number): string {
  const s = Math.max(1, Math.min(100, Math.round(score)));
  const red = { r: 220, g: 50, b: 50 };
  const yellow = { r: 220, g: 190, b: 40 };
  const green = { r: 40, g: 170, b: 70 };
  let from = red;
  let to = yellow;
  let t: number;
  if (s <= 50) {
    t = (s - 1) / 49;
  } else {
    from = yellow;
    to = green;
    t = (s - 50) / 50;
  }
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgba(${r}, ${g}, ${b}, 0.4)`;
}

function createScoreStarIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("country-cell__score-star");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M12 2.5l2.9 6.1 6.6.7-5 4.6 1.4 6.5L12 16.9 6.1 20.4 7.5 13.9l-5-4.6 6.6-.7L12 2.5z",
  );
  path.setAttribute("fill", "currentColor");
  svg.appendChild(path);
  return svg;
}

/**
 * Creates a country cell element: flag on the left, country name on the right.
 * Optionally shows visit time and a trash delete button when onDelete is provided.
 * Optionally shows a color-coded score on the right when not in edit mode.
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

  if (!isCompact && options?.onDelete == null && options?.score != null) {
    const scoreEl = document.createElement("span");
    scoreEl.className = "country-cell__score";
    scoreEl.setAttribute("tabindex", "0");
    scoreEl.setAttribute(
      "aria-label",
      options.scoreIsAverage
        ? `Average visit score ${Math.round(options.score)}`
        : `Visit score ${Math.round(options.score)}`,
    );
    const starEl = createScoreStarIcon();
    starEl.style.color = "rgba(230, 194, 0, 0.4)";
    scoreEl.appendChild(starEl);
    const valueEl = document.createElement("span");
    valueEl.className = "country-cell__score-value";
    valueEl.textContent = String(Math.round(options.score));
    valueEl.style.color = scoreToColor(options.score);
    scoreEl.appendChild(valueEl);
    const tip = options.scoreIsAverage ? SCORE_TOOLTIP_AVERAGE : SCORE_TOOLTIP_VISIT;
    attachTooltip(scoreEl, tip, { allowTouchTap: true });
    scoreEl.addEventListener("mouseenter", (e) => e.stopPropagation());
    scoreEl.addEventListener("mouseleave", (e) => e.stopPropagation());
    scoreEl.addEventListener("click", (e) => e.stopPropagation());
    cell.appendChild(scoreEl);
  }

  if (!isCompact && options?.onDelete != null) {
    const deleteBtn = createDeleteButton({
      className: "country-cell__delete",
      ariaLabel: "Delete visit",
      tooltip: "Click to delete this visit",
      onClick: () => options.onDelete!(),
    });
    cell.appendChild(deleteBtn);
  }

  return cell;
}

