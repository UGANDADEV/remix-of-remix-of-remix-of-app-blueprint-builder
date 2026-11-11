import { ChevronRight, Layers, Navigation, PersonStanding, UserRound } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import busTop from "@/assets/map-bus.png";
import carTop from "@/assets/map-car.png";
import { lngLat, offsetPoint, pointAlong, type LngLat, type Place, type Route } from "@/lib/geo";
import { loadGoogleMaps, onMapsAuthFailure } from "@/lib/google-maps-loader";
import { getRoute } from "@/lib/maps";
import { cn } from "@/lib/utils";

export type MapMode = "idle" | "arriving" | "here" | "tracking" | "pick";
type G = typeof google.maps;

/** Google paints lines itself, so route colours are hex mirrors of the --primary / --ink / --card tokens. */
const ROUTE_COLOR = "#16884f";
const APPROACH_COLOR = "#1f2326";
const CASING_COLOR = "#ffffff";

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
  /** Label above the pickup pin (defaults to "Pickup"). */
  pickupLabel?: string | undefined;
  /** Online drivers to show in "idle" mode, at their real positions. */
  drivers?: { id: string; at: LngLat; kind: "bus" | "car" }[] | undefined;
  /** Where the assigned driver is coming from in "arriving" mode. */
  driverFrom?: LngLat | null | undefined;
  /** "pick" mode: the coordinate under the centre pin after the map stops moving. */
  onCenter?: ((at: LngLat) => void) | undefined;
}

/** Builds an HTML overlay class once Google's library has loaded. */
function makeOverlay(g: G) {
  return class HtmlOverlay extends g.OverlayView {
    pos: google.maps.LatLng;
    div: HTMLDivElement;
    anchor: "center" | "bottom" | "top";
    offset: [number, number];
    rotation = 0;
    constructor(div: HTMLDivElement, at: LngLat, anchor: "center" | "bottom" | "top", offset: [number, number]) {
      super();
      this.div = div;
      this.pos = new g.LatLng(at[1], at[0]);
      this.anchor = anchor;
      this.offset = offset;
      div.style.position = "absolute";
      g.OverlayView.preventMapHitsAndGesturesFrom(div);
    }
    override onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.div);
    }
    override draw() {
      const pt = this.getProjection()?.fromLatLngToDivPixel(this.pos);
      if (!pt) return;
      const ty = this.anchor === "bottom" ? "-100%" : this.anchor === "top" ? "0%" : "-50%";
      this.div.style.left = `${pt.x + this.offset[0]}px`;
      this.div.style.top = `${pt.y + this.offset[1]}px`;
      this.div.style.transform = `translate(-50%, ${ty})${this.rotation ? ` rotate(${this.rotation}deg)` : ""}`;
    }
    override onRemove() {
      this.div.remove();
    }
    moveTo(at: LngLat, rotation = this.rotation) {
      this.pos = new g.LatLng(at[1], at[0]);
      this.rotation = rotation;
      this.draw();
    }
  };
}
type Overlay = InstanceType<ReturnType<typeof makeOverlay>>;
interface MapCtx {
  map: google.maps.Map;
  g: G;
  Overlay: ReturnType<typeof makeOverlay>;
}

const Ctx = createContext<MapCtx | null>(null);

