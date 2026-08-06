# Modal sticky footer

Shared action row for editor dialogs that keep Save / Close outside a scrollable bordered body (Settings, Wish list, Edit visit).

## Presentation

- One horizontal row: **primary** (left) and **secondary** (right).
- Buttons stay on one row on narrow viewports (do not stack or stretch like confirm-dialog actions).
- Each button is only as wide as its label plus padding (`fit-content`).
- Primary uses the shared filled turquoise (`.primary`) look; secondary uses the outline (`.secondary` / `.app-confirm__btn`) look.
- Disabled primary uses opacity `0.55` (same as `.primary:disabled`).

## Usage

Pass `element` into `openModal` as `footer` with `footerPlain: true` so the modal shell keeps the row sticky while the body scrolls. Labels and click handlers are supplied by the host; returned `primaryButton` / `secondaryButton` refs are used to toggle `disabled` (e.g. dirty-state Save).

Typical labels: Save on the left, **Close without saving** on the right.

## Component

Implemented as `Components/modal-sticky-footer` (`createModalStickyFooter`).
