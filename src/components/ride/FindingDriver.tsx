import { Pencil, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AppButton } from "@/components/move/AppButton";
import { Switch } from "@/components/ui/switch";
import { DRIVERS, naira, offerLabel, placeById, tripTotal, vehicleById, type Driver } from "@/lib/move-data";
import { updateRide, type Ride } from "@/lib/move-store";
import { cn } from "@/lib/utils";
import { PaymentPicker, RouteCard, SheetHandle } from "./parts";

const OFFER_LIFE = 25;
const SCHEDULE = [
  { at: 3500, driver: 0, extra: 0 },
  { at: 5500, driver: 1, extra: 0 },
  { at: 7500, driver: 2, extra: 200 },
];

interface Offer {
  id: number;
  driver: Driver;
  price: number;
}

export function FindingDriver({
  ride,
  onCancel,
  onEdit,
  onAccept,
}: {
  ride: Ride;
  onCancel: () => void;
  onEdit: () => void;
  onAccept: (driverId: string, price: number) => void;
}) {
  const vehicle = vehicleById(ride.vehicle);
  const pickup = placeById(ride.pickupId);
  const dropoff = placeById(ride.dropoffId ?? "slaughter");
  const [draft, setDraft] = useState(ride.price);
  const [seconds, setSeconds] = useState(59);
  const [round, setRound] = useState(0);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  // Drivers respond to the current price; a new offer from the passenger restarts the round.
  useEffect(() => {
    const timers = SCHEDULE.map((s, i) =>
      setTimeout(() => {
        const driver = DRIVERS[s.driver];
        setOffers((o) => [...o.filter((x) => x.driver.id !== driver.id), { id: round * 10 + i, driver, price: ride.price + s.extra }]);
      }, s.at),
    );
    return () => timers.forEach(clearTimeout);
  }, [round, ride.price]);

  const visible = offers.filter((o) => !dismissed.includes(o.id));

  useEffect(() => {
    if (!auto) return;
    const match = visible.find((o) => o.price <= ride.price && o.driver.eta <= 5);
    if (match) onAccept(match.driver.id, match.price);
  }, [auto, visible, ride.price, onAccept]);

  const changeOffer = () => {
    updateRide({ price: draft });
    setOffers([]);
    setSeconds(59);
    setRound((r) => r + 1);
  };

  const great = ride.price >= ride.recommended;
  const autoRow = (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-3 text-[12px]">
      <span>
        Auto-accept an offer of {naira(ride.price)} up to
        <br />5 min away
      </span>
      <Switch checked={auto} onCheckedChange={setAuto} aria-label="Auto-accept offers" />
    </div>
  );

  if (visible.length > 0) {
    return (
      <div className="absolute inset-x-0 bottom-0 top-safe z-20 mt-[62px] flex flex-col rounded-t-3xl bg-card shadow-sheet animate-sheet-up">
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-3">
          <SheetHandle />
          <h2 className="text-[15px] font-semibold tracking-tight">
            {visible.length} driver{visible.length > 1 ? "s" : ""} sent an offer
          </h2>
          <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
            <span>
              Auto-accept an offer of {naira(ride.price)} up to
              <br />5 min away
            </span>
            <Switch checked={auto} onCheckedChange={setAuto} aria-label="Auto-accept offers" />
          </div>
          <div className="mt-3 space-y-3 pb-3">
            {visible.map((o) => {
              const label = offerLabel(o.price, ride.price);
              return (
                <div key={o.id} className="overflow-hidden rounded-xl bg-card shadow-[0_0_0_1px_var(--border)] animate-fade-up">
                  <div className="h-1 bg-secondary">
                    <div
                      className="h-full bg-ink animate-bar-shrink"
                      style={{ animationDuration: `${OFFER_LIFE}s` }}
                      onAnimationEnd={() => setDismissed((d) => [...d, o.id])}
                    />
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[15px] font-bold">{naira(o.price)}</p>
                        <p className={cn("text-[11px]", label.tone === "above" ? "text-above" : "text-primary")}>{label.text}</p>
                      </div>
                      <button aria-label="Decline offer" onClick={() => setDismissed((d) => [...d, o.id])}>
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <img src={o.driver.photo} alt="" className="size-6 rounded-full object-cover" />
                      <span className="font-semibold text-foreground">{o.driver.name}</span>
                      <span className="min-w-0 flex-1 truncate">
                        ★ {o.driver.rating} ({o.driver.rides} rides) · {o.driver.car}
                      </span>
                      <span>· {o.driver.eta} min</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1.5 text-[10px]">
                        <UserRound className="size-3" /> {o.driver.free} of {vehicle.seats} free
                      </span>
                      <AppButton size="md" className="flex-1" onClick={() => onAccept(o.driver.id, o.price)}>
                        Accept
                      </AppButton>
                    </div>
                  </div>
                </div>
              );
            })}
            {Array.from({ length: Math.max(0, 3 - visible.length) }).map((_, i) => (
              <div key={i} className="flex h-24 items-center justify-center rounded-xl text-[11px] text-muted-foreground shadow-[0_0_0_1px_var(--border)]">
                Waiting for more offers...
              </div>
            ))}
          </div>
        </div>
        <div className="px-5 pb-safe pt-2">
          <AppButton variant="ghost" className="mb-3" onClick={onCancel}>
            Cancel request
          </AppButton>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="absolute inset-x-0 top-safe z-10 mt-[62px] flex items-center justify-between rounded-t-3xl bg-card px-4 pb-6 pt-3 text-[12px] animate-fade-up">
        <span>7 drivers are viewing your request</span>
        <span className="flex -space-x-2">
          {DRIVERS.map((d) => (
            <img key={d.id} src={d.photo} alt="" className="size-6 rounded-full object-cover ring-2 ring-card" />
          ))}
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground ring-2 ring-card">
            4+
          </span>
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 top-safe z-20 mt-[104px] flex flex-col rounded-t-3xl bg-card shadow-sheet animate-sheet-up">
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-3">
          <SheetHandle />
          <div className="flex items-center justify-between text-[13px]">
            <span>{great ? "Great fare! Your request is prioritized." : "Low fare. Fewer drivers may respond."}</span>
            <span className="font-semibold tabular-nums">0:{String(seconds).padStart(2, "0")}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-ink transition-[width] duration-1000 ease-linear" style={{ width: `${(seconds / 59) * 100}%` }} />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button onClick={() => setDraft((d) => Math.max(100, d - 100))} className="rounded-full bg-muted px-3 py-1.5 text-[12px]">
              − ₦100
            </button>
            <span className="text-lg font-bold">₦ {draft.toLocaleString("en-NG")}</span>
            <button onClick={() => setDraft((d) => d + 100)} className="rounded-full bg-muted px-3 py-1.5 text-[12px]">
              + ₦100
            </button>
          </div>
          <AppButton
            variant={draft !== ride.price ? "primary" : "ghost"}
            size="md"
            className="mt-3 font-normal"
            disabled={draft === ride.price}
            onClick={changeOffer}
          >
            Change your offer
          </AppButton>

          <div className="mt-3 space-y-2.5 pb-3">
            {autoRow}
            <RouteCard
              pickup={pickup}
              dropoff={dropoff}
              action={
                <button aria-label="Edit route" onClick={onEdit}>
                  <Pencil className="size-3.5" />
                </button>
              }
            />
            <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
              <PaymentPicker value={ride.payment} />
              <span className="text-sm font-semibold">{naira(tripTotal(ride.price, ride.seats))}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-3 text-[12px]">
              <span>
                Vehicle type: {vehicle.name} · {ride.seats} seat{ride.seats > 1 ? "s" : ""}
              </span>
              <button aria-label="Change vehicle" onClick={onEdit}>
                <Pencil className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="px-5 pb-safe pt-2">
          <AppButton variant="ghost" className="mb-3" onClick={onCancel}>
            Cancel request
          </AppButton>
        </div>
      </div>
    </>
  );
}
