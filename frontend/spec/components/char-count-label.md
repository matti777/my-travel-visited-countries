# Character count label component

Reusable label row with a live `[current / max]` counter. Used for visit notes in the [country visit editor](country-visit-editor.md) and for Description in the [user settings dialog](user-settings-dialog.md).

## Presentation

- Host supplies a fixed title prefix (e.g. `Free-form trip notes` or `Description`) and a configurable `maxLength`.
- Display: `<title> [x / max]` where only the `[x / max]` segment is colored.
- Color (linear RGB interpolation): **green** at **0%** of max, **yellow** at **75%**, **deep red** at **100%**.
- Host calls an update method whenever the associated field’s length changes.

## Component

Implemented as `Components/char-count-label` (`createCharCountLabel`).
