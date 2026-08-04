import { attachTooltip } from "Components/tooltip";

export interface DeleteButtonOptions {
  /** Extra class names (e.g. site-specific layout hooks). */
  className?: string;
  ariaLabel: string;
  tooltip: string;
  onClick: (e: MouseEvent) => void;
}

function createTrashIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("delete-button__icon");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

/**
 * Compact delete control: red trash-can icon + tooltip.
 * See frontend/spec/components/delete-button.md.
 */
export function createDeleteButton(
  options: DeleteButtonOptions,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "delete-button";
  if (options.className) {
    btn.classList.add(...options.className.split(/\s+/).filter(Boolean));
  }
  btn.setAttribute("aria-label", options.ariaLabel);
  btn.appendChild(createTrashIcon());
  btn.addEventListener("click", (e) => options.onClick(e));
  attachTooltip(btn, options.tooltip);
  return btn;
}
