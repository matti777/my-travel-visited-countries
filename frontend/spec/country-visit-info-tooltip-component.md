# Country Visit Info Tooltip component

Hover content for a visit card on the **By continent** and **Timeline** tabs when **not** in edit mode. Placement and show/hide behavior use the shared tooltip shell (`Components/tooltip`).

## Layout constraint

The tooltip must always fit on screen vertically. Its total height must not exceed **90%** of the viewport height. If unconstrained content would exceed that, limit the height of the **Notes** markdown area (scroll overflow inside Notes) so tags and the media hint remain fully visible and the tooltip still fits within that 90% budget.

## Content (top to bottom)

Omit any section that has nothing to show. If notes, tags, and `MediaURL` are all absent, do not attach a tooltip. On shared visit lists, the API already filters those fields by the owner's sharing settings (`ShareNotes`, `ShareTags`, `ShareMediaURL`); when nothing remains for a visit, do not attach a tooltip.

1. **Notes** — when the visit has non-empty notes: render as Markdown (sanitized HTML). Place this block at the **top** of the tooltip with a **distinct background** from the rest of the tooltip body (teal tint at half the previous opacity so it stays subtle). Give it a **2px dashed** border in the pre-lighten tint color, **8px** border radius, and **5px** inset from the tooltip outer edges so the dashed box does not flush against the shell.
2. **Tags** — when the visit has tags: show them as pills using the same stylings as the [tag editor component](tag-editor-component.md). No section title.
3. **Media hint** — when `MediaURL` is present: a short line reading "Click to view attached media".

## Edit mode

While the visit list is in edit mode, this component is **not** used. The card uses a plain-text tooltip ("Click to edit this visit") instead; see [user-interface.md](user-interface.md).

