# Share section

Sharing controls for the logged-in main page (`Components/share-section`).

## Share URL

- Read-only input with the permanent Share URL (`/share/<share-token>`).
- **Copy** button copies the URL and shows success toast: "The Share URL was copied to the clipboard".
- Tooltip: "Copy Share URL".
- Explanatory text under the row.

## Instagram share image

Below the Share URL block:

1. Left-aligned sub-title **Share on Instagram**, then descriptive text about automatic portrait images for Instagram.
2. When more than one mode qualifies, a centered tab control (`role="tablist"`, tabs with `role="tab"`, `aria-selected`, roving `tabindex`, arrow-key navigation) appears above the preview with labels **Statistics**, **Favourite countries**, **Most visited**, and **Wish List** (when available). **Statistics** is selected by default. With only one mode, tabs are hidden.
3. **Mode availability** (ordered): **Statistics** always; **Favourite countries** when `topCountriesByAverageScore` qualifies (≥5 listed countries with average score > 50, same rule as Top countries on the profile); **Most visited** when ≥3 distinct listed countries each have ≥2 visit rows; **Wish List** when the wish list has at least one entry whose `countryCode` matches a known country (ordered after **Most visited**).
4. A stable 4:5 framed preview (fixed aspect ratio, no remount on mode or data refresh). On first load, a spinner fills the frame; after the first image exists, regenerations keep the previous image visible (slightly dimmed with a centered spinner overlay that fades in/out) until the new JPEG preview is decoded, then only the preview `<img>` `src` changes (PNG is clipboard-only). Defer render via `requestIdleCallback` (timeout ~500 ms) or `setTimeout(0)` when idle callback is unavailable. A `renderToken` guard drops stale results and revokes discarded object URLs. Errors log to the console; inline "Could not create image" appears only when no preview exists yet—otherwise a toast is shown and the prior image stays.
5. **1080×1350** JPEG preview in a framed `<img>` scaled with `object-fit: contain` to the frame inner area (shared padding via `--share-section-ig-frame-padding`):
   - **Statistics** — same layout as before (blurred `og-preview.jpg`, visited-country count, continent rings, optional most recent visits, footer `Shared from countriesof.earth`).
   - **Favourite countries** — same background/frame/footer; title **Favourite countries**; top 5 from `topCountriesByAverageScore` with flag, name, star, colour-coded average score.
   - **Most visited** — same background/frame/footer; title **Most visited**; **Countries** panel (up to 5 rows with ≥2 visits each: flag, name, proportional bar, "N visits"); **Continents** panel (visit-row counts per continent, continent colours from `visit-statistics.ts`, bars ranked by count).
   - **Wish List** — same background/frame/footer; title **Wish List** and subtitle **Countries I would like to visit**; up to 5 wish-list entries in saved order (known countries only): rounded row panels with flag and name; optional description on a second muted line (width-truncated with "…"); no star/score column.
6. **Copy** under the preview writes PNG from the same canvas to the clipboard via `ClipboardItem` with a promise (keeps user activation during in-flight renders). Disabled only until the first image exists; stays enabled during later regenerations. Success toast: "The image was copied to the clipboard".

Partial form refreshes must not remount this section; `updateData` refreshes modes and re-renders when visits change. `updateWishList(wishList)` updates wish-list-driven modes and re-renders when the current tab is **Wish List** or the available mode set changed. If the selected tab is no longer available, fall back to **Statistics**. Full app refresh may recreate the section.

## Props

`shareToken`, `visits`, `countries`, optional `wishList` (defaults to `[]`). Handle: `updateData`, `updateWishList`, `dispose`.
