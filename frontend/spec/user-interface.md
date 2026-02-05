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

## Page structure

Top bar: name of logged in user + avatar image, if available. LOGIN / LOG OUT buttons.

---

If logged in, list of visited your countries with title "Your visited countries". Below, a flowing grid of "country cells", maximum 3 cells per row. When not enough horizontal space, the layout should show only 1 or 2 cells in a row. If no visited countries are added yet, the placeholder text saying "No visited countries yet" should be shown with a slight grayed out tint.

---

If logged in, the controls to add a new visited country. A drop-down list of all countries, minus the ones the user has already visited (filter by country code). Optional "Visit time" input - a data input system. It must be possible to only input a year (in which case month = 1, day = 1), or year + month (in which case day = 1), or the entire date.
