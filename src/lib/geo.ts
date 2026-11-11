/**
 * Real-world geography for Gulu City, Northern Uganda.
 * Map tiles, 3D, routes and part of the search come from Mapbox; OpenStreetMap
 * (via Photon) fills in the many Gulu shops, schools, roads and landmarks
 * that Mapbox's search index does not have yet.
 */

/** Mapbox public (publishable) token — safe to ship in the browser. */
export const MAPBOX_TOKEN =
  "pk.eyJ1Ijoic2FmZXJpZGVndWx1MDEiLCJhIjoiY21yenpnYmFxMGVqOTJ5cGM0OG1hd3NkMyJ9.ed2-Re0-kGSMqL9xgzBeyg";

export type LngLat = [number, number];

export const GULU: LngLat = [32.2995, 2.7724];
/** Rough bounding box of Gulu City and its suburbs (minLng, minLat, maxLng, maxLat). */
export const GULU_BBOX: [number, number, number, number] = [32.15, 2.65, 32.45, 2.9];

export type PlaceKind = "poi" | "road" | "area" | "address" | "city" | "pin" | "me";

export interface Place {
  id: string;
  short: string;
  name: string;
  area: string;
  lng: number;
  lat: number;
  kind?: PlaceKind;
}

export const lngLat = (p: Pick<Place, "lng" | "lat">): LngLat => [p.lng, p.lat];

/** Great-circle distance in metres. */
export function distanceM(a: LngLat, b: LngLat) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Compass bearing from a to b in degrees (0 = north, clockwise). */
export function bearing(a: LngLat, b: LngLat) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x =
    Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) -
    Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point a given distance (m) from origin in a compass direction. */
export function offsetPoint(origin: LngLat, metres: number, deg: number): LngLat {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const br = toRad(deg);
  const lat1 = toRad(origin[1]);
  const lng1 = toRad(origin[0]);
  const d = metres / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

/** Position and heading at fraction t (0–1) along a polyline. */
export function pointAlong(line: LngLat[], t: number): { at: LngLat; heading: number } {
  if (line.length < 2) return { at: line[0] ?? GULU, heading: 0 };
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const d = distanceM(line[i - 1]!, line[i]!);
    seg.push(d);
    total += d;
  }
  let target = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < seg.length; i++) {
    const d = seg[i]!;
    const a = line[i]!;
    const b = line[i + 1]!;
    if (target <= d || i === seg.length - 1) {
      const f = d === 0 ? 0 : Math.min(1, target / d);
      return { at: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], heading: bearing(a, b) };
    }
    target -= d;
  }
  return { at: line[line.length - 1]!, heading: 0 };
}

export const formatDistance = (m: number) => (m < 950 ? `${Math.max(50, Math.round(m / 50) * 50)} m` : `${(m / 1000).toFixed(1)} km`);
export const formatMinutes = (s: number) => `${Math.max(1, Math.round(s / 60))} min`;

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

