import DOMPurify from "dompurify";
import { marked } from "marked";
import type { CountryVisit } from "../../types/visit";

/** Max fraction of viewport height the whole visit-info tooltip may occupy. */
const MAX_VIEWPORT_HEIGHT_FRACTION = 0.9;

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNotesHtml(notes: string): string {
  const raw = marked.parse(notes, { async: false }) as string;
  return DOMPurify.sanitize(raw);
}

/**
 * After visit-info HTML is inserted into the tooltip shell, shrink the Notes
 * area if needed so the tooltip fits within 90% of the viewport height.
 */
export function fitCountryVisitInfoTooltipToViewport(
  tooltipEl: HTMLElement,
): void {
  const notes = tooltipEl.querySelector(
    ".country-visit-info-tooltip__notes",
  ) as HTMLElement | null;
  if (!notes) {
    return;
  }

  notes.style.maxHeight = "";
  const maxTooltipPx = window.innerHeight * MAX_VIEWPORT_HEIGHT_FRACTION;
  const tooltipH = tooltipEl.offsetHeight;
  if (tooltipH <= maxTooltipPx) {
    return;
  }

  const excess = tooltipH - maxTooltipPx;
  const nextMax = Math.max(0, notes.offsetHeight - excess);
  notes.style.maxHeight = `${nextMax}px`;
}

/**
 * Hover content for by-continent and timeline visit cards
 * (see country-visit-info-tooltip.md).
 */
export function buildCountryVisitInfoTooltipHtml(
  visit: CountryVisit,
): string | null {
  const notes = (visit.notes ?? "").trim();
  const hasNotes = notes.length > 0;
  const tags = visit.tags ?? [];
  const hasTags = tags.length > 0;
  const hasMedia = Boolean(visit.mediaUrl);

  if (!hasNotes && !hasTags && !hasMedia) {
    return null;
  }

  const parts: string[] = [];

  if (hasNotes) {
    parts.push(
      `<div class="country-visit-info-tooltip__notes">${renderNotesHtml(notes)}</div>`,
    );
  }

  if (hasTags) {
    const pillsHtml = tags
      .map(
        (t) =>
          `<span class="tag-editor__pill">` +
          `<span class="tag-editor__pill-label">${escapeHtmlText(t)}</span></span>`,
      )
      .join("");
    parts.push(
      `<div class="tag-editor__pills country-visit-info-tooltip__pills">${pillsHtml}</div>`,
    );
  }

  if (hasMedia) {
    parts.push(
      `<p class="country-visit-info-tooltip__media-hint">Click to view attached media</p>`,
    );
  }

  return `<div class="country-visit-info-tooltip">${parts.join("")}</div>`;
}
