import bus from "@/assets/vehicle-bus.png";
import minibus from "@/assets/vehicle-minibus.png";
import taxi from "@/assets/vehicle-taxi.png";

export type VehicleId = "bus" | "minibus" | "taxi";

export interface Vehicle {
  id: VehicleId;
  name: string;
  image: string;
  seats: number;
  eta: number;
  pricePerSeat: number;
}

export const VEHICLES: Vehicle[] = [
  { id: "bus", name: "Bus", image: bus, seats: 11, eta: 4, pricePerSeat: 300 },
  { id: "minibus", name: "Mini Bus", image: minibus, seats: 8, eta: 4, pricePerSeat: 400 },
  { id: "taxi", name: "Taxi", image: taxi, seats: 4, eta: 4, pricePerSeat: 600 },
];

export const vehicleById = (id: VehicleId) => VEHICLES.find((v) => v.id === id) ?? VEHICLES[0]!;

export type { Place } from "./geo";
import type { Place } from "./geo";

/** Common pickup points in Gulu City, Northern Uganda. */
export const PICKUPS: Place[] = [
  { id: "gulu-market", short: "Gulu Main Market", name: "Gulu Main Market", area: "Jomo Kenyatta Road, Gulu", lng: 32.3007, lat: 2.77249, kind: "poi" },
  { id: "gulu-buspark", short: "Gulu Bus Park", name: "Gulu Bus Park", area: "Queen's Lane, Gulu", lng: 32.29919, lat: 2.77096, kind: "poi" },
  { id: "gulu-referral", short: "Gulu Referral Hospital", name: "Gulu Regional Referral Hospital", area: "Awere Road, Gulu", lng: 32.29857, lat: 2.77734, kind: "poi" },
];

/** Popular destinations around Gulu, shown before the passenger types. */
export const PLACES: Place[] = [
  { id: "gulu-university", short: "Gulu University", name: "Gulu University", area: "Laroo-Pece, Gulu", lng: 32.3169, lat: 2.78898, kind: "poi" },
  { id: "lacor-hospital", short: "Lacor Hospital", name: "St. Mary's Hospital Lacor", area: "Gulu - Nimule Road, Lacor", lng: 32.2149, lat: 2.77458, kind: "poi" },
  { id: "pece-stadium", short: "Pece Stadium", name: "Pece War Memorial Stadium", area: "Lumumba Avenue, Gulu", lng: 32.30905, lat: 2.7702, kind: "poi" },
  { id: "layibi", short: "Layibi", name: "Layibi", area: "Layibi Division, Gulu", lng: 32.29671, lat: 2.74065, kind: "area" },
  { id: "unyama", short: "Unyama", name: "Unyama", area: "Gulu", lng: 32.33814, lat: 2.81699, kind: "area" },
  { id: "lacor", short: "Lacor", name: "Lacor", area: "Gulu", lng: 32.24775, lat: 2.76767, kind: "area" },
  ...PICKUPS,
];

export const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

/** Total fare for a trip: the price named per seat multiplied by seats booked. */
export const tripTotal = (pricePerSeat: number, seats: number) => pricePerSeat * Math.max(1, seats);

/** How an offer compares to the passenger's named price. */
export function offerLabel(offer: number, myPrice: number) {
  const diff = offer - myPrice;
  if (diff === 0) return { tone: "match" as const, text: "Matches your offer" };
  if (diff > 0) return { tone: "above" as const, text: `${naira(diff)} above your offer` };
  return { tone: "match" as const, text: `${naira(-diff)} below your offer` };
}
