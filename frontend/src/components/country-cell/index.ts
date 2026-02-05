/**
 * Creates a country cell element: flag on the left, country name on the right.
 * Fixed dimensions for consistent grid layout.
 */
export function createCountryCell(countryCode: string, countryName: string, baseUrl: string): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "country-cell";

  const img = document.createElement("img");
  img.src = `${baseUrl}/assets/images/${countryCode.toLowerCase()}.jpg`;
  img.alt = countryName;
  cell.appendChild(img);

  const span = document.createElement("span");
  span.textContent = countryName;
  cell.appendChild(span);

  return cell;
}
