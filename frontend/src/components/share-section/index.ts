import { errorToast, successToast } from "Components/toast";
import { attachTooltip } from "Components/tooltip";
import type { Country } from "../../types/country";
import type { CountryVisit } from "../../types/visit";
import {
  computeVisitStatistics,
  getMostRecentVisitedCountries,
} from "../../utils/visit-statistics";
import { renderShareImage } from "./share-image";

const COPY_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

export interface CreateShareSectionOptions {
  shareToken: string | null;
  visits: CountryVisit[];
  countries: Country[];
}

function buildShareUrl(shareToken: string): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";
  return `${window.location.origin}${base}/share/${encodeURIComponent(shareToken)}`;
}

/**
 * Creates the Share section: Share URL, Instagram share image, Copy controls.
 */
export function createShareSection(options: CreateShareSectionOptions): HTMLElement {
  const { shareToken, visits, countries } = options;
  const section = document.createElement("section");
  section.className = "app-section share-section";
  section.dataset.shareSection = "true";

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
    } catch (err) {
      console.error("Could not copy share URL:", err);
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

  appendInstagramShareBlock(section, visits, countries);

  return section;
}

function appendInstagramShareBlock(
  section: HTMLElement,
  visits: CountryVisit[],
  countries: Country[],
): void {
  const block = document.createElement("div");
  block.className = "share-section__ig";

  const igText = document.createElement("div");
  igText.className = "share-section__ig-text";

  const igTitle = document.createElement("h3");
  igTitle.className = "share-section__ig-title";
  igTitle.textContent = "Share on Instagram";
  igText.appendChild(igTitle);

  const igDesc = document.createElement("p");
  igDesc.className = "share-section__ig-desc";
  igDesc.textContent =
    "Create a portrait image of your travel statistics to share on Instagram. " +
    "The image uses the same continent breakdown as the Statistics tab.";
  igText.appendChild(igDesc);
  block.appendChild(igText);

  const actionSlot = document.createElement("div");
  actionSlot.className = "share-section__ig-actions";
  block.appendChild(actionSlot);

  let pngBlob: Blob | null = null;
  let objectUrl: string | null = null;

  const createBtn = document.createElement("button");
  createBtn.type = "button";
  createBtn.className = "share-section__ig-create-btn primary";
  createBtn.textContent = "Create Instagram image";
  attachTooltip(createBtn, "Generate a shareable Instagram image");

  const showCreateButton = (): void => {
    actionSlot.replaceChildren(createBtn);
  };

  const showPreview = (url: string): void => {
    const frame = document.createElement("div");
    frame.className = "share-section__ig-frame";

    const img = document.createElement("img");
    img.className = "share-section__ig-image";
    img.src = url;
    img.alt = "Instagram share image of visited country statistics";
    frame.appendChild(img);

    const copyImageBtn = document.createElement("button");
    copyImageBtn.type = "button";
    copyImageBtn.className = "share-section__copy-btn share-section__ig-copy-btn";
    copyImageBtn.innerHTML = COPY_ICON_SVG;
    copyImageBtn.appendChild(document.createTextNode(" Copy"));
    attachTooltip(copyImageBtn, "Copy image to clipboard");
    copyImageBtn.addEventListener("click", async () => {
      if (!pngBlob) return;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": pngBlob }),
        ]);
        successToast("The image was copied to the clipboard");
      } catch (err) {
        console.error("Could not copy share image:", err);
        errorToast("Could not copy image to clipboard");
      }
    });

    actionSlot.replaceChildren(frame, copyImageBtn);
  };

  createBtn.addEventListener("click", async () => {
    createBtn.disabled = true;
    createBtn.textContent = "Creating…";
    try {
      const stats = computeVisitStatistics(visits, countries);
      const recentCountries =
        stats.uniqueVisitedCount >= 1
          ? getMostRecentVisitedCountries(visits, countries, 7)
          : [];
      const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";
      const result = await renderShareImage({
        stats,
        recentCountries,
        baseUrl,
      });
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      objectUrl = result.objectUrl;
      pngBlob = result.pngBlob;
      showPreview(result.objectUrl);
    } catch (err) {
      console.error("Failed to create Instagram share image:", err);
      errorToast(
        err instanceof Error ? err.message : "Failed to create Instagram image",
      );
      createBtn.disabled = false;
      createBtn.textContent = "Create Instagram image";
      showCreateButton();
    }
  });

  showCreateButton();
  section.appendChild(block);
}