const clean = (parts: (string | undefined | null)[], exclude: string) => {
  const seen = new Set<string>([exclude.toLowerCase()]);
  return parts
    .filter((p): p is string => !!p && p.trim().length > 0)
    .filter((p) => {
      const k = p.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(", ");
};

interface PhotonProps {
  osm_id?: number;
  osm_type?: string;
  osm_key?: string;
  osm_value?: string;
  type?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  locality?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
}
interface PhotonFeature {
  geometry: { coordinates: LngLat };
  properties: PhotonProps;
}

function photonKind(p: PhotonProps): PlaceKind {
  if (p.osm_key === "highway" || p.type === "street") return "road";
  if (p.type === "city") return "city";
  if (p.osm_key === "place" || p.type === "district" || p.type === "locality" || p.type === "county") return "area";
  if (!p.name && p.housenumber) return "address";
  return "poi";
}

function fromPhoton(f: PhotonFeature): Place | null {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const name = p.name ?? (p.street ? [p.housenumber, p.street].filter(Boolean).join(" ") : null);
  if (!name) return null;
  return {
    id: `osm-${p.osm_type ?? ""}${p.osm_id ?? `${lng},${lat}`}`,
    short: name,
    name,
    area: clean([p.street, p.district ?? p.locality, p.city ?? p.county, p.city ? null : p.state, p.country === "Uganda" ? null : p.country], name),
    lng,
    lat,
    kind: photonKind(p),
  };
}

interface MapboxSearchFeature {
  geometry: { coordinates: LngLat };
  properties: {
    mapbox_id: string;
    name: string;
    feature_type: string;
    place_formatted?: string;
    full_address?: string;
  };
}

function mapboxKind(t: string): PlaceKind {
  if (t === "street") return "road";
  if (t === "address") return "address";
  if (t === "poi") return "poi";
  if (t === "place" || t === "city") return "city";
  return "area";
}

function fromMapbox(f: MapboxSearchFeature): Place {
  const [lng, lat] = f.geometry.coordinates;
  const p = f.properties;
  return {
    id: `mbx-${p.mapbox_id}`,
    short: p.name,
    name: p.name,
    area: clean([p.place_formatted ?? p.full_address], p.name),
    lng,
    lat,
    kind: mapboxKind(p.feature_type),
  };
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, signal ? { signal } : {});
  if (!res.ok) throw new Error(`Search request failed [${res.status}]`);
  return (await res.json()) as T;
}

const qs = (o: Record<string, string | number | undefined>) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

async function searchMapbox(q: string, near: LngLat, signal?: AbortSignal) {
  const url = `https://api.mapbox.com/search/searchbox/v1/forward?${qs({
    q,
    proximity: `${near[0]},${near[1]}`,
    country: "ug",
    language: "en",
    limit: 8,
    auto_complete: "true",
    access_token: MAPBOX_TOKEN,
  })}`;
  const data = await getJson<{ features?: MapboxSearchFeature[] }>(url, signal);
  return (data.features ?? [])
    .filter((f) => !["region", "country", "category", "brand"].includes(f.properties.feature_type))
    .map(fromMapbox);
}

async function searchOsm(q: string, near: LngLat, signal?: AbortSignal) {
  const url = `https://photon.komoot.io/api/?${qs({ q, lat: near[1], lon: near[0], limit: 15, lang: "en" })}`;
  const data = await getJson<{ features?: PhotonFeature[] }>(url, signal);
  return (data.features ?? []).map(fromPhoton).filter((p): p is Place => p !== null);
}

function matchScore(name: string, q: string) {
  const n = name.toLowerCase();
  const s = q.trim().toLowerCase();
  if (n === s) return 0;
  if (n.startsWith(s)) return 1;
  if (n.split(/[\s,.-]+/).some((w) => w.startsWith(s))) return 2;
  if (n.includes(s)) return 3;
  return 4;
}

/** Merge results from several sources: drop duplicates, prefer good name matches nearby. */
export function rankPlaces(places: Place[], q: string, near: LngLat, limit = 20) {
  const out: Place[] = [];
  for (const p of places) {
    const dup = out.some(
      (o) => o.name.toLowerCase() === p.name.toLowerCase() && distanceM(lngLat(o), lngLat(p)) < 400,
    );
    if (!dup) out.push(p);
  }
  return out
    .map((p) => ({ p, s: matchScore(p.name, q), d: distanceM(near, lngLat(p)) }))
    .sort((a, b) => a.s - b.s || a.d - b.d)
    .slice(0, limit)
    .map((x) => x.p);
}

/** Search every place, road, area and address — biased towards `near` (Gulu by default). */
export async function searchPlaces(q: string, near: LngLat = GULU, signal?: AbortSignal): Promise<Place[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const [mbx, osm] = await Promise.allSettled([searchMapbox(query, near, signal), searchOsm(query, near, signal)]);
  if (mbx.status === "rejected" && osm.status === "rejected") throw osm.reason;
  return rankPlaces([...(mbx.status === "fulfilled" ? mbx.value : []), ...(osm.status === "fulfilled" ? osm.value : [])], query, near);
}

/** Name the spot at a coordinate (street, landmark or area). */
export async function reverseGeocode(at: LngLat, signal?: AbortSignal): Promise<Place> {
  const fallback: Place = { id: `pin-${at[0].toFixed(5)},${at[1].toFixed(5)}`, short: "Pinned location", name: "Pinned location", area: "Gulu", lng: at[0], lat: at[1], kind: "pin" };
  try {
    const data = await getJson<{ features?: PhotonFeature[] }>(
      `https://photon.komoot.io/reverse?${qs({ lon: at[0], lat: at[1], lang: "en", limit: 1 })}`,
      signal,
    );
    const f = data.features?.[0];
    const p = f ? fromPhoton(f) : null;
    if (p) return { ...p, id: fallback.id, lng: at[0], lat: at[1], kind: "pin" };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
  }
  try {
    const data = await getJson<{ features?: { properties: { name: string; place_formatted?: string } }[] }>(
      `https://api.mapbox.com/search/geocode/v6/reverse?${qs({ longitude: at[0], latitude: at[1], language: "en", access_token: MAPBOX_TOKEN })}`,
      signal,
    );
    const f = data.features?.[0];
    if (f) return { ...fallback, short: f.properties.name, name: f.properties.name, area: f.properties.place_formatted ?? "Uganda" };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
  }
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export interface Route {
  coords: LngLat[];
  distance: number;
  duration: number;
  /** False when Mapbox could not route and we drew a straight line instead. */
  real: boolean;
}

const routeCache = new Map<string, Promise<Route>>();

/** Driving route on real roads from Mapbox Directions. */
export function getRoute(from: LngLat, to: LngLat): Promise<Route> {
  const key = `${from[0].toFixed(5)},${from[1].toFixed(5)};${to[0].toFixed(5)},${to[1].toFixed(5)}`;
  const hit = routeCache.get(key);
  if (hit) return hit;
  const straight = (): Route => {
    const d = distanceM(from, to);
    return { coords: [from, to], distance: d, duration: d / 8, real: false };
  };
  const p = getJson<{ routes?: { distance: number; duration: number; geometry: { coordinates: LngLat[] } }[] }>(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${key}?${qs({ geometries: "geojson", overview: "full", access_token: MAPBOX_TOKEN })}`,
  )
    .then((d) => {
      const r = d.routes?.[0];
      if (!r || r.geometry.coordinates.length < 2) return straight();
      return { coords: r.geometry.coordinates, distance: r.distance, duration: r.duration, real: true };
    })
    .catch(() => {
      routeCache.delete(key);
      return straight();
    });
  routeCache.set(key, p);
  return p;
}
