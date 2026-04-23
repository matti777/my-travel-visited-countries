# Tag Editor Component

This component provides means to add short string "tags" to the country visit.

The tags must be lowercase ascii character only strings (regex [a-z]). Minimum tag length is 2 characters.

All control / subcomponent stylings must follow same styles used elsewhere in the app for corresponding / similar controls.

## Component controls

**Component Controls from top to bottom:**

- A custom input field (which must force input checking; all non-[a-z] characters will be dismissed and all uppercase characters be made lowercase ones). Pressing enter must create a new custom tag from the input contents. To the right of the text input there is "Add tag" button that will add the current string as a custom tag, same as pressing Enter. This button must be disabled while there is no valid input in the input field. The add button must be stylished like all other buttons in our UI. The input field must have a tooltip that states "Add tags to describe the visit. These tags can later be used in searches." The input box has "Define tags" as its placeholder value.

- A "drop-down list" of suggested tags from a hardcoded list. This list opens "from" the text input component. This list must be pre-generated and stored in the component sources; it should include 50 common tags related to travel, including but not limited to: beach, diving, skiing, mountains, ruins, jungle, desert, holiday, backpacking, trekking. When typing, the list of proposed tags must be filtered by the input field contents. If no predefined tag matches the value in the input box, this list is hidden. While the input box has focus but no text, the full list of predefined tags must be shown. Selecting an existing tag from proposed list will add that tag. The cells in this list must be stylished in similar fashion as the country list dropdown items.

- Info text under the custom input that says "You can define tags to describe your trip".

- List of tags. These are "capsules" with fully rounded corners; left and right edges are semicircles; top and bottom edge are straight lines. Each tag has a X button for removing the tag. All the tags are kept in RAM until saved by an external page / compoent. This component shall provide a clear API to fetch the current tag list.
