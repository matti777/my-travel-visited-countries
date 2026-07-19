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
- `.svgMap-map-wrapper` fills the map shell (zoom/pan clip at shell edges). After create, svg-pan-zoom `resize` / `fit` / `center` align the Mercator content so its vertical center matches the shell’s center Y (full width via fit-to-width).
- Zoom / pan / reset via svgMap controls.
- Hover tooltips: flag, title, visit list; media links call `onViewMediaUrl` when present.

## Related

- [visits-globe-component.md](visits-globe-component.md) — 3D counterpart
- Map tab composition: `Components/visit-list-map-shell`

