import type {
  RecentVisitedCountry,
  VisitStatistics,
} from "../../utils/visit-statistics";

export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1350;

const OG_PREVIEW_PATH = "/assets/images/og-preview.jpg";
const JPEG_QUALITY = 0.92;
const BG_BLUR_PX = 12;

export interface ShareImageResult {
  jpegBlob: Blob;
  pngBlob: Blob;
  objectUrl: string;
}

export interface RenderShareImageOptions {
  stats: VisitStatistics;
  /** Up to 7 most recent countries; omitted/empty when no visits. */
  recentCountries?: RecentVisitedCountry[];
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
  // Soft darkening so text/rings stay readable
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillRect(0, 0, width, height);
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

/**
 * Renders Instagram 4:5 share card (1080×1350 JPEG + PNG for clipboard).
 */
export async function renderShareImage(
  options: RenderShareImageOptions,
): Promise<ShareImageResult> {
  const { stats, recentCountries = [], baseUrl = "" } = options;
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
    // Last row (The World alone): center under the grid
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

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 36px ${fontStack}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 1;
  ctx.fillText("countriesof.earth", SHARE_IMAGE_WIDTH / 2, SHARE_IMAGE_HEIGHT - 48);
  ctx.shadowColor = "transparent";

  const jpegBlob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  const pngBlob = await canvasToBlob(canvas, "image/png");
  const objectUrl = URL.createObjectURL(jpegBlob);
  return { jpegBlob, pngBlob, objectUrl };
}
