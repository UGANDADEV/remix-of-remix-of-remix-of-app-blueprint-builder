import { ChevronDown, Search } from "lucide-react";
import { useRef, useState } from "react";
import busImg from "@/assets/vehicle-bus.png";
import { NEARBY, PICKUPS, naira, vehicleById, type NearbyDeal, type Place } from "@/lib/move-data";
import { cn } from "@/lib/utils";
import { SheetHandle } from "./parts";

export function HomeSheetSkeleton() {
  return (
    <div className="px-5 pt-3 pb-4">
      <SheetHandle />
      <div className="h-5 w-32 rounded skeleton-shimmer" />
      <div className="mt-4 h-11 rounded-xl skeleton-shimmer" />
      <div className="mt-5 flex justify-between">
        <div className="h-4 w-36 rounded skeleton-shimmer" />
        <div className="h-4 w-12 rounded skeleton-shimmer" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[84px] rounded-xl skeleton-shimmer" />
        ))}
      </div>
    </div>
  );
}

export function HomeSheet({
  pickup,
  onPickup,
  onSearch,
  onSeeAll,
  onDeal,
  expanded,
  onToggle,
  onTrip,
}: {
  pickup: Place;
  onPickup: (p: Place) => void;
  onSearch: () => void;
  onSeeAll: () => void;
  onDeal: (d: NearbyDeal) => void;
  expanded: boolean;
  onToggle: (v: boolean) => void;
  /** When a trip is in progress, show the bus shortcut back to trip details. */
  onTrip?: (() => void) | undefined;
}) {
  const [menu, setMenu] = useState(false);
  const startY = useRef<number | null>(null);

  return (
    <div className="px-5 pt-3 pb-3">
      <div
        className="-mx-5 -mt-3 cursor-grab touch-none px-5 pt-3"
        onPointerDown={(e) => (startY.current = e.clientY)}
        onPointerUp={(e) => {
          if (startY.current === null) return;
          const dy = e.clientY - startY.current;
          startY.current = null;
          if (Math.abs(dy) < 6) onToggle(!expanded);
          else onToggle(dy < 0);
        }}
      >
        <SheetHandle />
      </div>

      <div className="relative flex items-center justify-between">
        <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-1 text-[17px] font-semibold tracking-tight">
          From {pickup.short} <ChevronDown className={cn("size-4 transition-transform", menu && "rotate-180")} />
        </button>
        {onTrip && (
          <button onClick={onTrip} aria-label="Open trip details" className="animate-pop-in">
            <img src={busImg} alt="" className="h-6 w-auto" />
          </button>
        )}
        {menu && (
          <div className="absolute left-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl bg-card py-1 shadow-float animate-pop-in">
            {PICKUPS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onPickup(p);
                  setMenu(false);
                }}
                className={cn(
                  "block w-full px-4 py-2.5 text-left text-sm hover:bg-muted",
                  p.id === pickup.id && "font-semibold text-primary",
                )}
              >
                {p.name}
                <span className="block text-[11px] font-normal text-muted-foreground">{p.area}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onSearch}
        className="mt-3 flex h-11 w-full items-center gap-2 rounded-xl bg-muted px-3 text-left text-sm text-muted-foreground"
      >
        <Search className="size-4" /> Where to?
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="mt-5 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-normal">Nearby Destinations</h2>
            <button onClick={onSeeAll} className="text-xs font-semibold text-primary underline">
              See all
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 pb-1">
            {NEARBY.map((d, i) => {
              const v = vehicleById(d.vehicle);
              const place = d.place;
              const low = d.left <= 2;
              return (
                <button
                  key={i}
                  onClick={() => onDeal(d)}
                  className="rounded-xl bg-muted p-2.5 text-left transition-transform active:scale-[0.97]"
                >
                  <div className="flex items-center gap-1.5">
                    <img src={v.image} alt="" className="h-4 w-8 object-contain" />
                    <span className="flex-1 text-[11px] font-medium">{d.label}</span>
                    <span className={cn("text-[10px]", low ? "font-semibold text-warning" : "text-muted-foreground")}>
                      {d.left} left
                    </span>
                  </div>
                  <p className="mt-1.5 text-base font-bold">
                    {naira(d.price)}
                    <span className="text-[11px] font-normal text-muted-foreground">/seat</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {place.short} · {d.minutes} min
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
