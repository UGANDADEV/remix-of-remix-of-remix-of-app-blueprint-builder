import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Google Maps Platform calls (Places search, reverse geocoding, driving routes),
 * run on the server through Lovable's connector gateway so keys never reach the browser.
 * Every call is limited to the Gulu area.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
// Gulu City + surrounding Gulu District (kept in sync with GULU_BBOX in geo.ts).
const BOX = { low: { latitude: 2.55, longitude: 32.05 }, high: { latitude: 3.0, longitude: 32.55 } };

const lat = z.number().min(2.55).max(3.0);
const lng = z.number().min(32.05).max(32.55);

function creds() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("Google Maps connection is not configured");
  return { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": mapsKey };
}

async function readError(res: Response) {
  const body = await res.text();
  console.error(`Google Maps request failed [${res.status}]: ${body}`);
  if (res.status === 403) {
    if (body.includes("API_KEY_HTTP_REFERRER_BLOCKED")) return "Google Maps server key is referrer-restricted.";
    if (body.includes("API_KEY_SERVICE_BLOCKED")) return "Google Maps server key does not allow this API.";
    return "Google Maps request was denied (403).";
  }
  return `Google Maps request failed [${res.status}]`;
}

export interface GPlace {
  id: string;
  name: string;
  address: string;
  type: string;
  types: string[];
  lat: number;
  lng: number;
}

/** Text search over every Google place inside Gulu. */
export const searchGulu = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().trim().min(2).max(80), lat, lng }).parse(input),
  )
  .handler(async ({ data }): Promise<{ places: GPlace[]; error?: string }> => {
    const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
      method: "POST",
      headers: {
        ...creds(),
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.shortFormattedAddress,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.types",
      },
      body: JSON.stringify({
        textQuery: data.query,
        pageSize: 15,
        languageCode: "en",
        regionCode: "UG",
        locationRestriction: { rectangle: BOX },
      }),
    });
    if (!res.ok) return { places: [], error: await readError(res) };
    const json = (await res.json()) as {
      places?: {
        id: string;
        displayName?: { text: string };
        shortFormattedAddress?: string;
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
        primaryTypeDisplayName?: { text: string };
        types?: string[];
      }[];
    };
    return {
      places: (json.places ?? [])
        .filter((p) => p.location && p.displayName?.text)
        .map((p) => ({
          id: p.id,
          name: p.displayName!.text,
          address: p.shortFormattedAddress ?? p.formattedAddress ?? "",
          type: p.primaryTypeDisplayName?.text ?? "",
          types: p.types ?? [],
          lat: p.location!.latitude,
          lng: p.location!.longitude,
        })),
    };
  });

/** Name the street or landmark at a coordinate. */
export const nameSpot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ lat, lng }).parse(input))
  .handler(async ({ data }): Promise<{ name: string; area: string } | null> => {
    const res = await fetch(`${GATEWAY_URL}/maps/api/geocode/json?latlng=${data.lat},${data.lng}&language=en`, {
      headers: creds(),
    });
    if (!res.ok) {
      await readError(res);
      return null;
    }
    const json = (await res.json()) as {
      status: string;
      results?: { formatted_address: string; types: string[]; address_components: { long_name: string; types: string[] }[] }[];
    };
    const r = json.results?.find((x) => !x.types.includes("plus_code")) ?? null;
    if (!r) return null;
    const name = r.address_components[0]?.long_name ?? r.formatted_address;
    const area = r.formatted_address
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== name && s !== "Uganda" && !/^[A-Z0-9]{4}\+[A-Z0-9]{2,3}$/.test(s))
      .join(", ");
    return { name, area: area || "Gulu" };
  });

/** Driving route on real roads (encoded polyline, metres, seconds). */
export const driveRoute = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ from: z.object({ lat, lng }), to: z.object({ lat, lng }) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ polyline: string; distance: number; duration: number } | null> => {
    const point = (p: { lat: number; lng: number }) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
    const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        ...creds(),
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({ origin: point(data.from), destination: point(data.to), travelMode: "DRIVE" }),
    });
    if (!res.ok) {
      await readError(res);
      return null;
    }
    const json = (await res.json()) as { routes?: { distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }[] };
    const r = json.routes?.[0];
    const poly = r?.polyline?.encodedPolyline;
    const secs = r?.duration ? Number.parseFloat(r.duration) : Number.NaN;
    if (!r || !poly || !Number.isFinite(secs)) return null;
    return { polyline: poly, distance: r.distanceMeters ?? 0, duration: secs };
  });
