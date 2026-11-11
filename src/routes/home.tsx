import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BottomNav } from "@/components/move/BottomNav";
import { Arrived } from "@/components/ride/Arrived";
import { ChooseRide } from "@/components/ride/ChooseRide";
import { DriverAssigned } from "@/components/ride/DriverAssigned";
import { FindingDriver } from "@/components/ride/FindingDriver";
import { HomeSheet, HomeSheetSkeleton } from "@/components/ride/HomeSheet";
import { RideMap, type MapMode } from "@/components/ride/RideMap";
import { RoutePill } from "@/components/ride/parts";
import { SearchRoute } from "@/components/ride/SearchRoute";
import { driverById, tripTotal, type NearbyDeal, type Place } from "@/lib/move-data";
import mapboxCss from "mapbox-gl/dist/mapbox-gl.css?url";
import { addHistory, resetRide, updateRide, useMove } from "@/lib/move-store";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/home")({
  head: () => ({
    ...pageHead("Book a ride", "See nearby buses, mini buses and taxis in Gulu and name your own fare."),
    links: [{ rel: "stylesheet", href: mapboxCss }],
  }),
  component: Home,
});

const TOP = 48;

function Home() {
  const ride = useMove((s) => s.ride);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState<null | { all: boolean }>(null);
  const [tripDetails, setTripDetails] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [rootH, setRootH] = useState(800);
  const [panelH, setPanelH] = useState(320);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (rootRef.current) setRootH(rootRef.current.clientHeight);
      if (panelRef.current) setPanelH(panelRef.current.clientHeight);
    });
    if (rootRef.current) ro.observe(rootRef.current);
    if (panelRef.current) ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, [ride.stage]);

  const pickup = ride.pickup;
  const dropoff = ride.dropoff;

  const pick = (p: Place) => {
    setSearch(null);
    updateRide({ dropoff: p, stage: "choose", vehicle: "bus", price: 300, recommended: 300, seats: 1 });
  };
  const deal = (d: NearbyDeal) =>
    updateRide({ dropoff: d.place, vehicle: d.vehicle, price: d.price, recommended: d.price, seats: 1, stage: "choose" });

  const accept = useCallback((driverId: string, price: number) => updateRide({ driverId, price, stage: "arriving" }), []);

  const finish = (rating: number) => {
    if (ride.dropoff && ride.driverId) {
      addHistory({
        id: String(Date.now()),
        date: new Date().toISOString(),
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        driverId: ride.driverId,
        vehicle: ride.vehicle,
        seats: ride.seats,
        total: tripTotal(ride.price, ride.seats),
        rating,
        payment: ride.payment,
      });
    }
    setTripDetails(false);
    resetRide();
  };

  const stage = ride.stage;
  const withPanel = stage === "idle" || stage === "tracking";
  const mapMode: MapMode =
    stage === "arriving" ? "arriving" : stage === "here" || stage === "started" ? "here" : stage === "tracking" ? "tracking" : "idle";
  const sheetHeight = withPanel
    ? panelH
    : stage === "arriving" || stage === "here" || stage === "started"
      ? rootH - (TOP + 172)
      : rootH - (TOP + 62);

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden bg-map">
      <RideMap
        mode={mapMode}
        pickup={pickup}
        dropoff={dropoff}
        sheetHeight={sheetHeight}
        topInset={dropoff && (stage === "started" || stage === "tracking") ? TOP + 56 : TOP}
        arrivingMs={driverById(ride.driverId).eta * 4000 + 4000}
        onPickupClick={() => setSearch({ all: false })}
        onTripEnd={() => updateRide({ stage: "arrived" })}
      />

      {dropoff && (stage === "choose" || stage === "finding" || stage === "started" || stage === "tracking") && (
        <RoutePill pickup={pickup} dropoff={dropoff} onEdit={stage === "choose" ? () => setSearch({ all: false }) : undefined} />
      )}

      {withPanel && (
        <div ref={panelRef} className="absolute inset-x-0 bottom-0 z-20">
          <div className="rounded-t-3xl bg-card shadow-sheet">
            {loading && stage === "idle" ? (
              <HomeSheetSkeleton />
            ) : (
              <HomeSheet
                pickup={ride.pickup}
                onPickup={(p) => updateRide({ pickup: p })}
                onSearch={() => (stage === "tracking" ? setTripDetails(true) : setSearch({ all: false }))}
                onSeeAll={() => setSearch({ all: true })}
                onDeal={deal}
                expanded={stage === "idle" && expanded}
                onToggle={setExpanded}
                onTrip={stage === "tracking" ? () => setTripDetails(true) : undefined}
              />
            )}
          </div>
          <BottomNav />
        </div>
      )}

      {stage === "choose" && <ChooseRide ride={ride} onFind={() => updateRide({ stage: "finding" })} />}
      {stage === "finding" && (
        <FindingDriver ride={ride} onCancel={resetRide} onEdit={() => updateRide({ stage: "choose" })} onAccept={accept} />
      )}
      {(stage === "arriving" || stage === "here" || stage === "started") && (
        <DriverAssigned ride={ride} onCancel={resetRide} onTrack={() => updateRide({ stage: "tracking" })} />
      )}
      {stage === "tracking" && tripDetails && (
        <DriverAssigned ride={ride} onCancel={resetRide} onTrack={() => setTripDetails(false)} onClose={() => setTripDetails(false)} />
      )}
      {stage === "arrived" && <Arrived ride={ride} onDone={finish} />}

      {search && (
        <SearchRoute pickup={ride.pickup} showAll={search.all} onBack={() => setSearch(null)} onPick={pick} />
      )}
    </div>
  );
}
