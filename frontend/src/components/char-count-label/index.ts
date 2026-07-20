export interface CharCountLabelOptions {
  /** Fixed title prefix, e.g. "Free-form trip notes". */
  title: string;
  maxLength: number;
  /** Optional id for associating with a form control via htmlFor. */
  htmlFor?: string;
  className?: string;
}

export interface CharCountLabelHandle {
  element: HTMLLabelElement;
  setCount(length: number): void;
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpRgb(
  from: [number, number, number],
  to: [number, number, number],
  t: number,
): string {
  const clamped = Math.min(1, Math.max(0, t));
  return (
    `rgb(${lerpChannel(from[0], to[0], clamped)}, ` +
    `${lerpChannel(from[1], to[1], clamped)}, ` +
    `${lerpChannel(from[2], to[2], clamped)})`
  );
}

/** Color: green @ 0%, yellow @ 75%, deep red @ 100% of maxLength. */
function countColor(length: number, maxLength: number): string {
  const green: [number, number, number] = [0, 128, 0];
  const yellow: [number, number, number] = [230, 184, 0];
  const deepRed: [number, number, number] = [139, 0, 0];
  const max = Math.max(1, maxLength);
  const x = Math.min(max, Math.max(0, length));
  const mid = Math.round(max * 0.75);
  if (x <= mid) {
    return lerpRgb(green, yellow, mid === 0 ? 0 : x / mid);
  }
  const rest = max - mid;
  return lerpRgb(yellow, deepRed, rest === 0 ? 1 : (x - mid) / rest);
}

/**
 * Label with title + colored [current / max] counter.
 * See frontend/spec/char-count-label-component.md.
 */
export function createCharCountLabel(
  options: CharCountLabelOptions,
): CharCountLabelHandle {
  const { title, maxLength, htmlFor, className } = options;
  const label = document.createElement("label");
  label.className = className
    ? `char-count-label ${className}`
    : "char-count-label";
  if (htmlFor) {
    label.htmlFor = htmlFor;
  }

  const titleSpan = document.createElement("span");
  titleSpan.className = "char-count-label__title";
  titleSpan.textContent = `${title} `;
  label.appendChild(titleSpan);

  const countSpan = document.createElement("span");
  countSpan.className = "char-count-label__count";
  label.appendChild(countSpan);

  function setCount(length: number): void {
    const n = Math.min(maxLength, Math.max(0, length));
    countSpan.textContent = `[${n} / ${maxLength}]`;
    countSpan.style.color = countColor(n, maxLength);
  }

  setCount(0);

  return { element: label, setCount };
}
