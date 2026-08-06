export interface ModalStickyFooterButtonConfig {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export interface CreateModalStickyFooterOptions {
  /** Left action (typically Save). */
  primary: ModalStickyFooterButtonConfig;
  /** Right action (typically Close without saving). */
  secondary: ModalStickyFooterButtonConfig;
}

export interface ModalStickyFooter {
  element: HTMLDivElement;
  primaryButton: HTMLButtonElement;
  secondaryButton: HTMLButtonElement;
}

/**
 * Sticky dialog action row: primary left, secondary right, content-width buttons.
 * Pass `element` to `openModal({ footer, footerPlain: true })`.
 * See frontend/spec/components/modal-sticky-footer.md.
 */
export function createModalStickyFooter(
  options: CreateModalStickyFooterOptions,
): ModalStickyFooter {
  const root = document.createElement("div");
  root.className = "app-confirm__actions modal-sticky-footer";

  const primaryButton = document.createElement("button");
  primaryButton.type = "button";
  primaryButton.className = "modal-sticky-footer__btn primary";
  primaryButton.textContent = options.primary.label;
  primaryButton.disabled = options.primary.disabled ?? false;
  if (options.primary.ariaLabel) {
    primaryButton.setAttribute("aria-label", options.primary.ariaLabel);
  }
  primaryButton.addEventListener("click", () => options.primary.onClick());
  root.appendChild(primaryButton);

  const secondaryButton = document.createElement("button");
  secondaryButton.type = "button";
  secondaryButton.className = "modal-sticky-footer__btn app-confirm__btn secondary";
  secondaryButton.textContent = options.secondary.label;
  secondaryButton.disabled = options.secondary.disabled ?? false;
  secondaryButton.setAttribute(
    "aria-label",
    options.secondary.ariaLabel ?? options.secondary.label,
  );
  secondaryButton.addEventListener("click", () => options.secondary.onClick());
  root.appendChild(secondaryButton);

  return { element: root, primaryButton, secondaryButton };
}
