# Country dropdown component

Searchable country selector used by the [country visit editor](country-visit-editor.md) and the [user settings dialog](user-settings-dialog.md) (home country).

## Behavior

- Closed state: a text input with placeholder **"Select country"**.
- Open: click/focus the input; a list of compact [country cells](user-interface.md) appears underneath. The input filters by country name or code; filtering is animated.
- Close: ESC or click outside the control.
- Selecting an item sets the input to the country name and notifies the host via `onSelect(countryCode)`.

## Optional / clearable

When `clearable` is enabled (home country in settings), the host may treat an empty selection as unset. Clearing leaves no country selected (input empty / placeholder). Visit editor keeps a required selection (`clearable` off).

## Component

Implemented as `Components/country-dropdown` (`createCountryDropdown`).
