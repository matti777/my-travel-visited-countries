# User settings dialog

Modal for editing the logged-in user's settings (`Settings` in data-models.md): home country, Instagram username, description, and sharing flags.

## Presentation

Centered popup over a dark overlay, using the shared modal shell (`Components/modal`) so show/hide uses the same appear/disappear animations as other dialogs (e.g. edit visit). Panel content uses a thin border and padding similar to the [country visit editor](country-visit-editor.md). The dialog must fit within the viewport on desktop and mobile (including safe areas); title and action buttons stay visible while the form area may scroll if needed. Layout must not collapse or overflow horizontally.

## Opening

Opened from the own-profile page via **Edit settings** (not from the top bar). On open, the dialog calls **GET /settings** and populates the controls. Controls stay disabled until that load completes.

## Controls

- **Home country** — [country dropdown](country-dropdown.md), clearable / optional (same behavior as the visit editor country selector).
- **Instagram username** — optional text input. Leading `@` is stripped on save. Omit key on PUT to clear.
- **Description** — textarea with [character count label](char-count-label.md) titled **Free-form traveller description** (`maxLength` 1000). Markdown formatting supported (hint under the field).
- Checkbox: share media URLs on shared profiles (`shareMediaUrl`)
- Checkbox: share notes on shared visit lists (`shareNotes`)
- Checkbox: share tags on shared visit lists (`shareTags`)
- **Save settings** — left-aligned under the controls (same placement/styling pattern as **Save visit** / **Add visit**). Calls **PUT /settings** with sharing flags always present; includes `homeCountryCode` / `instagramUserName` / `description` only when set (omit key to clear). On success closes the dialog and notifies the host (`onSaved`) so the profile can refresh. On **ValidationErrors** (400 with `fields`), show a red border and error message under each matching input; clear field errors on input change. On auth failure, session handling matches other authenticated mutations.
- **Close without saving** — secondary (outline) button in the modal footer. Dismisses without writing. Clicking outside the panel also dismisses without saving. **Save settings** is the primary (filled) action.

Checkboxes are custom-styled (larger hit target, turquoise border/fill, clear tick) to match the app color scheme.

## Component

Implemented as `Components/user-settings-dialog`.
