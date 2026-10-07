import type {
  ContinentVisitCountRow,
  CountryVisitCountRow,
  RecentVisitedCountry,
  VisitStatistics,
} from "../../utils/visit-statistics";

export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1350;

const OG_PREVIEW_PATH = "/assets/images/og-preview.jpg";
const JPEG_QUALITY = 0.92;
const BG_BLUR_PX = 12;
const MAX_WISH_LIST_SHARE_ROWS = 5;

export type ShareImageMode =
  | "statistics"
  | "favourite"
  | "mostVisited"
  | "wishList";

export interface ShareImageResult {
  jpegBlob: Blob;
  pngBlob: Blob;
  objectUrl: string;
}

export interface FavouriteShareRow {
  countryCode: string;
  name: string;
  score: number;
}

export interface WishListShareRow {
  countryCode: string;
  name: string;
  description: string;
}

export interface RenderShareImageOptions {
  mode: ShareImageMode;
  stats: VisitStatistics;
  /** Statistics mode: up to 7 most recent countries. */
  recentCountries?: RecentVisitedCountry[];
  /** Favourite mode: up to 5 ranked rows. */
  favouriteRows?: FavouriteShareRow[];
  /** Most visited mode. */
  mostVisitedRows?: CountryVisitCountRow[];
  continentVisitCounts?: ContinentVisitCountRow[];
  /** Wish list mode: up to 5 rows in saved order. */
  wishListRows?: WishListShareRow[];
  /** App base URL for flag assets (no trailing slash). */
  baseUrl?: string;
}

/**
 * Awaits canvas.toBlob (callback-only browser API). Sole Promise wrapper.
 */
async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`failed to encode canvas as ${type}`));
      },
      type,
      quality,
    );
  });
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  return img;
}

async function tryLoadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    return await loadImage(src);
  } catch (err) {
    console.error("failed to load share image asset:", src, err);
    return null;
  }
}

function drawCoverBlurred(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  const dx = (width - drawW) / 2;
  const dy = (height - drawH) / 2;
  ctx.save();
  ctx.filter = `blur(${BG_BLUR_PX}px)`;
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.restore();
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillRect(0, 0, width, height);
}

