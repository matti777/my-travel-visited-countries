import DOMPurify from "dompurify";
import { marked } from "marked";

export interface WishListCellOptions {
  countryCode: string;
  countryName: string;
  baseUrl: string;
  description?: string;
  className?: string;
}

function renderMarkdownHtml(markdown: string): string {
  const raw = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(raw);
}

/**
 * Read-only wish-list entry: flag + country name + optional Markdown description.
 * See frontend/spec/components/wish-list-cell.md.
 */
export function createWishListCell(options: WishListCellOptions): HTMLElement {
  const root = document.createElement("div");
  root.className = "wish-list-cell";
  if (options.className) {
    root.classList.add(...options.className.split(/\s+/).filter(Boolean));
  }

  const nameRow = document.createElement("div");
  nameRow.className = "wish-list-cell__name";

  const code = options.countryCode.trim();
  if (code) {
    const flag = document.createElement("img");
    flag.className = "wish-list-cell__flag";
    flag.src = `${options.baseUrl}/assets/images/${code.toLowerCase()}.jpg`;
    flag.alt = options.countryName;
    nameRow.appendChild(flag);
  }

  const nameSpan = document.createElement("span");
  nameSpan.textContent = options.countryName;
  nameRow.appendChild(nameSpan);
  root.appendChild(nameRow);

  const desc = (options.description ?? "").trim();
  if (desc) {
    const descEl = document.createElement("div");
    descEl.className = "wish-list-cell__description";
    descEl.innerHTML = renderMarkdownHtml(desc);
    root.appendChild(descEl);
  }

  return root;
}
