const TOOLTIP_ID = "app-tooltip";
const SHOW_DELAY_MS = 1000;
const HIDE_DELAY_MS = 80;
const OFFSET_PX = 6;

type Placement = "above" | "below" | "left" | "right";

let globalTooltip: HTMLDivElement | null = null;
let showTimeout: ReturnType<typeof setTimeout> | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;
let currentAnchor: HTMLElement | null = null;

const BEAK_SIZE = 6;
const RADIUS = 4;

function getTooltipElement(): HTMLDivElement {
  if (globalTooltip) return globalTooltip;
  const el = document.createElement("div");
  el.id = TOOLTIP_ID;
  el.className = "tooltip";
  el.setAttribute("role", "tooltip");
  el.hidden = true;
  el.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "tooltip__border");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  svg.appendChild(path);
  el.appendChild(svg);
  const content = document.createElement("span");
  content.className = "tooltip__content";
  el.appendChild(content);
  document.body.appendChild(el);
  globalTooltip = el;
  return el;
}

function updateTooltipBorderPath(tooltip: HTMLDivElement): void {
  const placement = tooltip.getAttribute("data-placement") as Placement | null;
  const w = tooltip.offsetWidth;
  const h = tooltip.offsetHeight;
  const r = RADIUS;
  const b = BEAK_SIZE;
  const svgEl = tooltip.querySelector(".tooltip__border") as SVGSVGElement;
  const pathEl = tooltip.querySelector(".tooltip__border path") as SVGPathElement;
  if (!svgEl || !pathEl || !placement) return;
  const half = w / 2;
  const halfH = h / 2;
  let d: string;
  if (placement === "above") {
    svgEl.setAttribute("viewBox", `0 0 ${w} ${h + b}`);
    d = `M ${r},0 H ${w - r} Q ${w},0 ${w},${r} V ${h - r} Q ${w},${h} ${w - r},${h} H ${half + b} L ${half},${h + b} L ${half - b},${h} H ${r} Q 0,${h} 0,${h - r} V ${r} Q 0,0 ${r},0 Z`;
  } else if (placement === "below") {
    svgEl.setAttribute("viewBox", `0 ${-b} ${w} ${h + b}`);
    d = `M ${half + b},0 H ${w - r} Q ${w},0 ${w},${r} V ${h - r} Q ${w},${h} ${w - r},${h} H ${r} Q 0,${h} 0,${h - r} V ${r} Q 0,0 ${r},0 H ${half - b} L ${half},${-b} L ${half + b},0 Z`;
  } else if (placement === "left") {
    svgEl.setAttribute("viewBox", `0 0 ${w + b} ${h}`);
    d = `M ${r},0 H ${w - r} Q ${w},0 ${w},${r} V ${halfH - b} L ${w + b},${halfH} L ${w},${halfH + b} V ${h - r} Q ${w},${h} ${w - r},${h} H ${r} Q 0,${h} 0,${h - r} V ${r} Q 0,0 ${r},0 Z`;
  } else {
    svgEl.setAttribute("viewBox", `${-b} 0 ${w + b} ${h}`);
    d = `M ${-b},${halfH} L 0,${halfH - b} L 0,${r} Q 0,0 ${r},0 H ${w - r} Q ${w},0 ${w},${r} V ${h - r} Q ${w},${h} ${w - r},${h} H ${r} Q 0,${h} 0,${h - r} V ${halfH + b} L ${-b},${halfH} Z`;
  }
  pathEl.setAttribute("d", d);
}

function clearShowTimeout(): void {
  if (showTimeout != null) {
    clearTimeout(showTimeout);
    showTimeout = null;
  }
}

