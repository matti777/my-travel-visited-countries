import { errorToast, successToast } from "Components/toast";
import { attachTooltip } from "Components/tooltip";

const COPY_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

function buildShareUrl(shareToken: string): string {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  return `${window.location.origin}${path}#s=${shareToken}`;
}

/**
 * Creates the Share section: read-only Share URL input, Copy button, and explanatory text.
 */
export function createShareSection(shareToken: string | null): HTMLElement {
  const section = document.createElement("section");
  section.className = "app-section share-section";

  const title = document.createElement("h2");
  title.textContent = "Sharing";
  section.appendChild(title);

  const row = document.createElement("div");
  row.className = "share-section__row";

  const input = document.createElement("input");
  input.type = "text";
  input.readOnly = true;
  input.className = "share-section__url-input";
  input.placeholder = shareToken ? "" : "Loading...";
  if (shareToken) {
    input.value = buildShareUrl(shareToken);
  }
  row.appendChild(input);

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "share-section__copy-btn";
  copyBtn.innerHTML = COPY_ICON_SVG;
  copyBtn.appendChild(document.createTextNode(" Copy"));
  copyBtn.disabled = !shareToken;
  attachTooltip(copyBtn, "Copy Share URL");
  copyBtn.addEventListener("click", async () => {
    if (!shareToken) return;
    const shareUrl = buildShareUrl(shareToken);
    try {
      await navigator.clipboard.writeText(shareUrl);
      successToast("The Share URL was copied to the clipboard");
    } catch {
      errorToast("Could not copy to clipboard");
    }
  });
  row.appendChild(copyBtn);

  section.appendChild(row);

  const explanation = document.createElement("p");
  explanation.className = "share-section__explanation";
  explanation.textContent =
    "This Share URL is permanent and can be shared with friends so they can see your country list. Pressing the Copy button copies the URL to your system clipboard.";
  section.appendChild(explanation);

  return section;
}
