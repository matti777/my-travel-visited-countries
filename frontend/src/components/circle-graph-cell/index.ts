export interface CreateCircleGraphCellOptions {
  percentage: number;
  fillColor: string;
  label: string;
}

const r = 48;
const strokeWidth = r / 5;
const circumference = 2 * Math.PI * r;

/**
 * Creates a circle graph cell: circular progress ring (0–100%), center percentage text, label below.
 * Uses classes statistics-cell, statistics-cell__circle-wrap, etc. for styling from main.css.
 */
export function createCircleGraphCell(options: CreateCircleGraphCellOptions): HTMLElement {
  const { percentage, fillColor, label } = options;
  const cell = document.createElement("div");
  cell.className = "statistics-cell";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${r * 2 + strokeWidth * 2} ${r * 2 + strokeWidth * 2}`);
  svg.setAttribute("class", "statistics-cell__svg");
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("transform", `translate(${r + strokeWidth},${r + strokeWidth})`);
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bg.setAttribute("r", String(r));
  bg.setAttribute("fill", "none");
  bg.setAttribute("stroke", "#ddd");
  bg.setAttribute("stroke-width", String(strokeWidth));
  g.appendChild(bg);
  const fg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  fg.setAttribute("r", String(r));
  fg.setAttribute("fill", "none");
  fg.setAttribute("stroke", fillColor);
  fg.setAttribute("stroke-width", String(strokeWidth));
  fg.setAttribute("stroke-dasharray", String(circumference));
  fg.setAttribute("stroke-dashoffset", String(circumference * (1 - percentage / 100)));
  fg.setAttribute("transform", "rotate(-90)");
  g.appendChild(fg);
  svg.appendChild(g);
  const circleWrap = document.createElement("div");
  circleWrap.className = "statistics-cell__circle-wrap";
  circleWrap.appendChild(svg);
  const percentEl = document.createElement("div");
  percentEl.className = "statistics-cell__percent";
  percentEl.textContent = `${percentage} %`;
  circleWrap.appendChild(percentEl);
  cell.appendChild(circleWrap);
  const nameEl = document.createElement("div");
  nameEl.className = "statistics-cell__name";
  nameEl.textContent = label;
  cell.appendChild(nameEl);
  return cell;
}
