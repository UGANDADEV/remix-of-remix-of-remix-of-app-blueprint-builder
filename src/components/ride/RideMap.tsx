import { Box, ChevronRight, Layers, Navigation, PersonStanding, UserRound } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { GeoJSONSource, Map as MbMap, Marker as MbMarker } from "mapbox-gl";
import busTop from "@/assets/map-bus.png";
import carTop from "@/assets/map-car.png";
import { getRoute, lngLat, MAPBOX_TOKEN, offsetPoint, pointAlong, type LngLat, type Place, type Route } from "@/lib/geo";
import { cn } from "@/lib/utils";

export type MapMode = "idle" | "arriving" | "here" | "tracking" | "pick";
type MapLib = typeof import("mapbox-gl").default;

/** Mapbox paints lines on the GPU, so route colours are hex mirrors of the --primary / --ink tokens. */
const ROUTE_COLOR = "#16884f";
const APPROACH_COLOR = "#1f2326";
const STYLES = { streets: "mapbox://styles/mapbox/standard", satellite: "mapbox://styles/mapbox/standard-satellite" } as const;
type StyleKey = keyof typeof STYLES;

interface Props {
  mode: MapMode;
  pickup: Place;
  dropoff?: Place | null | undefined;
  /** Height of whatever covers the bottom of the map (sheet), in px. */
  sheetHeight: number;
  /** Space covered at the top (status bar, route pill), in px. */
  topInset?: number;
  /** How long the driver takes to reach the pickup in "arriving" mode. */
  arrivingMs?: number;
  /** How long the simulated trip animation runs in "tracking" mode. */
  tripMs?: number;
  /** Where the map starts in "pick" mode. */
  pickStart?: LngLat | undefined;
  onTripEnd?: () => void;
  onPickupClick?: () => void;
  /** "pick" mode: the coordinate under the centre pin after the map stops moving. */
  onCenter?: ((at: LngLat) => void) | undefined;
}

const Ctx = createContext<{ map: MbMap; lib: MapLib } | null>(null);

/** A DOM marker whose content is rendered by React through a portal. */
function MapMarker({
  at,
  anchor = "center",
  offset = [0, 0],
  children,
  className,
}: {
  at: LngLat;
  anchor?: "center" | "bottom" | "top";
  offset?: [number, number];
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(Ctx);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const marker = useRef<MbMarker | null>(null);

  useEffect(() => {
    if (!ctx) return;
    const div = document.createElement("div");
    if (className) div.className = className;
    const m = new ctx.lib.Marker({ element: div, anchor, offset }).setLngLat(at).addTo(ctx.map);
    marker.current = m;
    setEl(div);
    return () => {
      m.remove();
      marker.current = null;
    };
    // Recreate only when the map, anchor or offset changes; position updates below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, anchor, offset[0], offset[1]]);

  useEffect(() => {
    marker.current?.setLngLat(at);
  }, [at[0], at[1]]);

  return el ? createPortal(children, el) : null;
}

/** A vehicle seen from above that drives along a real road line. */
function MovingVehicle({
  path,
  durationMs,
  kind,
  loop = false,
  delayMs = 0,
  onEnd,
}: {
  path: LngLat[];
  durationMs: number;
  kind: "bus" | "car";
  loop?: boolean;
  delayMs?: number;
  onEnd?: (() => void) | undefined;
}) {
  const ctx = useContext(Ctx);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    if (!ctx || path.length < 2) return;
    const img = document.createElement("img");
    img.src = kind === "bus" ? busTop : carTop;
    img.alt = kind === "bus" ? "Bus" : "Car";
    img.style.width = kind === "bus" ? "16px" : "17px";
    img.style.filter = "drop-shadow(0 2px 2px rgb(0 0 0 / 0.25))";
    const start = pointAlong(path, 0);
    const m = new ctx.lib.Marker({ element: img, rotationAlignment: "map", pitchAlignment: "map" })
      .setLngLat(start.at)
      .setRotation(start.heading)
      .addTo(ctx.map);
    let raf = 0;
    let done = false;
    const t0 = performance.now() + delayMs;
    const tick = (now: number) => {
      const raw = Math.max(0, now - t0) / durationMs;
      let t = raw;
      if (loop) {
        const cycle = raw % 2;
        t = cycle <= 1 ? cycle : 2 - cycle;
      }
      const p = pointAlong(path, Math.min(1, t));
      const heading = loop && raw % 2 > 1 ? (p.heading + 180) % 360 : p.heading;
      m.setLngLat(p.at).setRotation(heading);
      if (!loop && raw >= 1) {
        if (!done) {
          done = true;
          endRef.current?.();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      m.remove();
    };
  }, [ctx, path, durationMs, kind, loop, delayMs]);

  return null;
}

function Label({ title, value, onClick, chevron = true }: { title: string; value: string; onClick?: (() => void) | undefined; chevron?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex max-w-[180px] items-center gap-2 rounded-md bg-card px-2 py-1 text-left text-foreground shadow-float"
    >
      <span className="min-w-0">
        <span className="block text-[8px] leading-tight text-muted-foreground">{title}</span>
        <span className="block truncate text-[11px] font-semibold leading-tight">{value}</span>
      </span>
      {chevron && <ChevronRight className="size-3 shrink-0 text-muted-foreground" />}
    </button>
  );
}

function PickupPin() {
  return (
    <div className="flex flex-col items-center">
      <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card shadow-float">
        <PersonStanding className="size-4" />
      </span>
      <span className="h-3 w-0.5 bg-primary" />
      <span className="relative flex size-3.5 items-center justify-center rounded-full bg-card ring-2 ring-primary">
        <span className="absolute inset-0 rounded-full bg-primary animate-pulse-ring" />
        <span className="size-1.5 rounded-full bg-primary" />
      </span>
    </div>
  );
}

const emptyLine = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: [] as LngLat[] } };
const lineOf = (coords: LngLat[]) => ({ ...emptyLine, geometry: { type: "LineString" as const, coordinates: coords } });

function ensureLayers(map: MbMap) {
  if (!map.getSource("route")) map.addSource("route", { type: "geojson", data: emptyLine });
  if (!map.getSource("approach")) map.addSource("approach", { type: "geojson", data: emptyLine });
  if (!map.getLayer("route-casing"))
    map.addLayer({
      id: "route-casing",
      type: "line",
      source: "route",
      slot: "middle",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#ffffff", "line-width": 9, "line-emissive-strength": 1 },
    });
  if (!map.getLayer("route-line"))
    map.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      slot: "middle",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": ROUTE_COLOR, "line-width": 5, "line-emissive-strength": 1 },
    });
  if (!map.getLayer("approach-line"))
    map.addLayer({
      id: "approach-line",
      type: "line",
      source: "approach",
      slot: "middle",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": APPROACH_COLOR, "line-width": 3.5, "line-dasharray": [0.4, 2], "line-emissive-strength": 1 },
    });
}

