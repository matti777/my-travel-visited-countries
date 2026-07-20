# User interface

This document describes the application's user interface in reasonable detail. The exact page structure is described in [Page structure](#page-structure), from top to bottom. Sufficient padding space should be in between the sections.

The name of the application is "Countries of Earth"; this should be reflected eg. as the page title.

## UI routing

If the URL path is `/share/<share-token>`, a shared profile is loaded via **GET /share/profile/<share-token>** (see [api.md](../../backend/spec/api.md)) and displayed. The public [user profile](components/user-profile.md) is shown at the top, then that user's visit list. This is called shared profile routing mode.

If the URL path is `/profile` and the user is logged in, the own [user profile](components/user-profile.md) is shown with an **Edit settings** button underneath (opens the [user settings dialog](components/user-settings-dialog.md)). Visit list, add-visit, share, and friends sections are hidden. A **Home** button in the top bar returns to normal routing. This is called own profile routing mode.

In any other case the user's own country visits list is fetched and used. This is called normal page routing mode.

## General look and feel

The UI must work properly both on desktop and mobile browsers.

The application is about travel. The web application's background should display faded images of travel destinations such as snowy mountains, turquise seas, tropical beaches, coral reef, dense jungles, deserts, ancient ruins + pyramids, trains, ships and so on.

The color scheme should have some light turquoise.

The custom font should be **Roboto Condensed**, available as Google Font.

Buttons should have slightly rounded corners and a thin border.

