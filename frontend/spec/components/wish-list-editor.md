# Wish list editor

Modal for editing the logged-in user's wish list (`GET` / `PUT /wishlist`). Opened from the own-profile page via **Edit Wish List**.

## Presentation

Centered popup over a dark overlay using `Components/modal` (same appear/disappear animations as settings). Title: **Wish list**. Panel max height **90%** of the viewport; body scrolls when content exceeds that. Footer actions stay visible. Fits desktop and mobile viewports.

## Opening

On open, calls **GET /wishlist** and builds a local draft. Controls stay disabled until load completes. On load failure, toast + close (401 uses the same session handling as settings).

## List

Renders ordered [WishListEditorCell](wish-list-editor-cell.md) rows (`item` mode). When `draft.length < 10`, one `add` cell at the bottom.

- **Add:** appends to the draft and clears the add form; hidden when the list already has 10 entries.
- **Delete:** removes from the draft immediately (no confirm).
- **Reorder:** HTML5 drag from the cell handle; dropping splices the draft and re-renders with **0.4s** transitions.
- Country dropdowns exclude codes already used by other draft rows.

## Dirty state

**Save changes** is disabled until the draft differs from the loaded snapshot (order, country codes, descriptions). Typing in the empty add row does not mark dirty until **Add** commits an entry.

## Actions

- **Save changes** (primary): **PUT /wishlist** with the full draft. On success: success toast, close. On 401: session handling + close. Other errors: toast, keep open.
- **Close without saving** (secondary): discard draft and close. Outside click also discards.

Client-side checks before save: at most 10 entries, unique country codes, descriptions ≤ 500 characters.

## Component

Implemented as `Components/wish-list-editor` (`openWishListEditor`).
