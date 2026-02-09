# User interface

This document describes the application's user interface in reasonable detail. The exact page structure is described in [Page structure](#page-structure), from top to bottom. Sufficient padding space should be in between the sections.

## UI routing

If html fragment #s=<share-token> is present, a shared visit list will be retrieved and displayed, see @api.md. In this case the "country visits list" is fetched from another user. This is called shared visit list routing mode.

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

Any tooltips should be represented as a custom component instead of any "alt" text etc. The component should mainly be placed on top of the component that the tooltip belongs to, but if it wont fit, it should be placed on the side where there is room. The color theme of the tooltip component must match the look and feel of the rest of the application.

## Page structure

Top bar: name of logged in user + avatar image, if available. Login / Log out buttons. The top bar shall have some padding on its right side to separate it from the page edge.

If showing a shared visits list, a "Home" button is displayed to the left of other top bar contents, with ample padding. Pressing this will remove the html fragment from the URL and show the normal page routing. This button shall not be shown in normal page routing mode.

---

If not logged in, this section is not visible.

This section has several possible representation modes, each a "tab" which - depending on the selection in the tab control mentioned below - uses up the entire space of the section, ie. only one representation mode (or "tab") is visible at any given time.

**Tab 1:** Alphabetical list

This section shows a list of visited countries with section title "Your visited countries". Below, a flowing grid of "country cells", maximum 3 cells per row. When not enough horizontal space, the layout should show only 1 or 2 cells in a row. If no visited countries are added yet, the placeholder text saying "No visited countries yet" should be shown with a slight grayed out tint.

This list of countries will be unique by country code, ie. it will show no duplicates. The countries will be sorted to alphabetical order.

After the section title there will be a button called "Edit" which, when pressed, will:

- Turn into "Done" button. Tooltip for Done button should say "Click to complete editing".
- While it is in edit state (Done button showing), the country cells shall have a "X" delete button on their right side. Pressing this will trigger DELETE /visits/id API call. Also, while in edit mode, the country cells list shall NOT be unique; instead it will show all the visits, and the country cells shall display the visit time for each one to distinguish them from one another. The delete button shall have a thin red border and use a bold / thick X mark. The visit time shall be shown under the country name in a slightly grayed color and thin font. It should fit comfortably in the cell and not get clipped. The delete button should have tooltip saying "Click to delete this visit".
- When "Done" button is pressed, it turns back into "Edit" button and hides the X buttons from country cells. The list turns back into a unique list of countries by their country code.
- Deletion of a country visit shall be animated, it. the country cell shall disappear with a fade to alpha = 0 animation.
- The deletion (if successful) API call shall not be followed by a new GET /visits call; instead the in-memory list shall be updated to reflect the removal.
- The transformation between an unique / non-unique lists shall be animated as well.
- In "Edit" state the button's tooltip should say "Click to edit the visits list".

Edit mode will not be available when in shared visit list routing mode; instead, a large centered "Home" button will be placed under the country list. Its function will match the Home button in the top bar.

**Tab 2:** Country lists by continent

Similar listing to what Tab 1 describes but the countries are listed under 'subtitles' representing each possible content. Continents are listed in alphabetical order as well as the countries within them. Each continent gets a title with the continent name (and a country count in parenthesis) and under it, the list of countries. The continent subsections are separated by a reasonable amount of vertical padding.

---

Tabbed control (with Tab 1 being the default selection) which lists the selectable tabs by their names:

- "Alphabetical"
- "By continent"

Clicking on a tab selects that tab and displays the corresponding content above. The tab control shall take as much horizontal space as the list control above it.

---

If not logged in, this section is not visible. If viewing a shared visit list, this section is not visible either.

This section holds the controls to add a new visited country.

- A drop-down list of all available countries. This drop-down list shall be a custom component; the items in the list shall be similar country cells as in the above list but thinner so that they wont take up space too much in the list. The list must be searchable; the search box will filter the list when characters are typed in it. The filtering of this list will be animated. When "closed", this component is a text input with placeholder text "Select country". When the text input is clicked, the list of countries opens underneath it and the input box becomes selected and can be used as the filter for country names. When ESC is pressed or the page is clicked outside of the selection box, the selection box will become "closed" again.

- "Visit time" input - a data input system. It must be possible to only input a year (in which case month = 1, day = 1), or year + month (in which case day = 1), or the entire date. Visit time is optional; if year is not specified, VisitTime shall be set to nil. These controls are located to the right of the country selection drop-down, vertically aligned so that everything is perfectly centered at the same level. There must be reasonable padding between the drop-down and the inputs. The year box shall be wide enough to comfortably contain 4 digits and placeholder text "Year". There shall be nothing extra in the box; no add/substract controls. Input must be validated; only values between 1900 and the current year may be entered. The month box should be a dropdown with month names; initial value shall be "Select month..". The day box shall be like year box but with placeholder text "Day". Day input must be validated to be a valid day number within the selected year/month. If the year value is given and the values for month / day have not been set, set them to their default values of January and 1.

- Add button which shall be inline with all the other controls in this section, as the rightmost one.

- When a visit is successfully added via an API call, the frontend shall not issue a new GET /visits API call, but instead modify the in-memory list and update the UI. The new visits should appear with a alpha 0->1 animation in the list of country cells.

---

If not logged in, this section is not visible.

This section provides a sharing feature. The UI presents a read-only input box which is populated to a Share URL. The URL is formed from the current site address + HTML fragment value of "#s=<share-token>" where `share-token` is the `ShareToken` value received in the GET /visits call. To the right of this input box is a button with a icon for share/copy and the text "Copy". Pressing this button copies the Share URL onto the system clipboard and displays a success toast announcing "The Share URL was copied to the clipboard". The tooltip text for the button should say "Copy Share URL". Under these controls is a text explaining that this Share URL is permanent and can be shared to friends to allow them to see your country list and that pressing the Copy button will copy the URL to your system clipboard.
