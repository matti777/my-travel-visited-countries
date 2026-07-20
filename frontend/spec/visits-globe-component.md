# Visits Globe component (3D)

Autonomous 3D globe for visited countries. Implemented in `src/components/visits-globe/` (`createVisitsGlobe`). Uses **globe.gl** (MIT). Independent of the Map tab shell; any caller can mount it.

Shared fill colors and tooltip DOM live in `src/components/visits-map-shared/`.

## API

```ts
createVisitsGlobe(parent: HTMLElement, options: VisitsVizOptions): VisitsVizHandle
```

Same `VisitsVizOptions` as [visits-map-component.md](visits-map-component.md). `dispose()` tears down WebGL, observers, and DOM.

## Lazy loading

Shows a slight centered spinner until globe.gl, GeoJSON, and the WebGL scene are ready.

`globe.gl`, GeoJSON, and earth textures are loaded **inside** `createVisitsGlobe` (dynamic `import` + `fetch`). Three.js is pulled in with this module (for pin meshes) but not the initial page bundle; prefer also dynamic-importing this module from the caller (as the Map shell does).

## Rendering

- Surface: `public/assets/globe/earth-blue-marble.jpg`
- Terrain bump: `public/assets/globe/earth-topology.png`
- Country shapes: `public/assets/globe/ne_110m_admin_0_countries.geojson` (Natural Earth 110m)
- Transparent background (page shows through)
- Visited countries only: extruded polygons (`polygonAltitude` ~0.02) colored by continent scheme at **alpha 0.3** (earth texture shows through); sides slightly darker at the same alpha. Hovered country (polygon or pin) uses **alpha 0.5**.
- **Pins:** one 3D object per visited country (Globe.GL objects layer), at the feature’s area-weighted geographic center. Sharp conical tip sits on the extrusion top (`objectAltitude` = polygon altitude); shaft along local **+Z** so `objectFacesSurface` points tips toward the globe center. Metallic shaft length is **10×** extrusion height (three-globe world units, radius 100). Billboard flag head (`Sprite` from `assets/images/<flag>.jpg`). Helper: `src/components/visits-globe/pins.ts`
- Map-only overseas highlights follow the same host-visit rules as the 2D map

## Controls

- Initial camera altitude ~2.15 (slightly pulled back so the globe fits without side clipping)
- Drag rotate, scroll zoom (OrbitControls)
- Slow equatorial auto-rotate (`autoRotate`, low negative `autoRotateSpeed` for westward spin)
- Auto-rotate resumes after user interaction (OrbitControls default)
- **Fullscreen** button (upper right): on non-Apple platforms, uses the Element Fullscreen API. On iPhone/iPad (Safari Fullscreen API only partially supported for arbitrary elements), uses a fixed CSS immersive overlay covering the viewport instead. Button becomes **Exit fullscreen** while expanded; **Esc** (and the button) exit.

## Tooltips

Hovering a visited (extruded) country or its pin shows one tooltip per country, matching the 2D map: flag, name, visit list, and media links. Implemented via Globe.GL `onPolygonHover` / `onObjectHover` plus a positioned DOM overlay (`.visits-globe__tooltip`).

On touch / coarse-pointer devices, hover tips stay hidden; tap a country or pin for a sticky tooltip (same content). It appears immediately, auto-fades after 5s, and dismisses with `--animation-duration` fade on globe pan/zoom (`controls` start), another tap on empty globe, or when the Map shell unmounts / switches mode.

## Related

- [visits-map-component.md](visits-map-component.md) — 2D counterpart
- Asset provenance: `public/assets/globe/README.md`
- Map tab composition: `Components/visit-list-map-shell`


