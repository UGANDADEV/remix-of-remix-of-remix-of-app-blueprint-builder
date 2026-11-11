import { ChevronRight, Navigation, PersonStanding, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import mapImg from "@/assets/map-light.jpg";
import busTop from "@/assets/map-bus.png";
import carTop from "@/assets/map-car.png";
import { cn } from "@/lib/utils";
import { DRIVER, DRIVER_ROUTE, DROPOFF, PICKUP, ROUTE, TRAFFIC, WORLD } from "./map-geometry";

export type MapMode = "idle" | "arriving" | "here" | "tracking";

const K = 0.62;

interface Props {
  mode: MapMode;
  pickupLabel: string;
  dropoffLabel?: string;
  /** Where the focus point sits vertically, as a fraction of the map's height. */
  focusY: number;
  onTripEnd?: () => void;
  onPickupClick?: () => void;
  locateBottom?: number;
}

function Label({ title, value, onClick, chevron = true }: { title: string; value: string; onClick?: () => void; chevron?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-md bg-card px-2 py-1 text-left shadow-float"
    >
      <span>
        <span className="block text-[8px] leading-tight text-muted-foreground">{title}</span>
        <span className="block text-[11px] font-semibold leading-tight">{value}</span>
      </span>
      {chevron && <ChevronRight className="size-3 text-muted-foreground" />}
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

export function RideMap({ mode, pickupLabel, dropoffLabel, focusY, onTripEnd, onPickupClick, locateBottom = 16 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 800 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => setPan({ x: 0, y: 0 }), [mode]);

  const focus =
    mode === "arriving"
      ? { x: (PICKUP.x + DRIVER.x) / 2, y: (PICKUP.y + DRIVER.y) / 2 }
      : mode === "tracking"
        ? { x: (PICKUP.x + DROPOFF.x) / 2 + 10, y: (PICKUP.y + DROPOFF.y) / 2 }
        : PICKUP;

  const tx = size.w / 2 - focus.x * K + pan.x;
  const ty = size.h * focusY - focus.y * K + pan.y;
  const at = (p: { x: number; y: number }) => ({ left: tx + p.x * K, top: ty + p.y * K });

  const marker = (p: { x: number; y: number }, node: ReactNode, cls = "") => (
    <div className={cn("absolute", cls)} style={at(p)}>
      {node}
    </div>
  );

  return (
    <div
      ref={ref}
      className="absolute inset-0 touch-none overflow-hidden bg-map"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      }}
      onPointerMove={(e) => drag.current && setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
    >
      <div
        className={cn("absolute left-0 top-0 origin-top-left", !drag.current && "transition-transform duration-700 ease-out")}
        style={{ width: WORLD.w, height: WORLD.h, transform: `translate(${tx}px, ${ty}px) scale(${K})` }}
      >
        <img src={mapImg} alt="" draggable={false} className="absolute inset-0 size-full select-none" width={WORLD.w} height={WORLD.h} />

        <svg className="absolute inset-0" width={WORLD.w} height={WORLD.h} viewBox={`0 0 ${WORLD.w} ${WORLD.h}`}>
          {mode === "tracking" && (
            <path d={ROUTE} fill="none" className="stroke-primary" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
          )}
          {mode === "arriving" && (
            <path d={DRIVER_ROUTE} fill="none" className="stroke-ink" strokeWidth={4} strokeDasharray="3 10" strokeLinecap="round" />
          )}
        </svg>

        {(mode === "idle") &&
          TRAFFIC.map((t, i) => (
            <img
              key={i}
              src={t.kind === "bus" ? busTop : carTop}
              alt=""
              className="absolute left-0 top-0 animate-drive"
              style={{
                width: t.kind === "bus" ? 30 : 32,
                offsetPath: `path("${t.path}")`,
                offsetAnchor: "center",
                animationDuration: `${t.dur}s`,
                animationDelay: `${t.delay}s`,
              }}
            />
          ))}

        {mode === "tracking" && (
          <img
            src={busTop}
            alt="Your bus"
            className="absolute left-0 top-0"
            onAnimationEnd={onTripEnd}
            style={{
              width: 34,
              offsetPath: `path("${ROUTE}")`,
              offsetAnchor: "center",
              offsetRotate: "auto 90deg",
              animation: "drive 16s linear 0.6s both",
            }}
          />
        )}
      </div>

      {/* Markers keep a constant size regardless of map scale */}
      {marker(PICKUP, <PickupPin />, "-translate-x-1/2 -translate-y-[14px]")}
      {marker(
        PICKUP,
        <Label
          title={mode === "idle" ? "Pickup" : "Pickup location"}
          value={pickupLabel}
          onClick={onPickupClick}
          chevron={mode === "idle"}
        />,
        "-translate-x-[60%] -translate-y-[64px]",
      )}

      {mode === "arriving" && (
        <>
          {marker(
            DRIVER,
            <span className="flex size-7 items-center justify-center rounded-full bg-ink text-ink-foreground ring-2 ring-card">
              <UserRound className="size-4" />
            </span>,
            "-translate-x-1/2 -translate-y-1/2",
          )}
          {marker(DRIVER, <Label title="Driver's location" value={pickupLabel} chevron={false} />, "-translate-x-1/2 -translate-y-[58px]")}
        </>
      )}

      {mode === "tracking" && dropoffLabel && (
        <>
          {marker(
            DROPOFF,
            <span className="flex size-7 items-center justify-center rounded-full bg-ink text-ink-foreground ring-2 ring-card">
              <Navigation className="size-3.5 rotate-90 fill-current" />
            </span>,
            "-translate-x-1/2 -translate-y-1/2",
          )}
          {marker(DROPOFF, <Label title="Dropoff location" value={dropoffLabel} />, "-translate-x-[30%] -translate-y-[62px]")}
        </>
      )}

      <button
        aria-label="Recenter map"
        onClick={() => setPan({ x: 0, y: 0 })}
        className="absolute right-4 z-10 flex size-10 items-center justify-center rounded-full bg-card shadow-float"
        style={{ bottom: locateBottom }}
      >
        <Navigation className="size-4" />
      </button>
    </div>
  );
}
