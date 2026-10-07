import { errorToast, successToast } from "Components/toast";
import { attachTooltip } from "Components/tooltip";
import type { Country } from "../../types/country";
import type { CountryVisit, WishListCountry } from "../../types/visit";
import { topCountriesByAverageScore } from "../../utils/visit-averages";
import {
  computeVisitStatistics,
  getMostRecentVisitedCountries,
  mostVisitedCountries,
  visitsPerContinent,
} from "../../utils/visit-statistics";
import {
  buildAvailableModes,
  buildWishListShareRows,
  countryNameFor,
} from "./share-modes";
import {
  renderShareImage,
  type ShareImageMode,
} from "./share-image";

export { buildAvailableModes } from "./share-modes";

const COPY_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

const MODE_LABELS: Record<ShareImageMode, string> = {
  statistics: "Statistics",
  favourite: "Favourite countries",
  mostVisited: "Most visited",
  wishList: "Wish List",
};

export interface CreateShareSectionOptions {
  shareToken: string | null;
  visits: CountryVisit[];
  countries: Country[];
  wishList?: WishListCountry[];
}

export interface ShareSectionHandle {
  element: HTMLElement;
  updateData(options: {
    visits: CountryVisit[];
    countries: Country[];
    shareToken?: string | null;
  }): void;
  updateWishList(wishList: WishListCountry[]): void;
  dispose(): void;
}

const shareSectionHandles = new WeakMap<HTMLElement, ShareSectionHandle>();

export function getShareSectionHandle(
  element: HTMLElement,
): ShareSectionHandle | undefined {
  return shareSectionHandles.get(element);
}

function buildShareUrl(shareToken: string): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";
  return `${window.location.origin}${base}/share/${encodeURIComponent(shareToken)}`;
}

type DeferHandle = number | ReturnType<typeof setTimeout>;

function scheduleDeferred(callback: () => void): DeferHandle {
  if (typeof requestIdleCallback !== "undefined") {
    return requestIdleCallback(callback, { timeout: 500 });
  }
  return setTimeout(callback, 0);
}

function cancelDeferred(handle: DeferHandle | null): void {
  if (handle == null) return;
  if (typeof cancelIdleCallback !== "undefined" && typeof handle === "number") {
    cancelIdleCallback(handle);
  } else {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  }
}

/**
 * Creates the Share section: Share URL, Instagram share image, Copy controls.
 */
