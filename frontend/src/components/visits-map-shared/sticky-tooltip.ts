/** Mobile-only sticky tooltips: tap to show, auto-fade after hold, dismiss on gesture. */

export const STICKY_TOOLTIP_HOLD_MS = 5000;
export const STICKY_TOOLTIP_CLASS = "visit-map-tooltip--sticky";
export const STICKY_TOOLTIP_FADING_CLASS = "visit-map-tooltip--fading";

/** True when the UI should use tap tooltips instead of hover. */
export function isMapTouchUi(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

export function getAnimationDurationMs(): number {
  if (typeof window === "undefined") return 300;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--animation-duration")
    .trim();
  if (!raw) return 300;
  if (raw.endsWith("ms")) {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 300;
  }
  if (raw.endsWith("s")) {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n * 1000 : 300;
  }
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 300;
}

export interface StickyTooltipController {
  /** Show immediately (content/position already set by caller). Resets the 5s hold. */
  show: () => void;
  /** Fade out using --animation-duration, then hide. */
  dismiss: () => void;
  isVisible: () => boolean;
  dispose: () => void;
}

/**
 * Controls sticky visibility + fade on a tooltip element (svgMap or globe overlay).
 * Caller owns content and positioning.
 */
export function createStickyTooltipController(
  el: HTMLElement
): StickyTooltipController {
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let fadeTimer: ReturnType<typeof setTimeout> | null = null;
  let visible = false;

  const clearTimers = (): void => {
    if (holdTimer != null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (fadeTimer != null) {
      clearTimeout(fadeTimer);
      fadeTimer = null;
    }
  };

  const finishHide = (): void => {
    el.classList.remove(
      STICKY_TOOLTIP_CLASS,
      STICKY_TOOLTIP_FADING_CLASS,
      "svgMap-active"
    );
    el.hidden = true;
    visible = false;
  };

  const dismiss = (): void => {
    if (!visible && !el.classList.contains(STICKY_TOOLTIP_CLASS)) {
      return;
    }
    clearTimers();
    el.classList.add(STICKY_TOOLTIP_FADING_CLASS);
    fadeTimer = setTimeout(finishHide, getAnimationDurationMs());
  };

  const show = (): void => {
    clearTimers();
    el.hidden = false;
    el.classList.remove(STICKY_TOOLTIP_FADING_CLASS);
    el.classList.add(STICKY_TOOLTIP_CLASS, "svgMap-active");
    // Ensure opacity:1 applies before any pending fade class from a prior frame.
    void el.offsetWidth;
    visible = true;
    holdTimer = setTimeout(dismiss, STICKY_TOOLTIP_HOLD_MS);
  };

  return {
    show,
    dismiss,
    isVisible: () => visible,
    dispose: () => {
      clearTimers();
      finishHide();
    },
  };
}