function clearHideTimeout(): void {
  if (hideTimeout != null) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

function positionTooltip(tooltip: HTMLDivElement, anchor: HTMLElement): Placement {
  const ttRect = tooltip.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const viewport = { w: window.innerWidth, h: window.innerHeight };
  const margin = 8;

  let top: number;
  let left: number;
  let placement: Placement;

  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const preferredLeft = anchorCenterX - ttRect.width / 2;
  left = Math.max(margin, Math.min(viewport.w - ttRect.width - margin, preferredLeft));

  const spaceAbove = anchorRect.top;
  const spaceBelow = viewport.h - anchorRect.bottom;
  const spaceLeft = anchorRect.left;
  const spaceRight = viewport.w - anchorRect.right;

  if (spaceAbove >= ttRect.height + OFFSET_PX) {
    top = anchorRect.top - ttRect.height - OFFSET_PX;
    placement = "above";
  } else if (spaceBelow >= ttRect.height + OFFSET_PX) {
    top = anchorRect.bottom + OFFSET_PX;
    placement = "below";
  } else if (spaceRight >= ttRect.width + OFFSET_PX) {
    top = anchorRect.top + anchorRect.height / 2 - ttRect.height / 2;
    left = anchorRect.right + OFFSET_PX;
    placement = "right";
  } else if (spaceLeft >= ttRect.width + OFFSET_PX) {
    top = anchorRect.top + anchorRect.height / 2 - ttRect.height / 2;
    left = anchorRect.left - ttRect.width - OFFSET_PX;
    placement = "left";
  } else {
    top = anchorRect.top - ttRect.height - OFFSET_PX;
    placement = "above";
  }

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  tooltip.setAttribute("data-placement", placement);
  return placement;
}

function show(anchor: HTMLElement, text: string): void {
  clearHideTimeout();
  if (currentAnchor && currentAnchor !== anchor) {
    currentAnchor.removeAttribute("aria-describedby");
  }
  const tooltip = getTooltipElement();
  const contentEl = tooltip.querySelector(".tooltip__content");
  if (contentEl) contentEl.textContent = text;
  tooltip.removeAttribute("data-placement");
  tooltip.classList.remove("tooltip--visible");
  tooltip.hidden = false;
  tooltip.setAttribute("aria-hidden", "false");
  currentAnchor = anchor;
  anchor.setAttribute("aria-describedby", TOOLTIP_ID);
  requestAnimationFrame(() => {
    positionTooltip(tooltip, anchor);
    updateTooltipBorderPath(tooltip);
    requestAnimationFrame(() => {
      tooltip.classList.add("tooltip--visible");
    });
  });
}

function hide(): void {
  if (hideTimeout != null) return;
  hideTimeout = setTimeout(() => {
    hideTimeout = null;
    const tooltip = getTooltipElement();
    tooltip.hidden = true;
    tooltip.setAttribute("aria-hidden", "true");
    if (currentAnchor) {
      currentAnchor.removeAttribute("aria-describedby");
      currentAnchor = null;
    }
  }, HIDE_DELAY_MS);
}

/**
 * Attaches a custom tooltip to an anchor element. Prefers placement above;
 * if it does not fit in the viewport, places below or on the side.
 * Show after 1s delay on hover/focus, hide on leave/blur. Fades in (opacity 0->1).
 */
export function attachTooltip(anchor: HTMLElement, text: string): () => void {
  const scheduleShow = () => {
    clearShowTimeout();
    showTimeout = setTimeout(() => {
      showTimeout = null;
      show(anchor, text);
    }, SHOW_DELAY_MS);
  };
  const cancelShow = () => {
    clearShowTimeout();
    hide();
  };

  anchor.addEventListener("mouseenter", scheduleShow);
  anchor.addEventListener("mouseleave", cancelShow);
  anchor.addEventListener("focus", scheduleShow);
  anchor.addEventListener("blur", cancelShow);

  return () => {
    clearShowTimeout();
    clearHideTimeout();
    if (currentAnchor === anchor) {
      const tooltip = getTooltipElement();
      tooltip.hidden = true;
      tooltip.setAttribute("aria-hidden", "true");
      anchor.removeAttribute("aria-describedby");
      currentAnchor = null;
    }
    anchor.removeEventListener("mouseenter", scheduleShow);
    anchor.removeEventListener("mouseleave", cancelShow);
    anchor.removeEventListener("focus", scheduleShow);
    anchor.removeEventListener("blur", cancelShow);
  };
}
