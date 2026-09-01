# WishListCell

Read-only display of one wish-list country. Used in the [user profile](user-profile.md) ordered wish list (not the editor) and for Top countries rows (flag + name + average score).

## Presentation

- **Country:** flag image + country name (same flag size/layout language as the profile **Home country** row). When shown in a profile ordered list, the list marker aligns with this name row.
- **Description** (optional): Markdown rendered to sanitized HTML (`marked` + DOMPurify). Omitted when empty.
- **Score** (optional): trailing shared visit score display (star + `scoreToColor`); used for Top countries with average-rating tooltip. Layout keeps name and score from colliding on narrow screens.

No edit, delete, or drag controls. Distinct from [WishListEditorCell](wish-list-editor-cell.md).

## Props

`countryCode`, `countryName`, `baseUrl`, optional `description`, optional `className`, optional `score`, optional `scoreIsAverage`.

## Component

Implemented as `Components/wish-list-cell` (`createWishListCell`).
