import { ArrowLeft, Bookmark, Globe, Map as MapIcon, MapPin, PersonStanding, Search, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PLACES, type Place } from "@/lib/move-data";
import { formatDistance, distanceM, lngLat, searchPlaces } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { SheetHandle } from "./parts";

const OPTIONS = [
  { id: "map", label: "Search location on map", Icon: MapIcon },
  { id: "saved", label: "Saved places", Icon: Bookmark },
  { id: "city", label: "Search in another city", Icon: Globe },
  { id: "someone", label: "Book for someone else", Icon: UserRound },
];
const CHIPS = ["Saved", "Map", "Another City", "For Someone"];

export function SearchRoute({
  pickup,
  showAll,
  onBack,
  onPick,
}: {
  pickup: Place;
  showAll?: boolean;
  onBack: () => void;
  onPick: (p: Place) => void;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [failed, setFailed] = useState(false);
  const [soon, setSoon] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(q, lngLat(pickup), ctrl.signal)
        .then((r) => {
          setResults(r);
          setLoading(false);
        })
        .catch((e: Error) => {
          if (e.name === "AbortError") return;
          setResults([]);
          setFailed(true);
          setLoading(false);
        });
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, pickup.lng, pickup.lat]);

  useEffect(() => {
    if (!soon) return;
    const t = setTimeout(() => setSoon(null), 1400);
    return () => clearTimeout(t);
  }, [soon]);

  const list = (places: Place[]) => (
    <ul className="mt-2">
      {places.map((p) => (
        <li key={p.id}>
          <button onClick={() => onPick(p)} className="flex w-full items-center gap-3 py-3 text-left">
            <span className="flex size-8 items-center justify-center rounded-full bg-muted">
              <MapPin className="size-4" />
            </span>
            <span className="min-w-0 flex-1 border-b border-border pb-3">
              <span className="block text-sm font-medium">{p.name}</span>
              <span className="block text-[11px] text-muted-foreground">
                {[p.area, formatDistance(distanceM(lngLat(pickup), lngLat(p)))].filter(Boolean).join(" · ")}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="absolute inset-x-0 bottom-0 top-safe z-30 mt-2 flex flex-col rounded-t-3xl bg-card px-5 pt-3 shadow-sheet animate-sheet-up">
      <SheetHandle />
      <div className="relative flex items-center justify-center">
        <button aria-label="Back" onClick={onBack} className="absolute left-0 -ml-1 p-1">
          <ArrowLeft className="size-5" />
        </button>
        <h2 className="text-[17px] font-semibold tracking-tight">Search Route</h2>
      </div>

      <div className="mt-5 flex h-11 items-center gap-2 rounded-lg bg-muted px-3 text-sm">
        <PersonStanding className="size-4" /> {pickup.short}
      </div>
      <div className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-primary px-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Dropoff location"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button aria-label="Clear" onClick={() => setQ("")} className="flex size-5 items-center justify-center rounded-full bg-secondary">
            <X className="size-3" />
          </button>
        )}
      </div>

      <div className="mt-2 flex-1 overflow-y-auto no-scrollbar pb-safe">
        {!q.trim() ? (
          <>
            <ul className="mt-2">
              {OPTIONS.map(({ id, label, Icon }) => (
                <li key={id}>
                  <button onClick={() => setSoon(id)} className="flex w-full items-center gap-3 py-2.5 text-left text-[13px]">
                    <span className="flex size-7 items-center justify-center rounded-full bg-muted">
                      <Icon className="size-3.5 fill-foreground" />
                    </span>
                    <span className="flex-1">{label}</span>
                    {soon === id && (
                      <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-medium text-ink-foreground animate-pop-in">
                        Coming soon
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {showAll && (
              <>
                <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Popular places in Gulu</h3>
                {list(PLACES)}
              </>
            )}
          </>
        ) : (
          <>
            <div className="mt-1 flex gap-2 overflow-x-auto no-scrollbar">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => setSoon(c)}
                  className={cn(
                    "shrink-0 rounded-full bg-muted px-3 py-1.5 text-[11px] transition-colors",
                    soon === c && "bg-ink text-ink-foreground",
                  )}
                >
                  {soon === c ? "Coming soon" : c}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="mt-5 space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-6 rounded skeleton-shimmer" />
                ))}
              </div>
            ) : results.length ? (
              list(results)
            ) : failed ? (
              <p className="mt-5 text-xs text-muted-foreground">Search isn't available right now. Check your connection and try again.</p>
            ) : (
              <p className="mt-5 text-xs text-muted-foreground">
                {q.trim().length < 2 ? "Keep typing…" : `No places match "${q.trim()}".`}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
