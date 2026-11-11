import { Check, ChevronRight, UserRound } from "lucide-react";
import { AppButton } from "@/components/move/AppButton";
import { VEHICLES, naira, tripTotal, vehicleById } from "@/lib/move-data";
import { updateRide, type Ride } from "@/lib/move-store";
import { cn } from "@/lib/utils";
import { PaymentPicker, SheetHandle, roundBtn } from "./parts";

const STEP = 50;

export function ChooseRide({ ride, onFind }: { ride: Ride; onFind: () => void }) {
  const vehicle = vehicleById(ride.vehicle);
  const total = tripTotal(ride.price, ride.seats);
  const min = Math.max(STEP, Math.round((ride.recommended * 0.7) / STEP) * STEP);

  return (
    <div className="absolute inset-x-0 bottom-0 top-safe z-20 mt-[62px] flex flex-col rounded-t-3xl bg-card shadow-sheet animate-sheet-up">
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-3">
        <SheetHandle />
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">How many seats?</h2>
          <div className="flex items-center gap-4">
            <button className={roundBtn} aria-label="Fewer seats" disabled={ride.seats <= 1} onClick={() => updateRide({ seats: ride.seats - 1 })}>
              −
            </button>
            <span className="w-3 text-center text-sm font-semibold">{ride.seats}</span>
            <button
              className={roundBtn}
              aria-label="More seats"
              disabled={ride.seats >= vehicle.seats}
              onClick={() => updateRide({ seats: ride.seats + 1 })}
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {VEHICLES.map((v) => {
            const active = v.id === ride.vehicle;
            const per = active ? ride.recommended : v.pricePerSeat;
            return (
              <button
                key={v.id}
                onClick={() =>
                  !active &&
                  updateRide({
                    vehicle: v.id,
                    price: v.pricePerSeat,
                    recommended: v.pricePerSeat,
                    seats: Math.min(ride.seats, v.seats),
                  })
                }
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-3 text-left transition-all",
                  active ? "border-primary ring-1 ring-primary" : "border-border",
                )}
              >
                <img src={v.image} alt="" className="h-9 w-14 object-contain" />
                <span className="flex-1">
                  <span className="block text-[13px] font-semibold">{v.name}</span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    {v.eta} min <UserRound className="ml-1 size-2.5" /> {v.seats}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-[13px] font-semibold">from {naira(per)}/seat</span>
                  <span className="block text-[10px] text-muted-foreground">{naira(per * ride.seats)} total</span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => updateRide({ extraBags: !ride.extraBags })}
          className="mt-4 flex w-full items-center justify-between py-1 text-[13px] font-medium"
        >
          <span className="flex items-center gap-2">
            {ride.extraBags && (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" />
              </span>
            )}
            {ride.extraBags ? "Extra bags added" : "Traveling with extra bags?"}
          </span>
          <ChevronRight className="size-4" />
        </button>

        <div className="mt-3 rounded-xl bg-muted px-3 py-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Name your price / per seat</span>
            <span className="font-semibold">
              {naira(total)} for {ride.seats} seat{ride.seats > 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button className={roundBtn} aria-label="Lower price" disabled={ride.price <= min} onClick={() => updateRide({ price: ride.price - STEP })}>
              −
            </button>
            <div className="text-center">
              <p className="text-xl font-bold">{naira(ride.price)}</p>
              <p className="text-[10px] text-muted-foreground">Recommended fare: {naira(ride.recommended)}</p>
            </div>
            <button className={roundBtn} aria-label="Raise price" onClick={() => updateRide({ price: ride.price + STEP })}>
              +
            </button>
          </div>
        </div>

        <div className="mt-2.5 mb-3 flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
          <PaymentPicker value={ride.payment} onChange={(payment) => updateRide({ payment })} />
          <span className="text-sm font-semibold">{naira(total)}</span>
        </div>
      </div>
      <div className="px-5 pb-safe pt-2">
        <AppButton onClick={onFind} className="mb-3">
          Find driver
        </AppButton>
      </div>
    </div>
  );
}