export function createShareSection(
  options: CreateShareSectionOptions,
): ShareSectionHandle {
  const section = document.createElement("section");
  section.className = "app-section share-section";
  section.dataset.shareSection = "true";

  let shareToken = options.shareToken;
  let visits = options.visits;
  let countries = options.countries;
  let wishList = options.wishList ?? [];

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

  const igBlock = document.createElement("div");
  igBlock.className = "share-section__ig";
  section.appendChild(igBlock);

  let availableModes = buildAvailableModes(visits, countries, wishList);
  let selectedMode: ShareImageMode = "statistics";
  let renderToken = 0;
  let deferHandle: DeferHandle | null = null;
  let pngBlob: Blob | null = null;
  let objectUrl: string | null = null;
  let latestBlobPromise: Promise<Blob> | null = null;
  let activeBlobSettle: {
    token: number;
    resolve: (blob: Blob) => void;
    reject: (reason: unknown) => void;
  } | null = null;
  let activePreload: {
    img: HTMLImageElement;
    url: string;
    reject: (reason: Error) => void;
  } | null = null;

  function cancelActivePreload(): void {
    const entry = activePreload;
    if (!entry) {
      return;
    }
    activePreload = null;
    entry.img.onload = null;
    entry.img.onerror = null;
    entry.img.src = "";
    URL.revokeObjectURL(entry.url);
    entry.reject(new DOMException("Aborted", "AbortError"));
  }

  const tablist = document.createElement("div");
  tablist.className =
    "visit-list-map-shell__toggle share-section__ig-tablist";
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", "Instagram share image mode");

  const previewSlot = document.createElement("div");
  previewSlot.className = "share-section__ig-actions";

  // Stable 4:5 frame: layout never remounts; only img src / overlays change.
  const previewFrame = document.createElement("div");
  previewFrame.className =
    "share-section__ig-frame share-section__ig-frame--loading";

  const previewImg = document.createElement("img");
  previewImg.className = "share-section__ig-image";
  previewImg.alt = "Instagram share image preview";
  previewImg.hidden = true;

  const placeholder = document.createElement("div");
  placeholder.className = "share-section__ig-placeholder";
  placeholder.setAttribute("aria-busy", "true");
  placeholder.setAttribute("aria-label", "Generating Instagram share image");

  const progressOverlay = document.createElement("div");
  progressOverlay.className = "share-section__ig-progress";
  progressOverlay.hidden = true;
  progressOverlay.setAttribute("aria-busy", "true");
  progressOverlay.setAttribute("aria-label", "Generating Instagram share image");

  const progressSpinner = document.createElement("div");
  progressSpinner.className = "share-section__ig-progress-spinner";
  progressOverlay.appendChild(progressSpinner);

  const errorMsg = document.createElement("p");
  errorMsg.className = "share-section__ig-error";
  errorMsg.hidden = true;
  errorMsg.textContent = "Could not create image";

  previewFrame.append(previewImg, placeholder, progressOverlay, errorMsg);
  previewSlot.appendChild(previewFrame);

  let progressHideTimer: number | null = null;
  let progressTransitionHandler: ((e: TransitionEvent) => void) | null = null;

  function clearProgressHide(): void {
    if (progressHideTimer !== null) {
      window.clearTimeout(progressHideTimer);
      progressHideTimer = null;
    }
    if (progressTransitionHandler) {
      progressOverlay.removeEventListener(
        "transitionend",
        progressTransitionHandler,
      );
      progressTransitionHandler = null;
    }
  }

  function showRegenerateProgress(): void {
    clearProgressHide();
    progressOverlay.hidden = false;
    void progressOverlay.offsetWidth;
    progressOverlay.classList.add("share-section__ig-progress--visible");
  }

  function hideRegenerateProgress(): void {
    if (
      progressOverlay.hidden &&
      !progressOverlay.classList.contains("share-section__ig-progress--visible")
    ) {
      return;
    }
    clearProgressHide();
    progressOverlay.classList.remove("share-section__ig-progress--visible");
    const finish = (): void => {
      clearProgressHide();
      progressOverlay.hidden = true;
    };
    progressTransitionHandler = (e: TransitionEvent) => {
      if (e.target !== progressOverlay || e.propertyName !== "opacity") return;
      finish();
    };
    progressOverlay.addEventListener("transitionend", progressTransitionHandler);
    progressHideTimer = window.setTimeout(finish, 380);
  }

  const copyImageBtn = document.createElement("button");
  copyImageBtn.type = "button";
  copyImageBtn.className = "share-section__copy-btn share-section__ig-copy-btn";
  copyImageBtn.innerHTML = COPY_ICON_SVG;
  copyImageBtn.appendChild(document.createTextNode(" Copy"));
  copyImageBtn.disabled = true;
  attachTooltip(copyImageBtn, "Copy image to clipboard");
  copyImageBtn.addEventListener("click", async () => {
    const blobPromise =
      latestBlobPromise ?? (pngBlob ? Promise.resolve(pngBlob) : null);
    if (!blobPromise) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blobPromise }),
      ]);
      successToast("The image was copied to the clipboard");
    } catch (err) {
      console.error("Could not copy share image:", err);
      errorToast("Could not copy image to clipboard");
    }
  });

  function revokePreviewUrl(): void {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    pngBlob = null;
  }

  async function preloadShareImageUrl(url: string): Promise<void> {
    cancelActivePreload();
    const pre = new Image();
    let preloadCancelled = false;

    const abortPromise = new Promise<never>((_, reject) => {
      activePreload = {
        img: pre,
        url,
        reject: (reason: Error) => {
          preloadCancelled = true;
          reject(reason);
        },
      };
    });

    const loadPromise = new Promise<void>((resolve, reject) => {
      pre.onload = () => resolve();
      pre.onerror = () => {
        console.error("Share preview image load failed");
        reject(new Error("share preview image load failed"));
      };
    });

    pre.src = url;

    const decodeOrLoad = async (): Promise<void> => {
      try {
        await pre.decode();
      } catch (err) {
        console.error("Share preview decode failed, falling back to load:", err);
        if (pre.complete && pre.naturalWidth > 0) {
          return;
        }
        if (pre.complete && pre.naturalWidth === 0) {
          console.error("Share preview image load failed");
          throw new Error("share preview image load failed");
        }
        await loadPromise;
      }
    };

    try {
      await Promise.race([decodeOrLoad(), abortPromise]);
    } finally {
      if (activePreload?.img === pre) {
        activePreload = null;
      }
    }
    if (preloadCancelled) {
      throw new DOMException("Aborted", "AbortError");
    }
  }

  function rejectActiveBlobSettle(reason: unknown): void {
    if (!activeBlobSettle) return;
    activeBlobSettle.reject(reason);
    activeBlobSettle = null;
  }

  function resolveBlobForToken(token: number, blob: Blob): void {
    if (activeBlobSettle?.token !== token) return;
    activeBlobSettle.resolve(blob);
    activeBlobSettle = null;
  }

  function rejectBlobForToken(token: number, reason: unknown): void {
    if (activeBlobSettle?.token !== token) return;
    activeBlobSettle.reject(reason);
    activeBlobSettle = null;
  }

  /** Reserve space; keep prior image while regenerating (no layout blink). */
  function markLoading(): void {
    const hasImage = Boolean(objectUrl) && !previewImg.hidden;
    if (hasImage) {
      showRegenerateProgress();
      return;
    }
    hideRegenerateProgress();
    previewFrame.classList.add("share-section__ig-frame--loading");
    previewFrame.classList.remove("share-section__ig-frame--error");
    errorMsg.hidden = true;
    placeholder.hidden = false;
    previewImg.hidden = true;
  }

  function showPreview(url: string): void {
    const previousUrl = objectUrl;
    objectUrl = url;
    previewImg.src = url;
    const firstShow = previewImg.hidden;
    if (firstShow) {
      previewImg.hidden = false;
      placeholder.hidden = true;
      errorMsg.hidden = true;
      previewFrame.classList.remove(
        "share-section__ig-frame--loading",
        "share-section__ig-frame--error",
      );
      copyImageBtn.disabled = false;
    }
    hideRegenerateProgress();
    if (previousUrl && previousUrl !== url) {
      URL.revokeObjectURL(previousUrl);
    }
  }

  function showRenderError(): void {
    copyImageBtn.disabled = true;
    revokePreviewUrl();
    previewImg.removeAttribute("src");
    previewImg.hidden = true;
    placeholder.hidden = true;
    hideRegenerateProgress();
    errorMsg.hidden = false;
    previewFrame.classList.remove("share-section__ig-frame--loading");
    previewFrame.classList.add("share-section__ig-frame--error");
  }

  function tabButtons(): HTMLButtonElement[] {
    return Array.from(
      tablist.querySelectorAll<HTMLButtonElement>("[role='tab']"),
    );
  }

  function applyTabSelection(focusSelected: boolean): void {
    for (const btn of tabButtons()) {
      const selected = btn.dataset.mode === selectedMode;
      btn.setAttribute("aria-selected", selected ? "true" : "false");
      btn.tabIndex = selected ? 0 : -1;
      btn.classList.toggle(
        "visit-list-map-shell__toggle-btn--active",
        selected,
      );
      if (focusSelected && selected) {
        btn.focus();
      }
    }
  }

  function syncTablist(focusSelected = false): void {
    if (availableModes.length <= 1) {
      tablist.hidden = true;
      tablist.replaceChildren();
      return;
    }
    tablist.hidden = false;

    const existing = tabButtons().map((b) => b.dataset.mode ?? "");
    const modesChanged =
      existing.length !== availableModes.length ||
      availableModes.some((mode, i) => existing[i] !== mode);

    if (modesChanged) {
      tablist.replaceChildren();
      for (const mode of availableModes) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "visit-list-map-shell__toggle-btn";
        btn.textContent = MODE_LABELS[mode];
        btn.setAttribute("role", "tab");
        btn.dataset.mode = mode;
        btn.addEventListener("click", () => selectMode(mode));
        tablist.appendChild(btn);
      }

      tablist.onkeydown = (e: KeyboardEvent) => {
        const buttons = tabButtons();
        if (buttons.length === 0) return;
        const currentIndex = buttons.findIndex(
          (b) => b.getAttribute("aria-selected") === "true",
        );
        if (currentIndex < 0) return;
        let nextIndex = currentIndex;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          nextIndex = (currentIndex + 1) % buttons.length;
          e.preventDefault();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          nextIndex =
            (currentIndex - 1 + buttons.length) % buttons.length;
          e.preventDefault();
        } else {
          return;
        }
        const nextMode = buttons[nextIndex]!.dataset.mode as ShareImageMode;
        selectMode(nextMode, true);
      };
    }

    applyTabSelection(focusSelected);
  }

  function selectMode(mode: ShareImageMode, focusSelected = false): void {
    if (!availableModes.includes(mode) || mode === selectedMode) return;
    selectedMode = mode;
    syncTablist(focusSelected);
    requestRender();
  }

  async function runRender(token: number): Promise<void> {
    const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";
    const stats = computeVisitStatistics(visits, countries);
    const nameFor = (code: string) => countryNameFor(countries, code);
    const hadImage = Boolean(pngBlob) && !previewImg.hidden;
    let uncommittedObjectUrl: string | null = null;

    try {
      const result = await renderShareImage({
        mode: selectedMode,
        stats,
        baseUrl,
        recentCountries:
          stats.uniqueVisitedCount >= 1
            ? getMostRecentVisitedCountries(visits, countries, 7)
            : [],
        favouriteRows: topCountriesByAverageScore(visits, nameFor).map((v) => ({
          countryCode: v.countryCode,
          name: nameFor(v.countryCode),
          score: v.score ?? 50,
        })),
        mostVisitedRows: mostVisitedCountries(visits, countries),
        continentVisitCounts: visitsPerContinent(visits, countries),
        wishListRows: buildWishListShareRows(wishList, countries),
      });
      uncommittedObjectUrl = result.objectUrl;
      if (token !== renderToken) {
        URL.revokeObjectURL(result.objectUrl);
        uncommittedObjectUrl = null;
        rejectBlobForToken(
          token,
          new DOMException("Stale share image render", "AbortError"),
        );
        return;
      }
      await preloadShareImageUrl(result.objectUrl);
      if (token !== renderToken) {
        URL.revokeObjectURL(result.objectUrl);
        uncommittedObjectUrl = null;
        rejectBlobForToken(
          token,
          new DOMException("Stale share image render", "AbortError"),
        );
        return;
      }
      pngBlob = result.pngBlob;
      resolveBlobForToken(token, result.pngBlob);
      showPreview(result.objectUrl);
      uncommittedObjectUrl = null;
    } catch (err) {
      const aborted =
        err instanceof DOMException && err.name === "AbortError";
      if (!aborted) {
        console.error("Failed to create Instagram share image:", err);
      }
      if (uncommittedObjectUrl) {
        if (!aborted) {
          URL.revokeObjectURL(uncommittedObjectUrl);
        }
        uncommittedObjectUrl = null;
      }
      if (token !== renderToken) {
        rejectBlobForToken(
          token,
          new DOMException("Stale share image render", "AbortError"),
        );
        return;
      }
      if (hadImage && pngBlob) {
        resolveBlobForToken(token, pngBlob);
        hideRegenerateProgress();
        errorToast("Could not create image");
        return;
      }
      rejectBlobForToken(token, err);
      showRenderError();
    }
  }

  function requestRender(): void {
    renderToken += 1;
    const token = renderToken;
    rejectActiveBlobSettle(
      new DOMException("Superseded share image render", "AbortError"),
    );
    cancelActivePreload();
    cancelDeferred(deferHandle);
    deferHandle = null;
    markLoading();

    const blobPromise = new Promise<Blob>((resolve, reject) => {
      activeBlobSettle = { token, resolve, reject };
    });
    blobPromise.catch(() => {});
    latestBlobPromise = blobPromise;

    deferHandle = scheduleDeferred(() => {
      deferHandle = null;
      void runRender(token);
    });
  }

  function mountIgBlock(): void {
    const igText = document.createElement("div");
    igText.className = "share-section__ig-text";

    const igTitle = document.createElement("h3");
    igTitle.className = "share-section__ig-title";
    igTitle.textContent = "Share on Instagram";
    igText.appendChild(igTitle);

    const igDesc = document.createElement("p");
    igDesc.className = "share-section__ig-desc";
    igDesc.textContent =
      "A portrait image of your travel statistics is generated automatically for Instagram. " +
      "When more than one view is available, use the tabs to switch between them.";
    igText.appendChild(igDesc);

    igBlock.append(igText, tablist, previewSlot, copyImageBtn);
    syncTablist();
  }

  function applyVisitData(
    nextVisits: CountryVisit[],
    nextCountries: Country[],
  ): void {
    visits = nextVisits;
    countries = nextCountries;
    availableModes = buildAvailableModes(visits, countries, wishList);
    if (!availableModes.includes(selectedMode)) {
      selectedMode = "statistics";
    }
    syncTablist();
    requestRender();
  }

  function applyWishListData(nextWishList: WishListCountry[]): void {
    const prevModesKey = availableModes.join(",");
    wishList = nextWishList;
    availableModes = buildAvailableModes(visits, countries, wishList);
    if (!availableModes.includes(selectedMode)) {
      selectedMode = "statistics";
    }
    const modesChanged = prevModesKey !== availableModes.join(",");
    syncTablist();
    if (selectedMode === "wishList" || modesChanged) {
      requestRender();
    }
  }

  mountIgBlock();
  requestRender();

  const handle: ShareSectionHandle = {
    element: section,
    updateData(next) {
      if (next.shareToken !== undefined) {
        shareToken = next.shareToken;
        input.placeholder = shareToken ? "" : "Loading...";
        input.value = shareToken ? buildShareUrl(shareToken) : "";
        copyBtn.disabled = !shareToken;
      }
      applyVisitData(next.visits, next.countries);
    },
    updateWishList(nextWishList) {
      applyWishListData(nextWishList);
    },
    dispose() {
      renderToken += 1;
      cancelDeferred(deferHandle);
      deferHandle = null;
      cancelActivePreload();
      rejectActiveBlobSettle(
        new DOMException("Share section disposed", "AbortError"),
      );
      clearProgressHide();
      progressOverlay.classList.remove("share-section__ig-progress--visible");
      progressOverlay.hidden = true;
      revokePreviewUrl();
      shareSectionHandles.delete(section);
    },
  };

  shareSectionHandles.set(section, handle);
  return handle;
}