function drawFooter(ctx: CanvasRenderingContext2D, fontStack: string): void {
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 36px ${fontStack}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 1;
  ctx.fillText(
    "Shared from countriesof.earth",
    SHARE_IMAGE_WIDTH / 2,
    SHARE_IMAGE_HEIGHT - 48,
  );
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** RGB lerp: 1 red → 50 yellow → 100 green (opaque, for canvas). */
function scoreToSolidColor(score: number): string {
  const s = Math.max(1, Math.min(100, Math.round(score)));
  const red = { r: 220, g: 50, b: 50 };
  const yellow = { r: 220, g: 190, b: 40 };
  const green = { r: 40, g: 170, b: 70 };
  let from = red;
  let to = yellow;
  let t: number;
  if (s <= 50) {
    t = (s - 1) / 49;
  } else {
    from = yellow;
    to = green;
    t = (s - 50) / 50;
  }
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function truncateToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = "…";
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid) + ellipsis;
    if (ctx.measureText(candidate).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ellipsis;
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  percentage: number,
  fillColor: string,
): void {
  const strokeWidth = r / 5;
  const start = -Math.PI / 2;
  const end = start + (2 * Math.PI * Math.min(100, Math.max(0, percentage))) / 100;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.strokeStyle = "#dddddd";
  ctx.lineWidth = strokeWidth;
  ctx.stroke();

  if (percentage > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, end);
    ctx.strokeStyle = fillColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = "butt";
    ctx.stroke();
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${Math.round(r * 0.42)}px "Roboto Condensed", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${percentage} %`, cx, cy);
}

async function drawMostRecentVisits(
  ctx: CanvasRenderingContext2D,
  recent: RecentVisitedCountry[],
  baseUrl: string,
  fontStack: string,
  topY: number,
): Promise<void> {
  const flagW = 40;
  const flagH = 28;
  const itemGapX = 28;
  const itemGapY = 16;
  const flagNameGap = 12;
  const flowWidth = 920;
  const titleTopPad = 56;
  const titleY = topY + titleTopPad;

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 34px ${fontStack}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 1;
  ctx.fillText("Most recent visits:", SHARE_IMAGE_WIDTH / 2, titleY);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const assetBase = baseUrl ? `${baseUrl}/assets/images` : "/assets/images";
  const nameFont = `600 28px ${fontStack}`;
  ctx.font = nameFont;

  type FlowItem = {
    country: RecentVisitedCountry;
    flag: HTMLImageElement | null;
    width: number;
  };
  const items: FlowItem[] = [];
  for (const country of recent) {
    const flagSrc = `${assetBase}/${country.countryCode.toLowerCase()}.jpg`;
    const flag = await tryLoadImage(flagSrc);
    const nameW = ctx.measureText(country.name).width;
    const width = (flag ? flagW + flagNameGap : 0) + nameW;
    items.push({ country, flag, width });
  }

  const lines: FlowItem[][] = [];
  let currentLine: FlowItem[] = [];
  let currentWidth = 0;
  for (const item of items) {
    const gap = currentLine.length > 0 ? itemGapX : 0;
    if (currentLine.length > 0 && currentWidth + gap + item.width > flowWidth) {
      lines.push(currentLine);
      currentLine = [item];
      currentWidth = item.width;
    } else {
      currentWidth += gap + item.width;
      currentLine.push(item);
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  let y = titleY + 64;
  const lineH = Math.max(flagH, 28) + itemGapY;

  for (const line of lines) {
    let lineWidth = 0;
    for (let i = 0; i < line.length; i++) {
      lineWidth += line[i]!.width;
      if (i > 0) lineWidth += itemGapX;
    }
    let x = (SHARE_IMAGE_WIDTH - lineWidth) / 2;
    const itemMidY = y + lineH / 2 - itemGapY / 2;

    for (const item of line) {
      if (item.flag) {
        ctx.drawImage(item.flag, x, itemMidY - flagH / 2, flagW, flagH);
        x += flagW + flagNameGap;
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = nameFont;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.fillText(item.country.name, x, itemMidY);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      x += ctx.measureText(item.country.name).width + itemGapX;
    }

    y += lineH;
  }
}

async function drawStatisticsMode(
  ctx: CanvasRenderingContext2D,
  options: RenderShareImageOptions,
  fontStack: string,
): Promise<void> {
  const { stats, recentCountries = [], baseUrl = "" } = options;

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.font = `700 52px ${fontStack}`;
  ctx.fillText(
    `Number of visited countries: ${stats.uniqueVisitedCount}`,
    SHARE_IMAGE_WIDTH / 2,
    56,
  );
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const showRecent = recentCountries.length > 0 && stats.uniqueVisitedCount >= 1;
  const areas = stats.areas;
  const cols = 3;
  const ringR = showRecent ? 68 : 78;
  const cellW = 280;
  const cellH = showRecent ? 190 : 220;
  const gridTop = showRecent ? 160 : 220;
  const gridWidth = cols * cellW;
  const gridLeft = (SHARE_IMAGE_WIDTH - gridWidth) / 2;

  for (let i = 0; i < areas.length; i++) {
    const area = areas[i]!;
    const row = Math.floor(i / cols);
    const col = i % cols;
    let colIndex = col;
    if (row === 2 && areas.length === 7) {
      colIndex = 1;
    }
    const cx = gridLeft + colIndex * cellW + cellW / 2;
    const cy = gridTop + row * cellH + ringR + 8;
    drawRing(ctx, cx, cy, ringR, area.percentage, area.fillColor);
    ctx.font = `500 26px ${fontStack}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const label = area.name;
    const labelY = cy + ringR + 14;
    const metrics = ctx.measureText(label);
    const padX = 12;
    const tw = metrics.width + padX * 2;
    const th = 30;
    ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
    ctx.beginPath();
    const lx = cx - tw / 2;
    const ly = labelY - 4;
    const rr = 8;
    ctx.moveTo(lx + rr, ly);
    ctx.arcTo(lx + tw, ly, lx + tw, ly + th, rr);
    ctx.arcTo(lx + tw, ly + th, lx, ly + th, rr);
    ctx.arcTo(lx, ly + th, lx, ly, rr);
    ctx.arcTo(lx, ly, lx + tw, ly, rr);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#222222";
    ctx.fillText(label, cx, labelY);
  }

  if (showRecent) {
    const ringsBottom = gridTop + 3 * cellH;
    await drawMostRecentVisits(
      ctx,
      recentCountries.slice(0, 7),
      baseUrl,
      fontStack,
      ringsBottom + 8,
    );
  }
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  const spikes = 5;
  const outer = size / 2;
  const inner = outer * 0.45;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

async function drawFavouriteMode(
  ctx: CanvasRenderingContext2D,
  options: RenderShareImageOptions,
  fontStack: string,
): Promise<void> {
  const rows = options.favouriteRows ?? [];
  const baseUrl = options.baseUrl ?? "";
  const assetBase = baseUrl ? `${baseUrl}/assets/images` : "/assets/images";

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.font = `700 52px ${fontStack}`;
  ctx.fillText("Favourite countries", SHARE_IMAGE_WIDTH / 2, 56);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const flagW = 48;
  const flagH = 34;
  const rowH = 108;
  const left = 80;
  const right = SHARE_IMAGE_WIDTH - 80;
  const nameFont = `600 34px ${fontStack}`;
  const rankFont = `700 32px ${fontStack}`;
  const scoreFont = `700 32px ${fontStack}`;
  let y = 180;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rank = i + 1;
    const midY = y + rowH / 2;

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    const panelH = rowH - 12;
    ctx.roundRect(left, y, right - left, panelH, 10);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = rankFont;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${rank}.`, left + 16, midY);

    const flagSrc = `${assetBase}/${row.countryCode.toLowerCase()}.jpg`;
    const flag = await tryLoadImage(flagSrc);
    const flagX = left + 64;
    if (flag) {
      ctx.drawImage(flag, flagX, midY - flagH / 2, flagW, flagH);
    }

    ctx.font = nameFont;
    const nameX = flagX + flagW + 20;
    const maxNameW = right - 220 - nameX;
    const name = truncateToWidth(ctx, row.name, maxNameW);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(name, nameX, midY);

    const scoreRounded = Math.round(row.score);
    const starX = right - 100;
    drawStar(ctx, starX, midY, 28, "rgba(230, 194, 0, 0.85)");
    ctx.font = scoreFont;
    ctx.textAlign = "left";
    ctx.fillStyle = scoreToSolidColor(row.score);
    ctx.fillText(String(scoreRounded), starX + 22, midY);

    y += rowH;
  }
}


async function drawWishListMode(
  ctx: CanvasRenderingContext2D,
  options: RenderShareImageOptions,
  fontStack: string,
): Promise<void> {
  const rows = (options.wishListRows ?? []).slice(0, MAX_WISH_LIST_SHARE_ROWS);
  const baseUrl = options.baseUrl ?? "";
  const assetBase = baseUrl ? `${baseUrl}/assets/images` : "/assets/images";

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.font = `700 52px ${fontStack}`;
  ctx.fillText("Wish List", SHARE_IMAGE_WIDTH / 2, 56);
  ctx.font = `500 32px ${fontStack}`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  ctx.fillText("Countries I would like to visit", SHARE_IMAGE_WIDTH / 2, 124);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const flagW = 48;
  const flagH = 34;
  const rowH = 108;
  const left = 80;
  const right = SHARE_IMAGE_WIDTH - 80;
  const nameFont = `600 34px ${fontStack}`;
  const descFont = `500 26px ${fontStack}`;
  let y = 200;

  for (const row of rows) {
    const hasDescription = row.description.length > 0;
    const midY = y + rowH / 2;
    const nameY = hasDescription ? midY - 18 : midY;
    const descY = midY + 16;

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    const panelH = rowH - 12;
    ctx.roundRect(left, y, right - left, panelH, 10);
    ctx.fill();

    const flagSrc = `${assetBase}/${row.countryCode.toLowerCase()}.jpg`;
    const flag = await tryLoadImage(flagSrc);
    const flagX = left + 24;
    if (flag) {
      ctx.drawImage(flag, flagX, midY - flagH / 2, flagW, flagH);
    }

    const nameX = flagX + flagW + 20;
    const maxTextW = right - 32 - nameX;
    ctx.font = nameFont;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(truncateToWidth(ctx, row.name, maxTextW), nameX, nameY);

    if (hasDescription) {
      ctx.font = descFont;
      ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
      ctx.fillText(
        truncateToWidth(ctx, row.description, maxTextW),
        nameX,
        descY,
      );
    }

    y += rowH;
  }
}

function drawHorizontalBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  maxBarW: number,
  barH: number,
  fraction: number,
  fillColor: string,
  trackColor: string,
): void {
  ctx.fillStyle = trackColor;
  ctx.beginPath();
  ctx.roundRect(x, y, maxBarW, barH, barH / 2);
  ctx.fill();
  const fillW = Math.max(barH, maxBarW * Math.min(1, Math.max(0, fraction)));
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.roundRect(x, y, fillW, barH, barH / 2);
  ctx.fill();
}

async function drawMostVisitedMode(
  ctx: CanvasRenderingContext2D,
  options: RenderShareImageOptions,
  fontStack: string,
): Promise<void> {
  const countryRows = options.mostVisitedRows ?? [];
  const continentRows = options.continentVisitCounts ?? [];
  const baseUrl = options.baseUrl ?? "";
  const assetBase = baseUrl ? `${baseUrl}/assets/images` : "/assets/images";

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.font = `700 52px ${fontStack}`;
  ctx.fillText("Most visited", SHARE_IMAGE_WIDTH / 2, 56);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const sectionTitleFont = `700 36px ${fontStack}`;
  const labelFont = `600 28px ${fontStack}`;
  const countFont = `600 24px ${fontStack}`;
  const left = 72;
  const right = SHARE_IMAGE_WIDTH - 72;
  const contentW = right - left;
  const maxCountryCount = countryRows[0]?.count ?? 1;
  const maxContinentCount = continentRows[0]?.count ?? 1;

  ctx.font = sectionTitleFont;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Countries", left, 150);

  const flagW = 40;
  const flagH = 28;
  const rowH = 72;
  let y = 210;
  const barMaxW = contentW * 0.42;
  const barH = 22;
  const barX = left + contentW * 0.48;

  for (const row of countryRows) {
    const midY = y + rowH / 2;
    const flag = await tryLoadImage(
      `${assetBase}/${row.countryCode.toLowerCase()}.jpg`,
    );
    const nameX = left;
    if (flag) {
      ctx.drawImage(flag, nameX, midY - flagH / 2, flagW, flagH);
    }
    ctx.font = labelFont;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    const nameStart = nameX + flagW + 14;
    const nameMaxW = barX - nameStart - 16;
    ctx.fillText(truncateToWidth(ctx, row.name, nameMaxW), nameStart, midY);

    drawHorizontalBar(
      ctx,
      barX,
      midY - barH / 2,
      barMaxW,
      barH,
      row.count / maxCountryCount,
      "rgba(255, 255, 255, 0.85)",
      "rgba(255, 255, 255, 0.22)",
    );

    ctx.font = countFont;
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${row.count} visits`, barX + barMaxW + 14, midY);

    y += rowH;
  }

  const continentTop = Math.max(y + 24, 620);
  ctx.font = sectionTitleFont;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Continents", left, continentTop);

  y = continentTop + 52;
  const contBarMaxW = contentW * 0.55;
  const contBarX = left + 200;

  for (const row of continentRows) {
    const midY = y + 56 / 2;
    ctx.font = labelFont;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    const nameMaxW = contBarX - left - 12;
    ctx.fillText(truncateToWidth(ctx, row.name, nameMaxW), left, midY);

    drawHorizontalBar(
      ctx,
      contBarX,
      midY - barH / 2,
      contBarMaxW,
      barH,
      row.count / maxContinentCount,
      row.fillColor,
      "rgba(255, 255, 255, 0.22)",
    );

    ctx.font = countFont;
    ctx.fillText(`${row.count} visits`, contBarX + contBarMaxW + 14, midY);

    y += 56;
  }
}

/**
 * Renders Instagram 4:5 share card (1080×1350 JPEG + PNG for clipboard).
 */
export async function renderShareImage(
  options: RenderShareImageOptions,
): Promise<ShareImageResult> {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_IMAGE_WIDTH;
  canvas.height = SHARE_IMAGE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("could not create 2d canvas context");
  }

  const bg = await loadImage(OG_PREVIEW_PATH);
  drawCoverBlurred(ctx, bg, SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT);

  const fontStack = '"Roboto Condensed", Arial, sans-serif';

  if (options.mode === "statistics") {
    await drawStatisticsMode(ctx, options, fontStack);
  } else if (options.mode === "favourite") {
    await drawFavouriteMode(ctx, options, fontStack);
  } else if (options.mode === "wishList") {
    await drawWishListMode(ctx, options, fontStack);
  } else {
    await drawMostVisitedMode(ctx, options, fontStack);
  }

  drawFooter(ctx, fontStack);

  const jpegBlob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  const pngBlob = await canvasToBlob(canvas, "image/png");
  const objectUrl = URL.createObjectURL(jpegBlob);
  return { jpegBlob, pngBlob, objectUrl };
}
