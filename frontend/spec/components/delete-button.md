# Delete button

Shared compact control for entity deletes (visits, friends, wish-list entries).

## Presentation

- Square button (~28×28) with a thin red border and white background.
- Icon: red trash-can SVG (stroke), `aria-hidden`.
- Hover: light gray fill.
- Host supplies `ariaLabel`, tooltip text, `onClick`, and optional extra class names for layout.

## Component

Implemented as `Components/delete-button` (`createDeleteButton`).