function apply3d(map: MbMap, on: boolean) {
  try {
    map.setConfigProperty("basemap", "show3dObjects", on);
  } catch {
    /* style without that option */
  }
  if (on) {
    if (!map.getSource("mapbox-dem"))
      map.addSource("mapbox-dem", { type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 512, maxzoom: 14 });
    map.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });
  } else {
    map.setTerrain(null);
  }
}

interface Traffic {
  path: LngLat[];
  kind: "bus" | "car";
  ms: number;
  delay: number;
}

export function RideMap({
  mode,
  pickup,
  dropoff,
  sheetHeight,
  topInset = 48,
  arrivingMs = 8000,
  tripMs = 16000,
  pickStart,
  onTripEnd,
  onPickupClick,
  onCenter,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<{ map: MbMap; lib: MapLib } | null>(null);
  const [failed, setFailed] = useState(false);
  const [is3d, setIs3d] = useState(false);
  const [styleKey, setStyleKey] = useState<StyleKey>("streets");
  const [size, setSize] = useState({ w: 390, h: 800 });
  const [trip, setTrip] = useState<Route | null>(null);
  const [approach, setApproach] = useState<Route | null>(null);
  const [traffic, setTraffic] = useState<Traffic[]>([]);
  const lines = useRef<{ route: LngLat[]; approach: LngLat[] }>({ route: [], approach: [] });
  const threeD = useRef(is3d);
  threeD.current = is3d;
  const centerRef = useRef(onCenter);
  centerRef.current = onCenter;
  const pickY = (topInset + (size.h - sheetHeight)) / 2;
  const pickYRef = useRef(pickY);
  pickYRef.current = pickY;

  /* Create the map once, in the browser only. */
  useEffect(() => {
    let map: MbMap | null = null;
    let cancelled = false;
    (async () => {
      try {
        const lib = (await import("mapbox-gl")).default;
        if (cancelled || !box.current) return;
        if (!lib.supported?.() && typeof lib.supported === "function") throw new Error("WebGL unavailable");
        lib.accessToken = MAPBOX_TOKEN;
        const m = new lib.Map({
          container: box.current,
          style: STYLES.streets,
          center: lngLat(pickup),
          zoom: 15,
          attributionControl: false,
          logoPosition: "top-left",
          config: { basemap: { lightPreset: "day", show3dObjects: false, showPointOfInterestLabels: true } },
        });
        map = m;
        m.addControl(new lib.AttributionControl({ compact: true }), "top-right");
        m.on("style.load", () => {
          ensureLayers(m);
          (m.getSource("route") as GeoJSONSource | undefined)?.setData(lineOf(lines.current.route));
          (m.getSource("approach") as GeoJSONSource | undefined)?.setData(lineOf(lines.current.approach));
          apply3d(m, threeD.current);
        });
        m.on("load", () => !cancelled && setCtx({ map: m, lib }));
        m.on("moveend", () => {
          const cb = centerRef.current;
          if (!cb) return;
          const c = m.unproject([m.getContainer().clientWidth / 2, pickYRef.current]);
          cb([c.lng, c.lat]);
        });
        m.on("error", (e) => console.warn("Map error", e.error?.message));
      } catch (e) {
        console.error("Map failed to start", e);
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      ctx?.map.resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ctx]);

  /* Real road routes. */
  useEffect(() => {
    let live = true;
    setTrip(null);
    if (dropoff) void getRoute(lngLat(pickup), lngLat(dropoff)).then((r) => live && setTrip(r));
    return () => {
      live = false;
    };
  }, [pickup.lng, pickup.lat, dropoff?.lng, dropoff?.lat]);

  useEffect(() => {
    let live = true;
    if (mode !== "arriving" && mode !== "here") return;
    // The assigned driver starts roughly a kilometre away, on the road network.
    const start = offsetPoint(lngLat(pickup), 900, 40);
    void getRoute(start, lngLat(pickup)).then((r) => live && setApproach(r));
    return () => {
      live = false;
    };
  }, [mode === "arriving" || mode === "here", pickup.lng, pickup.lat]);

  /* Buses and cars cruising real roads around the pickup while browsing. */
  useEffect(() => {
    if (mode !== "idle") {
      setTraffic([]);
      return;
    }
    let live = true;
    const origin = lngLat(pickup);
    const trips = Array.from({ length: 6 }, (_, i) => {
      const a = offsetPoint(origin, 250 + Math.random() * 700, Math.random() * 360);
      const b = offsetPoint(origin, 250 + Math.random() * 700, Math.random() * 360);
      return getRoute(a, b).then((r) => ({ r, kind: (i % 2 === 0 ? "bus" : "car") as "bus" | "car", delay: i * 400 }));
    });
    void Promise.all(trips).then((all) => {
      if (!live) return;
      setTraffic(
        all.filter((x) => x.r.real && x.r.coords.length > 2).map((x) => ({ path: x.r.coords, kind: x.kind, ms: Math.max(9000, x.r.distance * 70), delay: x.delay })),
      );
    });
    return () => {
      live = false;
    };
  }, [mode, pickup.lng, pickup.lat]);

  /* Push route lines into the map. */
  useEffect(() => {
    const route = mode === "tracking" && trip ? trip.coords : [];
    const appr = mode === "arriving" && approach ? approach.coords : [];
    lines.current = { route, approach: appr };
    if (!ctx) return;
    (ctx.map.getSource("route") as GeoJSONSource | undefined)?.setData(lineOf(route));
    (ctx.map.getSource("approach") as GeoJSONSource | undefined)?.setData(lineOf(appr));
  }, [ctx, mode, trip, approach]);

  /* Camera. */
  const frame = () => {
    if (!ctx) return;
    const { map } = ctx;
    const h = map.getContainer().clientHeight;
    const visible = Math.max(80, h - sheetHeight - topInset);
    const pad = {
      top: topInset + Math.min(70, visible * 0.3),
      bottom: sheetHeight + Math.min(40, visible * 0.15),
      left: 50,
      right: 50,
    };
    const fit = (pts: LngLat[]) => {
      if (pts.length < 2) return false;
      const b = new ctx.lib.LngLatBounds(pts[0], pts[0]);
      pts.forEach((p) => b.extend(p));
      map.fitBounds(b, { padding: pad, maxZoom: 16.5, duration: 900, pitch: map.getPitch(), bearing: map.getBearing() });
      return true;
    };
    const centre = (at: LngLat, zoom: number) =>
      map.easeTo({ center: at, zoom, offset: [0, (topInset - sheetHeight) / 2], duration: 900 });

    if (mode === "tracking" && trip) {
      if (!fit(trip.coords)) centre(lngLat(pickup), 15);
    } else if (mode === "arriving" && approach) {
      fit(approach.coords);
    } else if (mode === "here") {
      centre(lngLat(pickup), 16.5);
    } else if (mode === "pick") {
      centre(pickStart ?? lngLat(pickup), 16);
    } else {
      centre(lngLat(pickup), 15.3);
    }
  };
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    frameRef.current();
  }, [ctx, mode, pickup.lng, pickup.lat, trip, approach, mode === "pick" ? 0 : sheetHeight, topInset, pickStart?.[0], pickStart?.[1]]);

  const toggle3d = () => {
    const next = !is3d;
    setIs3d(next);
    if (!ctx) return;
    apply3d(ctx.map, next);
    ctx.map.easeTo({ pitch: next ? 62 : 0, bearing: next ? -20 : 0, duration: 1000 });
  };

  const toggleStyle = () => {
    const next: StyleKey = styleKey === "streets" ? "satellite" : "streets";
    setStyleKey(next);
    ctx?.map.setStyle(STYLES[next], {
      config: { basemap: { lightPreset: "day", show3dObjects: is3d } },
    } as unknown as Parameters<MbMap["setStyle"]>[1]);
  };

  const pickupAt = lngLat(pickup);
  const driverAt = approach?.coords[0];

  return (
    <div className="absolute inset-0 overflow-hidden bg-map">
      <div ref={box} className="move-map absolute inset-0" />

      {failed && (
        <div className="absolute inset-x-6 top-1/3 z-10 rounded-xl bg-card p-4 text-center text-xs text-muted-foreground shadow-float">
          The map couldn't load on this device. Check your connection and try again.
        </div>
      )}

      {ctx && (
        <Ctx.Provider value={ctx}>
          {mode !== "pick" && (
            <>
              <MapMarker at={pickupAt} anchor="bottom" offset={[0, 7]}>
                <PickupPin />
              </MapMarker>
              <MapMarker at={pickupAt} anchor="bottom" offset={[0, -48]}>
                <Label
                  title={mode === "idle" ? "Pickup" : "Pickup location"}
                  value={pickup.short}
                  onClick={onPickupClick}
                  chevron={mode === "idle"}
                />
              </MapMarker>
            </>
          )}

          {mode === "idle" &&
            traffic.map((t, i) => <MovingVehicle key={`${pickup.id}-${i}`} path={t.path} kind={t.kind} durationMs={t.ms} delayMs={t.delay} loop />)}

          {mode === "arriving" && approach && driverAt && (
            <>
              <MovingVehicle path={approach.coords} kind="bus" durationMs={arrivingMs} />
              <MapMarker at={driverAt} anchor="bottom" offset={[0, -14]}>
                <span className="flex flex-col items-center gap-1">
                  <Label title="Driver's location" value="On the way" chevron={false} />
                  <span className="flex size-6 items-center justify-center rounded-full bg-ink text-ink-foreground ring-2 ring-card">
                    <UserRound className="size-3.5" />
                  </span>
                </span>
              </MapMarker>
            </>
          )}

          {mode === "here" && <MovingVehicle path={[offsetPoint(pickupAt, 12, 90), offsetPoint(pickupAt, 14, 90)]} kind="bus" durationMs={500} />}

          {mode === "tracking" && trip && (
            <MovingVehicle key={`${trip.coords.length}-${trip.distance}`} path={trip.coords} kind="bus" durationMs={tripMs} delayMs={600} onEnd={onTripEnd} />
          )}

          {mode === "tracking" && dropoff && (
            <>
              <MapMarker at={lngLat(dropoff)} anchor="center">
                <span className="flex size-7 items-center justify-center rounded-full bg-ink text-ink-foreground ring-2 ring-card">
                  <Navigation className="size-3.5 rotate-90 fill-current" />
                </span>
              </MapMarker>
              <MapMarker at={lngLat(dropoff)} anchor="bottom" offset={[0, -20]}>
                <Label title="Dropoff location" value={dropoff.short} chevron={false} />
              </MapMarker>
            </>
          )}
        </Ctx.Provider>
      )}

      {mode === "pick" && (
        <div className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 -translate-y-full" style={{ top: pickY }}>
          <div className="flex flex-col items-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-ink text-ink-foreground ring-4 ring-card shadow-float">
              <span className="size-2.5 rounded-full bg-card" />
            </span>
            <span className="h-4 w-0.5 bg-ink" />
          </div>
        </div>
      )}

      <div className="absolute right-4 z-10 flex flex-col gap-2" style={{ bottom: sheetHeight + 12 }}>
        <button
          aria-label={is3d ? "Switch to 2D map" : "Switch to 3D map"}
          aria-pressed={is3d}
          onClick={toggle3d}
          className={cn(
            "flex size-10 items-center justify-center rounded-full text-[11px] font-bold shadow-float transition-colors",
            is3d ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
          )}
        >
          {is3d ? "2D" : <Box className="size-4" />}
        </button>
        <button
          aria-label={styleKey === "streets" ? "Show satellite view" : "Show street map"}
          aria-pressed={styleKey === "satellite"}
          onClick={toggleStyle}
          className={cn(
            "flex size-10 items-center justify-center rounded-full shadow-float transition-colors",
            styleKey === "satellite" ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
          )}
        >
          <Layers className="size-4" />
        </button>
        <button
          aria-label="Recenter map"
          onClick={() => frameRef.current()}
          className="flex size-10 items-center justify-center rounded-full bg-card text-foreground shadow-float"
        >
          <Navigation className="size-4" />
        </button>
      </div>
    </div>
  );
}