/** A DOM marker whose content is rendered by React through a portal. */
function MapMarker({
  at,
  anchor = "center",
  offset = [0, 0],
  children,
}: {
  at: LngLat;
  anchor?: "center" | "bottom" | "top";
  offset?: [number, number];
  children: ReactNode;
}) {
  const ctx = useContext(Ctx);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const marker = useRef<Overlay | null>(null);

  useEffect(() => {
    if (!ctx) return;
    const div = document.createElement("div");
    const m = new ctx.Overlay(div, at, anchor, offset);
    m.setMap(ctx.map);
    marker.current = m;
    setEl(div);
    return () => {
      m.setMap(null);
      marker.current = null;
    };
    // Recreate only when the map, anchor or offset changes; position updates below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, anchor, offset[0], offset[1]]);

  useEffect(() => {
    marker.current?.moveTo(at);
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
    const div = document.createElement("div");
    const img = document.createElement("img");
    img.src = kind === "bus" ? busTop : carTop;
    img.alt = kind === "bus" ? "Bus" : "Car";
    img.style.width = kind === "bus" ? "16px" : "17px";
    img.style.filter = "drop-shadow(0 2px 2px rgb(0 0 0 / 0.25))";
    div.appendChild(img);
    const start = pointAlong(path, 0);
    const m = new ctx.Overlay(div, start.at, "center", [0, 0]);
    m.rotation = start.heading;
    m.setMap(ctx.map);
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
      m.moveTo(p.at, heading);
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
      m.setMap(null);
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

const toLatLng = (p: LngLat) => ({ lat: p[1], lng: p[0] });
/** Metres per screen pixel at a zoom level (Web Mercator). */
const mPerPx = (lat: number, zoom: number) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
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
  pickupLabel,
  drivers = [],
  driverFrom,
  onCenter,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<MapCtx | null>(null);
  const [failed, setFailed] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [rootH, setRootH] = useState(800);
  const [trip, setTrip] = useState<Route | null>(null);
  const [approach, setApproach] = useState<Route | null>(null);
  const driverFromRef = useRef(driverFrom);
  driverFromRef.current = driverFrom;
  const lines = useRef<{ casing: google.maps.Polyline; route: google.maps.Polyline; approach: google.maps.Polyline } | null>(null);
  const probe = useRef<google.maps.OverlayView | null>(null);
  const centerRef = useRef(onCenter);
  centerRef.current = onCenter;
  // The map stops where the sheet starts, so Google's logo and terms stay visible.
  const mapBottom = Math.max(0, Math.min(sheetHeight, rootH - 160));
  const mapH = rootH - mapBottom;
  const pickY = (topInset + mapH) / 2;
  const pickYRef = useRef(pickY);
  pickYRef.current = pickY;

  /* Create the map once, in the browser only. */
  useEffect(() => {
    let cancelled = false;
    const off = onMapsAuthFailure(() => setFailed(true));
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !box.current) return;
        const map = new g.Map(box.current, {
          center: toLatLng(lngLat(pickup)),
          zoom: 15,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          keyboardShortcuts: false,
          mapTypeId: "roadmap",
        });
        const casing = new g.Polyline({ map, path: [], strokeColor: CASING_COLOR, strokeWeight: 9, strokeOpacity: 1, zIndex: 1 });
        const route = new g.Polyline({ map, path: [], strokeColor: ROUTE_COLOR, strokeWeight: 5, strokeOpacity: 1, zIndex: 2 });
        const appr = new g.Polyline({
          map,
          path: [],
          strokeOpacity: 0,
          zIndex: 2,
          icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: APPROACH_COLOR, scale: 2.5 }, offset: "0", repeat: "9px" }],
        });
        lines.current = { casing, route, approach: appr };
        const p = new g.OverlayView();
        p.onAdd = () => undefined;
        p.draw = () => undefined;
        p.onRemove = () => undefined;
        p.setMap(map);
        probe.current = p;
        map.addListener("idle", () => {
          const cb = centerRef.current;
          const proj = probe.current?.getProjection();
          if (!cb || !proj || !box.current) return;
          const c = proj.fromContainerPixelToLatLng(new g.Point(box.current.clientWidth / 2, pickYRef.current));
          if (c) cb([c.lng(), c.lat()]);
        });
        setCtx({ map, g, Overlay: makeOverlay(g) });
      })
      .catch((e: unknown) => {
        console.error("Map failed to start", e);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRootH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    // From the driver's real position when known, otherwise about a kilometre out on the road network.
    const start = driverFromRef.current ?? offsetPoint(lngLat(pickup), 900, 40);
    void getRoute(start, lngLat(pickup)).then((r) => live && setApproach(r));
    return () => {
      live = false;
    };
  }, [mode === "arriving" || mode === "here", pickup.lng, pickup.lat]);

  /* Push route lines into the map. */
  useEffect(() => {
    const route = (mode === "tracking" && trip ? trip.coords : []).map(toLatLng);
    const appr = (mode === "arriving" && approach ? approach.coords : []).map(toLatLng);
    if (!lines.current) return;
    try {
      lines.current.casing.setPath(route);
      lines.current.route.setPath(route);
      lines.current.approach.setPath(appr);
    } catch (e) {
      // Google disables its objects when the key is rejected; keep the app usable.
      console.warn("Couldn't draw the route", e);
    }
  }, [ctx, mode, trip, approach]);

  /* Camera. */
  const frame = () => {
    if (!ctx) return;
    const { map, g } = ctx;
    const visible = Math.max(80, mapH - topInset);
    const fit = (pts: LngLat[]) => {
      if (pts.length < 2) return false;
      const b = new g.LatLngBounds();
      pts.forEach((p) => b.extend(toLatLng(p)));
      map.fitBounds(b, { top: topInset + Math.min(70, visible * 0.3), bottom: Math.min(40, visible * 0.15), left: 50, right: 50 });
      g.event.addListenerOnce(map, "idle", () => {
        if ((map.getZoom() ?? 0) > 17) map.setZoom(17);
      });
      return true;
    };
    // Put a point in the middle of the part of the map that isn't covered at the top.
    const centre = (at: LngLat, zoom: number) => {
      map.setZoom(zoom);
      map.panTo(toLatLng(offsetPoint(at, (mPerPx(at[1], zoom) * topInset) / 2, 0)));
    };

    if (mode === "tracking" && trip) {
      if (!fit(trip.coords)) centre(lngLat(pickup), 15);
    } else if (mode === "arriving" && approach) {
      fit(approach.coords);
    } else if (mode === "here") {
      centre(lngLat(pickup), 17);
    } else if (mode === "pick") {
      centre(pickStart ?? lngLat(pickup), 16);
    } else {
      centre(lngLat(pickup), 15);
    }
  };
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    frameRef.current();
  }, [ctx, mode, pickup.lng, pickup.lat, trip, approach, mode === "pick" ? 0 : mapH, topInset, pickStart?.[0], pickStart?.[1]]);

  const toggleSatellite = () => {
    const next = !satellite;
    setSatellite(next);
    ctx?.map.setMapTypeId(next ? "hybrid" : "roadmap");
  };

  const pickupAt = lngLat(pickup);
  const driverAt = approach?.coords[0];

  return (
    <div ref={outer} className="absolute inset-0 overflow-hidden bg-map">
      <div className="move-map absolute inset-x-0 top-0" style={{ bottom: mapBottom }}>
        <div ref={box} className="size-full" />
      </div>

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
                  title={pickupLabel ?? (mode === "idle" ? "Pickup" : "Pickup location")}
                  value={pickup.short}
                  onClick={onPickupClick}
                  chevron={mode === "idle"}
                />
              </MapMarker>
            </>
          )}

          {mode === "idle" &&
            drivers.map((d) => (
              <MovingVehicle key={`${d.id}-${d.at[0]}-${d.at[1]}`} path={[d.at, offsetPoint(d.at, 2, 90)]} kind={d.kind} durationMs={400} />
            ))}

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

      <div className="absolute right-4 z-10 flex flex-col gap-2" style={{ bottom: sheetHeight + 36 }}>
        <button
          aria-label={satellite ? "Show street map" : "Show satellite view"}
          aria-pressed={satellite}
          onClick={toggleSatellite}
          className={cn(
            "flex size-10 items-center justify-center rounded-full shadow-float transition-colors",
            satellite ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
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
