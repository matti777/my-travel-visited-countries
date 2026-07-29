# WishListEditorCell

Editable row for one wish-list country (or the empty “add” row). Used inside the [wish list editor](wish-list-editor.md).

## Modes

### `item`

- **Row 1:** [country dropdown](country-dropdown.md) (required, not clearable). Host passes a country list that excludes other draft codes (current code still included).
- **Row 2:** Description textarea with [character count label](char-count-label.md) titled **Description**, `maxLength` **500**. Plain text (not Markdown-rendered). Placeholder: optional why-this-country copy.
- **Right side:** delete button (X) then a tall, narrow drag handlebar (reorder). Tooltip on delete: “Click to remove from wish list”. Tooltip on handle: “Drag to reorder”.

Callbacks: `onChange({ countryCode, description })`, `onDelete`, drag events via `onDragStart` / host wiring on the handle.

### `add`

- Same country + description controls.
- **Add** button instead of delete; no drag handle.
- **Add** disabled until a country is selected and that code is not already on the list.
- On Add: emit `onAdd({ countryCode, description })`; host clears selection via `clear()` / remount.

## Component

Implemented as `Components/wish-list-editor-cell` (`createWishListEditorCell`).
