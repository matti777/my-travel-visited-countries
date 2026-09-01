# Share section

Sharing controls for the logged-in main page (`Components/share-section`).

## Share URL

- Read-only input with the permanent Share URL (`/share/<share-token>`).
- **Copy** button copies the URL and shows success toast: "The Share URL was copied to the clipboard".
- Tooltip: "Copy Share URL".
- Explanatory text under the row.

## Instagram share image

Below the Share URL block:

1. Left-aligned sub-title **Share on Instagram**, then left-aligned descriptive text explaining that the control builds a portrait travel-stats image for Instagram (same continent breakdown as the Statistics tab).
2. Horizontally centered **Create Instagram image** button (`primary`).
3. On press (`async`/`await`): generate a **1080×1350** JPEG (Instagram 4:5) via canvas:
   - Slightly blurred cover of `/assets/images/og-preview.jpg` as background
   - Headline: `Number of visited countries: <n>` (`n` = unique listed country codes)
   - Circular diagrams for Africa, Asia, Europe, North America, Oceania, South America, The World — same order, percentages, and fill colors as the Statistics tab (`src/utils/visit-statistics.ts`); ring percentage text is white
   - When the user has ≥1 listed country visit: centered title **Most recent visits:** (with top padding) plus up to 7 unique countries by most recent `visitedTime`, flowed left-to-right (wrapping; each line centered) as flag + name in white text
   - Footer label: `countriesof.earth`
4. The create button is replaced by a framed, centered preview `<img>` (JPEG object URL) and a **Copy** button under it.
5. **Copy** writes a **PNG** blob from the same canvas to the clipboard (`ClipboardItem`) for mobile Safari compatibility, then success toast: "The image was copied to the clipboard". Failures: `console.error` + error toast.

Partial form refreshes must not remount this section (preserve a generated preview); full app refresh may recreate it when visits change.

## Props

`shareToken`, `visits`, `countries`.