The "country cells" (UI element depicting a country - both available one as well as a visited one - should display the country flag on the left and the country name on the right. The cells should be of constant height and width regardless of the country name's length.

Besides the top bar, the page content should be centered.

All animations shall have a duration of 0.4 seconds.

Any input validation errors should add a red border around the input component and disable the Add button until the errors have been resolved.

Any tooltips should be represented as a custom component instead of any "alt" text etc. The component should mainly be placed on top of the component that the tooltip belongs to, but if it wont fit, it should be placed on the side where there is room. The color theme of the tooltip component must match the look and feel of the rest of the application. Visit-card hover content (notes, tags, media hint) is built by the [country visit info tooltip](components/country-visit-info-tooltip.md); placement uses the shared tooltip shell.

## Page structure

Top bar: name of logged in user + avatar image, if available. When logged in, the name and avatar are clickable (`cursor: pointer`, not a button) and navigate to `/profile` (own profile); their tooltip shows the user email with “Click to view your profile and settings” underneath. Login / Log out buttons. The top bar shall have some padding on its right side to separate it from the page edge.

If showing a shared profile or the own profile page, a "Home" button is displayed to the left of other top bar contents, with ample padding. Pressing this navigates to normal page routing (clears `/share/...` or `/profile`). This button shall not be shown in normal page routing mode.

---

If not logged in, this section is not visible.

This section has several possible representation modes, each a "tab" which - depending on the selection in the tab control mentioned below - uses up the entire space of the section, ie. only one representation mode (or "tab") is visible at any given time.

The section title shows the number of unique countries visited in parentheses. In normal page routing mode the title is **Your visited countries (N)**. In shared profile routing mode it is **&lt;user name&gt;'s visited countries (N)**, or **Shared visit list (N)** if the shared user's name is unavailable. **N** is the count of distinct country codes in the visit list (not the total number of visit rows). When a tag filter is active (see below), **N** counts only countries that have at least one visit matching the filter. On a shared profile page, the [user profile component](components/user-profile.md) is rendered above this section.

On **Alphabetical**, **By continent**, **Map**, and **Timeline** tabs (but not **Statistics**), immediately below the section title, there is a **Filter by tags** row: a text input with placeholder "Filter by tags", using the same input rules as the [tag editor component](components/tag-editor.md) (lowercase ASCII `[a-z]` only; invalid characters are stripped). When the user has entered **two or more** such characters, a **1.0 second** debounce runs (reset on each change); when it fires, the in-memory visit list is filtered so only visits that have **at least one tag** whose value **contains** the typed substring are shown (substring match). This affects the **N** in the section title, the country grids, the Timeline and By continent lists, and the Map (highlighted countries and visit tooltips). Fewer than two characters means **no** tag filter is applied. Inside the input, along the **right** edge, is a faint circular **clear** control (×) that empties the field and resets the filter **immediately** without waiting for the debounce; its tooltip reads **Clear search filter**.

**Tab 1:** Alphabetical list

This section shows a list of visited countries with section title **Your visited countries (N)** (or the shared user's equivalent, **&lt;user name&gt;'s visited countries (N)**). Below, a flowing grid of "country cells", maximum 3 cells per row. When not enough horizontal space, the layout should show only 1 or 2 cells in a row. If no visited countries are added yet, the placeholder text saying "No visited countries yet" should be shown with a slight grayed out tint.

This list of countries will be unique by country code, ie. it will show no duplicates. The countries will be sorted to alphabetical order.

On the **Alphabetical** tab, list edit mode is not started from the UI (the visit-list edit float is not shown; see below). On **By continent** and **Timeline**, a floating control (see below) provides an **Edit** button. When edit mode is active, it will:

- Show a **Done** button in that floating control (replacing **Edit**). Tooltip for Done should say "Click to complete editing".
- While it is in edit state (Done button showing), the country cells shall have a "X" delete button on their right side. Pressing this will show a "popup dialog" for confirmation, with text "Are you sure you want to delete the visit to <country name> at <visit time>?" and **No** and **Yes, delete** buttons (no separate Close control in the dialog). Pressing **Yes, delete** will trigger DELETE /visits/id API call. Also, while in edit mode, the country cells list shall NOT be unique; instead it will show all the visits, and the country cells shall display the visit time for each one to distinguish them from one another. The delete button shall have a thin red border and use a bold / thick X mark. The visit time shall be shown under the country name in a slightly grayed color and thin font. It should fit comfortably in the cell and not get clipped. The delete button should have tooltip saying "Click to delete this visit".
- When **Done** is pressed in the floating control, edit mode ends: the float shows **Edit** again (with hint text to press Edit) and the X buttons are hidden from country cells. The list returns to its non-edit presentation (for example unique-by-country on the Alphabetical tab).
- Deletion of a country visit shall be animated, it. the country cell shall disappear with a fade to alpha = 0 animation.
- The deletion (if successful) API call shall not be followed by a new GET /visits call; instead the in-memory list shall be updated to reflect the removal.
- The transformation between an unique / non-unique lists shall be animated as well.
- While not in edit mode, the floating **Edit** button's tooltip should say "Click to edit the visits list".

Edit mode will not be available when in shared profile routing mode; instead, a large centered "Home" button will be placed under the country list. Its function will match the Home button in the top bar.

**Tab 2:** Country lists by continent

Similar listing to what Tab 1 describes but the countries are listed under 'subtitles' representing each possible content. Continents are listed in alphabetical order as well as the countries within them. Each continent gets a title with the continent name (and a country count in parenthesis) and under it, the list of countries. The continent subsections are separated by a reasonable amount of vertical padding. Unlike the alphabetical list, here the countries listed are not unique, but instead each visit gets its own country cell. The visits within a country are sorted by their `VisitTime`. Here the country cells will display the time of the visit, in a similar fashion as in the edit mode. A tooltip for each cell shall read "Click to view attached media" IF `MediaURL` is present. If such a cell is clicked, the media URL should be opened in a new tab. For such a cell, the visit time text should look like a link to indicate the presence of the media url.

Hovering over a visit card (not in edit mode) shows the [country visit info tooltip](components/country-visit-info-tooltip.md).

While in edit mode, the tooltip shall show "Click to edit this visit". This will bring up a "edit visit" component, reusing [the visit editor component](components/country-visit-editor.md). It shall be presented as a "popup dialog", centered on screen, laid over the page content, with a dark layover view blocking the page content. Clicking outside of the component will close it. Standard appear/disappear animations are applied to this component. The dialog shall include a secondary (outline) button labeled **Close without saving** to dismiss without applying edits; **Save visit** remains the primary action.

**Tab 3:** Countries plotted on map

Displays visited countries on a map visualization. The 2D map and 3D globe each use the full map shell (`.visit-list-map-shell`). The 2D map’s pan/zoom viewport fills that shell; Mercator content spans the width and is vertically centered within it. A lower-right **2D | 3D** toggle switches projection (tooltips: "Flat Mercator view" / "Globe view"). **2D** is the default on load and when remounting the tab. Both modes are lazy-loaded: **2D** loads [visits-map](components/visits-map.md) (svgMap) when the Map tab mounts; **3D** loads [visits-globe](components/visits-globe.md) (globe.gl) only when first selected. A slight spinner shows while each view loads. On touch devices, the 2D map supports one-finger pan and two-finger pinch-zoom. On mobile, tapping a country shows a sticky visit tooltip (5s, fades on pan/zoom/tap-away).

If a visit listed here has a `MediaURL` set, that visit should look like a link and have a tooltip about the link like in Tab 2. It also needs to be clickable and open the link in a new tab.

Each visited country fill color should depend on the continent they are on:

- Europe: light blue
- North America: light cyan
- South America: light green
- Africa: light red
- Asia: Light yellow
- Oceania: Turquoise
- Antarctica: Icy deep blue

In 3D, visited countries are extruded polygons on a textured globe (same continent colors), with slow equatorial auto-rotate plus drag/zoom. A **Fullscreen** control (upper right) expands the globe (native fullscreen where available; CSS immersive cover on iOS/iPadOS); Esc exits. Long-press on the map shell must not select text.

In this mode the visit-list edit float is not shown (same as Alphabetical and Statistics).

**Tab 4:** Timeline

Similar list to "by continent" but instead organized by year, sorted to ascending order.

Hovering over a visit card uses the same tooltips as **Tab 2** (info tooltip when not editing; "Click to edit this visit" in edit mode), with the same functionality.

**Tab 5:** Statistics

This tab does **not** show the Filter by tags control. It displays certain statistics about the number of country visits.

A central element is "circle graph cell" which consists of the following elements:

1. A circular (clockwise) graph that represents a value 0-100% [of countries visited within a certain area]. Its thickness should be something like 1/5 of its radius. Inside this circular graph shall be a black text "<percentage> %" which shows the same value as the graph but in text. Under the circular graph element should be a text element stating the name of the area. The tooltip for the entire cell should read: "<num-visits> / <total-countries> countries visited in <area>" , eg. "3 / 20", showing number of visited countries in the area / total number of countries in the area.

There should be such a cell for each of the continents (except Antarctica) and The World which shows the count for all the countries in the world.

---

Tabbed control (with Tab 1 being the default selection) which lists the selectable tabs by their names:

- "Alphabetical"
- "By continent"
- "Map"
- "Timeline"
- "Statistics"

Clicking on a tab selects that tab and displays the corresponding content above. The tab control shall take as much horizontal space as the list control above it. When the tabs do not fit on one row (narrow viewports), they wrap onto additional rows; each tab label stays on a single line.

---

On **By continent** and **Timeline** tabs (logged-in, not shared view), a floating visit-list edit component is shown.

- **Not in edit mode:** fixed on the **right** side of the viewport (desktop), roughly one third of the viewport height from the top, with padding from the right edge. It shows the text "Press Edit to edit the list of your visits." and an **Edit** button (tooltip: "Click to edit the visits list"). Pressing **Edit** enters edit mode.

- **In edit mode:** same placement on desktop. It shows "Click Done when finished with editing your visits." and a **Done** button (tooltip: "Click to complete editing"). Pressing **Done** leaves edit mode and returns to the idle copy and **Edit** button above.

On **narrow viewports** (mobile), this component is fixed to the **bottom** of the screen, **horizontally centered**, so it does not cover the visit list.

It has a thin border, slightly rounded corners and a visible drop shadow. It fades in when it becomes relevant and fades out when switching to a tab that does not use it (or when logging out). The page under the component remains interactable.

While a confirmation dialog is open (for example delete visit or remove friend), the same full-screen dark overlay used by that dialog shall stack above this floating component so the float appears dimmed behind the overlay and cannot receive clicks until the dialog is dismissed.

---

If not logged in, this section is not visible. If viewing a shared profile or own profile page, this section is not visible either.

This section holds the controls to add a new visited country. This is handled by [this reusable component](components/country-visit-editor.md).

---

If not logged in OR not viewing another user's shared profile, this section is not visible.

If the user (by their `ShareToken`) is not yet found in the current user's friends list (see local variable holding it), the UI should display a text "Would you like to add <name> to your friends list?" and a "Add friend" button. Otherwise the UI should say "<name> is in your friend list.".

Clicking "Add friend" button should attempt to create the friend in the backend using the api call mentioned in [api.md](../../backend/spec/api.md). If successful, it should update the friend list variable automatically _without_ an extra API call to GET /friends.

---

If not logged in OR viewing another user's shared profile OR on the own profile page, this section is not visible.

This section provides a sharing feature. The UI presents a read-only input box which is populated to a Share URL. The URL is formed from the current site origin + path `/share/<share-token>` (with optional base path when the app is not deployed at `/`) where `share-token` is the `ShareToken` value received in the GET /visits call. To the right of this input box is a button with a icon for share/copy and the text "Copy". Pressing this button copies the Share URL onto the system clipboard and displays a success toast announcing "The Share URL was copied to the clipboard". The tooltip text for the button should say "Copy Share URL". Under these controls is a text explaining that this Share URL is permanent and can be shared to friends to allow them to see your country list and that pressing the Copy button will copy the URL to your system clipboard.

---

If not logged in, this section is not visible.

The UI shall show a list of friends for the current user. The "friend cells" should look similar to the country cells, except they should be much wider and not show multiple in one row, instead all of them should be placed in a single top to bottom column. Clicking a friend cell should open their shared visits set using their `ShareToken`. Each friend cell should have a delete button, similar to country cells in edit mode, for deleting a friend. The API call to DELETE /friends - if successful - should be followed by manual removal of that friend from the local variable. No extra API call to GET /friends shall be made. The delete button shows the same confirmation dialog pattern as deleting a country visit (full-screen dark overlay, **No** and a primary confirm button—**Yes, remove**—no separate Close control), with message text "Are you sure you want to remove friend <name>?".

---

If logged in, this section is not visible.

For users who have not logged in, the basic view should present a service "splash screen".

On top and centered, there should be a title label with the name of the service, "Countries of Earth". This title should be in large cursive font. It should have a top-to-bottom color gradient from black to dark gray. The effect should be subtle but noticeable. The title label should have a slight soft drop shadow. The font for the title should be "Dancing Script" from Google Fonts. The title MUST fit on screen horizontally also on mobile resolutions, with enough padding on each side to look good.

Below it, the content: a welcome message with a title and a descriptive text chapter or two about the service. There should be travel related (sceneries from beaches, palm trees, mountains, coral reefs, ancient ruins etc.) images on the page. The images should look like slightly faded photographs and have irregular edges with transparency.

The welcome text should indicate that this is a free online tool for keeping track of one's visited countries and that it allows for adding media links and similar metadata.

Centered on the bottom should be a large "Login" button whose functionality must copy the one in the top bar.

--

At the very bottom of the page there are links to About, Privacy Policy, and Terms of Service (About leftmost). The About page (`/about.html`) welcomes new users with plain-language copy and the same travel polaroids as the logged-out splash.



