# WishListEditorCell

Editable row for one wish-list country (or the empty “add” row). Used inside the [wish list editor](wish-list-editor.md).

## Modes

### `item`

- **Row 1:** [country dropdown](country-dropdown.md) (required, not clearable). Host passes a country list that excludes other draft codes (current code still included).
- **Row 2:** Description textarea with [character count label](char-count-label.md) titled **Description**, `maxLength` **500**. Plain text (not Markdown-rendered). Placeholder: optional why-this-country copy.
- **Top row:** country dropdown and [delete button](delete-button.md) (red trash icon) on one row; the delete control is vertically centered with the country input. Tooltip: “Click to remove from wish list”.
- Slight hover background tint. Host applies dragging styles while reordering. The whole cell chrome is the drag surface; inputs/buttons are excluded via `isWishListEditorCellInteractiveTarget`.

Callbacks: `onChange({ countryCode, description })`, `onDelete`. Reorder is owned by the editor host (pointer events on the cell element).

### `add`

- Same country + description controls.
- **+** button in the top row (same 28×28 size as the delete button); no delete control.
  Tooltip: “A new wish list country entry will be added”.
- **+** disabled until a country is selected and that code is not already on the list.
- On **+**: emit `onAdd({ countryCode, description })`; host clears selection via `clear()` / remount.

## Component

Implemented as `Components/wish-list-editor-cell` (`createWishListEditorCell`).
