type ModalCloseReason = "outsideClick" | "closeButton" | "programmatic";

export interface OpenModalOptions {
  title?: string;
  /** When `title` is omitted, sets `aria-label` on the dialog panel for accessibility. */
  ariaLabel?: string;
  body: HTMLElement;
  footer?: HTMLElement;
  /** Omit top border / extra separation above footer (e.g. editor + inline actions). */
  footerPlain?: boolean;
  /** When false, clicking outside won't close. Default true. */
  closeOnOutsideClick?: boolean;
  /** When false, no top-right close button. Default true. */
  showCloseButton?: boolean;
  onClose?: (reason: ModalCloseReason) => void;
}

export interface OpenModalResult {
  overlay: HTMLDivElement;
  close: (reason?: ModalCloseReason) => void;
}

function revealOverlay(overlay: HTMLDivElement): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add("app-modal-overlay--visible"));
  });
}

function closeOverlay(overlay: HTMLDivElement, reason: ModalCloseReason): void {
  if (!overlay.isConnected) return;
  if (overlay.classList.contains("app-modal-overlay--closing")) return;
  overlay.classList.remove("app-modal-overlay--visible");
  overlay.classList.add("app-modal-overlay--closing");
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    overlay.remove();
  };
  overlay.addEventListener(
    "transitionend",
    (e) => {
      if (e.target !== overlay || e.propertyName !== "opacity") return;
      finish();
    },
    { once: true },
  );
  window.setTimeout(finish, 380);
  overlay.dispatchEvent(new CustomEvent("app-modal:close", { detail: { reason } }));
}

export function openModal(options: OpenModalOptions): OpenModalResult {
  const {
    title,
    ariaLabel,
    body,
    footer,
    footerPlain = false,
    closeOnOutsideClick = true,
    showCloseButton = true,
  } = options;

  const overlay = document.createElement("div");
  overlay.className = "app-modal-overlay";
  overlay.setAttribute("role", "presentation");

  const panel = document.createElement("div");
  panel.className = "app-modal-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  if (title) {
    panel.setAttribute("aria-label", title);
  } else if (ariaLabel) {
    panel.setAttribute("aria-label", ariaLabel);
  }

  if (showCloseButton) {
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "app-modal-close";
    closeBtn.textContent = "Close";
    closeBtn.setAttribute("aria-label", "Close dialog");
    closeBtn.addEventListener("click", () => close("closeButton"));
    panel.appendChild(closeBtn);
  }

  if (title) {
    const h = document.createElement("h2");
    h.className = "app-modal-title";
    h.textContent = title;
    panel.appendChild(h);
  }
  if (!showCloseButton) {
    panel.classList.add("app-modal-panel--no-close");
  }

  const content = document.createElement("div");
  content.className = "app-modal-body";
  content.appendChild(body);
  panel.appendChild(content);

  if (footer) {
    const footerWrap = document.createElement("div");
    footerWrap.className = footerPlain ? "app-modal-footer app-modal-footer--plain" : "app-modal-footer";
    footerWrap.appendChild(footer);
    panel.appendChild(footerWrap);
  }

  overlay.appendChild(panel);

  const close = (reason: ModalCloseReason = "programmatic"): void => {
    options.onClose?.(reason);
    closeOverlay(overlay, reason);
  };

  if (closeOnOutsideClick) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close("outsideClick");
    });
  }

  document.body.appendChild(overlay);
  revealOverlay(overlay);
  return { overlay, close };
}

export async function confirmDialog(options: {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const body = document.createElement("div");
    body.className = "app-confirm";
    const p = document.createElement("p");
    p.className = "app-confirm__message";
    p.textContent = options.message;
    body.appendChild(p);

    const footer = document.createElement("div");
    footer.className = "app-confirm__actions";

    const noBtn = document.createElement("button");
    noBtn.type = "button";
    noBtn.className = "app-confirm__btn";
    noBtn.textContent = options.cancelText ?? "No";

    const yesBtn = document.createElement("button");
    yesBtn.type = "button";
    yesBtn.className = "app-confirm__btn app-confirm__btn--primary";
    if (options.danger) yesBtn.classList.add("app-confirm__btn--danger");
    yesBtn.textContent = options.confirmText ?? "Yes";

    footer.appendChild(noBtn);
    footer.appendChild(yesBtn);

    const { close, overlay } = openModal({
      title: options.title ?? "Confirm",
      body,
      footer,
      closeOnOutsideClick: true,
      showCloseButton: false,
      onClose: () => resolve(false),
    });

    const resolveAndClose = (val: boolean): void => {
      resolve(val);
      close("programmatic");
    };

    noBtn.addEventListener("click", () => resolveAndClose(false));
    yesBtn.addEventListener("click", () => resolveAndClose(true));

    // Basic focus handling: focus Yes for destructive actions, otherwise No.
    requestAnimationFrame(() => {
      (options.danger ? yesBtn : noBtn).focus();
    });

    overlay.addEventListener("app-modal:close", () => resolve(false), { once: true });
  });
}

