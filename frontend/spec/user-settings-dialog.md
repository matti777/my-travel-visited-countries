# User settings dialog

Modal for editing the logged-in user's sharing settings (`Settings.Sharing` in data-models.md).

## Presentation

Centered popup over a dark overlay, using the shared modal shell (`Components/modal`) so show/hide uses the same appear/disappear animations as other dialogs (e.g. edit visit). Panel content uses a thin border and padding similar to the [country visit editor](country-visit-editor-component.md). The dialog must fit within the viewport on desktop and mobile (including safe areas); title and action buttons stay visible while the form area may scroll if needed. Layout of checkboxes and buttons must not collapse or overflow horizontally.

## Opening

Opened from the top bar by clicking the logged-in user's name or avatar. On open, the dialog calls **GET /settings** and populates the controls. Controls stay disabled until that load completes.

## Controls

- Checkbox: share media URLs on shared visit lists (`shareMediaUrl`)
- Checkbox: share notes on shared visit lists (`shareNotes`)
- Checkbox: share tags on shared visit lists (`shareTags`)
- **Save settings** — left-aligned under the checkboxes (same placement/styling pattern as **Save visit** / **Add visit** in the visit editor). Calls **PUT /settings** with all three flags; on success closes the dialog (no extra GET). On auth failure, session handling matches other authenticated mutations.
- **Close without saving** — secondary (outline) button in the modal footer (same pattern as the edit-visit dialog). Dismisses without writing. Clicking outside the panel also dismisses without saving. **Save settings** is the primary (filled) action.

Checkboxes are custom-styled (larger hit target, turquoise border/fill, clear tick) to match the app color scheme.

## Component

Implemented as `Components/user-settings-dialog`.
