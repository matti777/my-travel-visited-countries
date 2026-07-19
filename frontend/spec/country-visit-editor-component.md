# Country Visit editor component

This component can be used either to add ("Add a visit to a country") or edit ("Edit your visit to <country name>") a visit to a country.

## Component Structure

A thin border exists around the component.

**The controls in the component are:**

- A drop-down list of all available countries. This drop-down list shall be a custom component; the items in the list shall be similar country cells as in the above list but thinner so that they wont take up space too much in the list. The list must be searchable; the search box will filter the list when characters are typed in it. The filtering of this list will be animated. When "closed", this component is a text input with placeholder text "Select country". When the text input is clicked, the list of countries opens underneath it and the input box becomes selected and can be used as the filter for country names. When ESC is pressed or the page is clicked outside of the selection box, the selection box will become "closed" again.

- "Visit time" input - a textbox with placeholder text "Enter visit date". When clicked, this control opens up a date picker component, prepopulated to the current date. This date picker must allow entering the year as text input instead of using a picker component. No time component is shown. The input must be validated as `VisitTime` (see @data-models.md). It is a mandatory field so the Add button should be disabled until a valid value has been entered.

- Media URL input - a textbox with placeholder text "Optional media URL". Frontend must validate this input to be a well-formed URL. An explanatory text underneath should explain that this can be used to attach media such as picture collection / video url to material taken on the trip.

- Free-form trip notes - a textarea between Media URL and Tags. Title above the field: `Free-form trip notes [x / 1000]` where `x` is the current character count; only the `[x / 1000]` portion changes color (green at 0, yellow at 750, deep red at 1000; linear RGB interpolation between those points), updated on every character change. Placeholder: `Optional trip notes; itinerary, best sights, people met, et cetera. Markdown formatting supported!`. Default height is 4 rows; vertically resizable up to 10 rows of text (layout grows/shrinks with the textarea); not resizable on mobile. Hard limit 1000 characters (truncate on paste/input); Add/Save stays disabled if length somehow exceeds 1000. Notes are only shown in this add/edit editor (not elsewhere in the UI yet).

- [Tag editor component](tag-editor-component.md)

- "Add visit" (when creating new visit) / "Save visit" (when editing existing one) button which shall be under (left-aligned) all the other controls in this section.

- When a visit is successfully added via an API call, the frontend shall not issue a new GET /visits API call, but instead modify the in-memory list and update the UI. The new visits should appear with a alpha 0->1 animation in the list of country cells.

