# User profile component

Reusable read-only traveller profile. Used on the own `/profile` page and at the top of a shared profile (`/share/<token>`).

## Layout

- Horizontally centered avatar image (when `imageUrl` is present).
- Left-aligned fields below:
  - **Traveller name:** `<name>`
  - **Home country:** country name + flag image; empty value when unset
  - **Instagram:** when `instagramUserName` is set — Instagram logo + `@username` as a link that opens the Instagram app on mobile if installed, otherwise the Instagram website profile. Tooltip: "Open Instagram profile". Row omitted when unset.
  - **Countries visited:** unique country count
  - **Description:** free-form Markdown (sanitized HTML). When set, shown in a box with a dashed border, rounded corners, and a slightly different background from the app background. Empty when unset.

## Props

`name`, optional `imageUrl`, optional `homeCountryCode`, optional `instagramUserName`, `countriesVisited`, `countries` (for name/flag lookup), `baseUrl`.

## Host actions

Own-profile host (`app.ts`) places an **Edit settings** button under this component. Shared-profile host does not.

## Component

Implemented as `Components/user-profile` (`createUserProfile`). Supports refreshing displayed fields after settings save (e.g. `update` / remount).
