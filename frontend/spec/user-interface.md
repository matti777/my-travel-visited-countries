# User interface

This document describes the application's user interface in reasonable detail. The exact page structure is described in [Page structure](#page-structure), from top to bottom. Sufficient padding space should be in between the sections.

## General look and feel

The UI must work properly both on desktop and mobile browsers.

The application is about travel. The web application's background should display faded images of travel destinations such as snowy mountains, turquise seas, tropical beaches, coral reef, dense jungles, deserts, ancient ruins + pyramids, trains, ships and so on.

The color scheme should have some light turquoise.

The custom font should be **Roboto Condensed**, available as Google Font.

Buttons should have slightly rounded corners and a thin border.

The "country cells" (UI element depicting a country - both available one as well as a visited one - should display the country flag on the left and the country name on the right. The cells should be of constant height and width regardless of the country name's length.

Besides the top bar, the page content should be centered.

All animations shall have a duration of 0.4 seconds.

## Page structure

Top bar: name of logged in user + avatar image, if available. LOGIN / LOG OUT buttons. The top bar shall have some padding on its right side to separate it from the page edge.

---

If logged in, list of visited your countries with section title "Your visited countries". Below, a flowing grid of "country cells", maximum 3 cells per row. When not enough horizontal space, the layout should show only 1 or 2 cells in a row. If no visited countries are added yet, the placeholder text saying "No visited countries yet" should be shown with a slight grayed out tint.

This list of countries will be unique by country code, ie. it will show no duplicates.

After the section title there will be a button called "EDIT" which, when pressed, will:

- Turn into "DONE" button
- While it is in edit state (DONE button showing), the country cells shall have a "X" delete button on their right side. Pressing this will trigger DELETE /visits/id API call. Also, while in edit mode, the country cells list shall NOT be unique; instead it will show all the visits, and the country cells shall display the visit time for each one to distinguish them from one another. The delete button shall have a thin red border and use a bold / thick X mark. The visit time shall be shown under the country name in a slightly grayed color and thing font. It should fit comfortably in the cell and not get clipped.
- When "DONE" button is pressed, it turns back into "EDIT" button and hides the X buttons from country cells. The list turns back into a unique list of countries by their country code.
- Deletion of a country visit shall be animated, it. the country cell shall disappear with a fade to alpha = 0 animation.
- The deletion (if successful) API call shall not be followed by a new GET /visits call; instead the in-memory list shall be updated to reflect the removal.
- The transformation between an unique / non-unique lists shall be animated as well.

---

If logged in, the controls to add a new visited country. A drop-down list of all available countries. This drop-down list shall be a custom component; the items in the list shall be similar country cells as in the above list but thinner so that they wont take up space too much in the list. The list must be searchable; the search box will filter the list when characters are typed in it.

Optional "Visit time" input - a data input system. It must be possible to only input a year (in which case month = 1, day = 1), or year + month (in which case day = 1), or the entire date.

When a visit is successfully added via an API call, the frontend shall not issue a new GET /visits API call, but instead modify the in-memory list and update the UI. The new visits should appear with a alpha 0->1 animation in the list of country cells.
