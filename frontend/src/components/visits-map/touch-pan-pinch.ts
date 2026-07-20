/**
 * svg-pan-zoom has no built-in pinch (only single-finger pan + double-tap).
 * Capture-phase handlers take over touch so stock listeners never fight pinch,
 * and implement 1-finger pan + 2-finger pinch-zoom (Hammer demo pattern).
 */

export interface TouchPanPinchTarget {
  panBy: (point: { x: number; y: number }) => unknown;
  zoomAtPoint: (scale: number, point: { x: number; y: number }) => unknown;
  getZoom: () => number;
}

export function attachTouchPanPinch(
  root: HTMLElement,
  panZoom: TouchPanPinchTarget
): () => void {
  type Mode = "none" | "pan" | "pinch";
  let mode: Mode = "none";
  let lastX = 0;
  let lastY = 0;
  let pinchStartDist = 1;
  let pinchStartZoom = 1;

  const touchDist = (a: Touch, b: Touch): number => {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  };

  const touchCenter = (a: Touch, b: Touch): { x: number; y: number } => ({
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
  });

  const beginPan = (t: Touch): void => {
    mode = "pan";
    lastX = t.clientX;
    lastY = t.clientY;
  };

  const beginPinch = (a: Touch, b: Touch): void => {
    mode = "pinch";
    pinchStartDist = Math.max(1, touchDist(a, b));
    pinchStartZoom = panZoom.getZoom();
  };

  const onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length >= 2) {
      beginPinch(e.touches[0], e.touches[1]);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.touches.length === 1) {
      beginPan(e.touches[0]);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length >= 2) {
      if (mode !== "pinch") {
        beginPinch(e.touches[0], e.touches[1]);
      }
      const d = Math.max(1, touchDist(e.touches[0], e.touches[1]));
      const scale = pinchStartZoom * (d / pinchStartDist);
      panZoom.zoomAtPoint(scale, touchCenter(e.touches[0], e.touches[1]));
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (mode === "pan" && e.touches.length === 1) {
      const t = e.touches[0];
      panZoom.panBy({ x: t.clientX - lastX, y: t.clientY - lastY });
      lastX = t.clientX;
      lastY = t.clientY;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const onTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length >= 2) {
      beginPinch(e.touches[0], e.touches[1]);
      e.stopPropagation();
      return;
    }
    if (e.touches.length === 1) {
      beginPan(e.touches[0]);
      e.stopPropagation();
      return;
    }
    mode = "none";
    e.stopPropagation();
  };

  const opts: AddEventListenerOptions = { capture: true, passive: false };
  root.addEventListener("touchstart", onTouchStart, opts);
  root.addEventListener("touchmove", onTouchMove, opts);
  root.addEventListener("touchend", onTouchEnd, opts);
  root.addEventListener("touchcancel", onTouchEnd, opts);

  return () => {
    root.removeEventListener("touchstart", onTouchStart, opts);
    root.removeEventListener("touchmove", onTouchMove, opts);
    root.removeEventListener("touchend", onTouchEnd, opts);
    root.removeEventListener("touchcancel", onTouchEnd, opts);
  };
}
