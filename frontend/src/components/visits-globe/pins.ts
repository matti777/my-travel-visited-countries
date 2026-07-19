import type { Object3D } from "three";
import * as THREE from "three";
import { MAP_ONLY_REGIONS } from "../../map-regions";

/** Matches three-globe’s internal sphere radius (world units). */
export const GLOBE_RADIUS = 100;

/** Polygon extrusion height in globe-radius units (shared with globe init). */
export const POLYGON_ALTITUDE = 0.02;

/** Full pin shaft (tip + stem) = 4× country extrusion height. */
export const PIN_LENGTH_ALTITUDE = 4 * POLYGON_ALTITUDE;

const PIN_WORLD_LENGTH = PIN_LENGTH_ALTITUDE * GLOBE_RADIUS;
const TIP_FRAC = 0.18;
const TIP_HEIGHT = PIN_WORLD_LENGTH * TIP_FRAC;
const STEM_HEIGHT = PIN_WORLD_LENGTH * (1 - TIP_FRAC);
const STEM_RADIUS = 0.002 * GLOBE_RADIUS;
const TIP_RADIUS = STEM_RADIUS * 1.15;
const PIN_FLAG_WIDTH = 0.038 * GLOBE_RADIUS;

const STEM_COLOR = 0xc0c4c8;
const STEM_METALNESS = 0.95;
const STEM_ROUGHNESS = 0.25;

export interface PinDatum {
  lat: number;
  lng: number;
  iso: string;
  flagCode: string;
}

interface GeoFeatureLike {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
}

type Ring = number[][];

function flagCodeForIso(iso: string): string {
  const mapOnly = MAP_ONLY_REGIONS[iso];
  if (mapOnly) return mapOnly.flagCode.toLowerCase();
  return iso.toLowerCase();
}

/** Area-weighted centroid of a closed GeoJSON ring (lng/lat). */
function ringCentroid(ring: Ring): { lng: number; lat: number; area: number } {
  if (ring.length < 3) {
    const [lng = 0, lat = 0] = ring[0] ?? [];
    return { lng, lat, area: 0 };
  }

  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  const n = ring.length - 1;

  for (let i = 0; i < n; i++) {
    const x0 = ring[i][0];
    const y0 = ring[i][1];
    const x1 = ring[i + 1][0];
    const y1 = ring[i + 1][1];
    const a = x0 * y1 - x1 * y0;
    twiceArea += a;
    cx += (x0 + x1) * a;
    cy += (y0 + y1) * a;
  }

  const area = twiceArea / 2;
  if (Math.abs(area) < 1e-14) {
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < n; i++) {
      sx += ring[i][0];
      sy += ring[i][1];
    }
    return { lng: sx / n, lat: sy / n, area: 0 };
  }

  return {
    lng: cx / (6 * area),
    lat: cy / (6 * area),
    area: Math.abs(area),
  };
}

/** Geographic center of a Polygon or MultiPolygon (all exterior rings). */
export function featureCenterLatLng(geometry: {
  type: string;
  coordinates: unknown;
}): { lat: number; lng: number } | null {
  const exteriors: Ring[] = [];

  if (geometry.type === "Polygon") {
    const coords = geometry.coordinates as Ring[];
    if (coords[0]) exteriors.push(coords[0]);
  } else if (geometry.type === "MultiPolygon") {
    const coords = geometry.coordinates as Ring[][];
    for (const poly of coords) {
      if (poly[0]) exteriors.push(poly[0]);
    }
  } else {
    return null;
  }

  if (exteriors.length === 0) return null;

  let sumArea = 0;
  let sumLng = 0;
  let sumLat = 0;

  for (const ring of exteriors) {
    const c = ringCentroid(ring);
    const w = c.area > 0 ? c.area : 1;
    sumArea += w;
    sumLng += c.lng * w;
    sumLat += c.lat * w;
  }

  if (sumArea <= 0) return null;
  return { lat: sumLat / sumArea, lng: sumLng / sumArea };
}

export function buildPinData(features: GeoFeatureLike[]): PinDatum[] {
  const pins: PinDatum[] = [];

  for (const f of features) {
    const iso = (typeof f.properties.__iso === "string" && f.properties.__iso) || null;
    if (!iso) continue;

    const center = featureCenterLatLng(f.geometry);
    if (!center) continue;

    pins.push({
      lat: center.lat,
      lng: center.lng,
      iso,
      flagCode: flagCodeForIso(iso),
    });
  }

  return pins;
}

export interface PinResources {
  createPinObject: (datum: object) => Object3D;
  dispose: () => void;
}

/**
 * Metallic stem + conical tip + flag billboard.
 * Built along local +Y then rotated so the shaft lies on +Z: three-globe’s
 * `objectFacesSurface` aligns local +Z radially outward (tip toward globe center).
 * Tip point is at the origin so `objectAltitude` on the extrusion top places it flush.
 * Geometry is in three-globe world units (× GLOBE_RADIUS).
 */
export function createPinResources(baseUrl: string): PinResources {
  const loader = new THREE.TextureLoader();

  /* Cone tip at +Y by default; flip so tip points toward -Y before Z remap. */
  const tipGeom = new THREE.ConeGeometry(TIP_RADIUS, TIP_HEIGHT, 16);
  tipGeom.rotateX(Math.PI);

  const stemGeom = new THREE.CylinderGeometry(STEM_RADIUS, STEM_RADIUS, STEM_HEIGHT, 12);

  const metalMat = new THREE.MeshStandardMaterial({
    color: STEM_COLOR,
    metalness: STEM_METALNESS,
    roughness: STEM_ROUGHNESS,
  });

  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [metalMat];
  const geometries: THREE.BufferGeometry[] = [tipGeom, stemGeom];

  const createPinObject = (datum: object): Object3D => {
    const pin = datum as PinDatum;
    const group = new THREE.Group();

    const tip = new THREE.Mesh(tipGeom, metalMat);
    /* Tip point at y=0; cone extends along +Y (mapped to +Z below). */
    tip.position.y = TIP_HEIGHT / 2;
    group.add(tip);

    const stem = new THREE.Mesh(stemGeom, metalMat);
    stem.position.y = TIP_HEIGHT + STEM_HEIGHT / 2;
    group.add(stem);

    const flagUrl = `${baseUrl}/assets/images/${pin.flagCode}.jpg`;
    const spriteMat = new THREE.SpriteMaterial({
      transparent: true,
      depthTest: true,
    });
    materials.push(spriteMat);

    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.y = TIP_HEIGHT + STEM_HEIGHT;
    sprite.scale.set(PIN_FLAG_WIDTH, PIN_FLAG_WIDTH * (2 / 3), 1);
    group.add(sprite);

    /* objectFacesSurface uses local +Z as the outward normal. */
    group.rotateX(Math.PI / 2);

    loader.load(
      flagUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.push(tex);
        spriteMat.map = tex;
        spriteMat.needsUpdate = true;

        const img = tex.image as { width?: number; height?: number } | undefined;
        if (img?.width && img?.height && img.height > 0) {
          const aspect = img.width / img.height;
          sprite.scale.set(PIN_FLAG_WIDTH, PIN_FLAG_WIDTH / aspect, 1);
        }
      },
      undefined,
      (err) => {
        console.error(`failed to load flag texture for ${pin.iso}:`, err);
      },
    );

    return group;
  };

  const dispose = () => {
    for (const t of textures) t.dispose();
    for (const m of materials) m.dispose();
    for (const g of geometries) g.dispose();
    textures.length = 0;
    materials.length = 0;
    geometries.length = 0;
  };

  return { createPinObject, dispose };
}
