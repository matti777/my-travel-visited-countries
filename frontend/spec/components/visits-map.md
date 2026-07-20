# Visits Map component (2D)

Autonomous flat Mercator world map for visited countries. Implemented in `src/components/visits-map/` (`createVisitsMap`). Uses **svgMap**. Independent of the Map tab shell; any caller can mount it.

Shared fill colors and tooltip DOM live in `src/components/visits-map-shared/`.

## API

```ts
createVisitsMap(parent: HTMLElement, options: VisitsVizOptions): VisitsVizHandle
```

`VisitsVizOptions`: `countryCodes`, `countries`, `visits`, `baseUrl`, optional `height`, optional `onViewMediaUrl`.

`VisitsVizHandle.dispose()` removes the map from the DOM.

## Lazy loading

`svgMap` is loaded via dynamic `import` inside the Map shell when 2D mounts (and the shell itself is dynamic-imported when the Map tab is selected). Importing this module alone pulls svgMap; prefer loading it only when the Map tab needs 2D.

## Behavior

- Visited codes (and map-only overseas territories whose host is visited) use the continent fill scheme from [user-interface.md](user-interface.md).
- Unvisited sovereign countries: light gray `#E2E2E2`.
- Disputed map-only without `visitSourceCode` (XK, EH, PS): darkest gray `#2c2c2c` — see [frontend-module.md](frontend-module.md) / `MAP_ONLY_REGIONS`.
- Map creation waits until the container has non-zero size (avoids svgMap `SVGMatrix` inverse errors when height is not yet laid out).
- `.svgMap-map-wrapper` fills the map shell (zoom/pan clip at shell edges). After create, svg-pan-zoom `resize` / `fit` / `center` place the equator on the shell’s center Y (full width via fit-to-width). Replaces svgMap’s `beforePan` with the same gutter math but ordered min/max so overview Y is not forced to the bottom (stock clamp inverts).
- Touch: custom capture-phase pan + pinch-zoom (svg-pan-zoom has no built-in pinch); `touch-action: none` on the wrapper. Mouse wheel / zoom buttons / double-tap unchanged.
- Slight loading spinner until the map is aligned.
- Zoom / pan / reset via svgMap controls.
- Hover tooltips (fine pointer): flag, title, visit list; media links call `onViewMediaUrl` when present.
- Mobile sticky tooltips (`hover: none` / coarse pointer): tap a country to show the same tooltip immediately; auto-fades after 5s (`--animation-duration`); dismisses with the same fade on pan, pinch-zoom, or another tap on empty map. Cleared when the Map shell unmounts / switches 2D↔3D.

## Related

- [visits-globe.md](visits-globe.md) — 3D counterpart
- Map tab composition: `Components/visit-list-map-shell`


