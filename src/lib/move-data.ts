import bus from "@/assets/vehicle-bus.png";
import minibus from "@/assets/vehicle-minibus.png";
import taxi from "@/assets/vehicle-taxi.png";
import emeka from "@/assets/driver-emeka.jpg";
import kelechi from "@/assets/driver-kelechi.jpg";
import ikechukwu from "@/assets/driver-ikechukwu.jpg";

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

export interface Place {
  id: string;
  short: string;
  name: string;
  area: string;
}

export const PICKUPS: Place[] = [
  { id: "garrison", short: "Garrison", name: "Garrison Bus Stop", area: "Port Harcourt" },
  { id: "mile1", short: "Mile 1", name: "Mile 1 Bus Stop", area: "Diobu, PH" },
  { id: "rumuola", short: "Rumuola", name: "Rumuola Bus Stop", area: "Rumuola, PH" },
];

export const PLACES: Place[] = [
  { id: "slaughter", short: "Slaughter", name: "Slaughter Bus Stop", area: "Trans-Amadi, PH" },
  { id: "artillery", short: "First Artillery", name: "First Artillery Bus Stop", area: "Rumuogba, PH" },
  { id: "shell", short: "Shell R/A", name: "Shell R/A Bus Stop", area: "Rumuobiakani, PH" },
  { id: "elelenwo", short: "Elelenwo", name: "Elelenwo Bus Stop", area: "Obio/Akpor, PH" },
  { id: "rumuokoro", short: "Rumuokoro", name: "Rumuokoro Junction", area: "Obio/Akpor, PH" },
  { id: "mile3", short: "Mile 3", name: "Mile 3 Park", area: "Diobu, PH" },
  { id: "waterlines", short: "Waterlines", name: "Waterlines Bus Stop", area: "Aba Road, PH" },
  { id: "agip", short: "Agip", name: "Agip Junction", area: "Ikwerre Road, PH" },
  { id: "choba", short: "Choba", name: "Choba Bus Stop", area: "Uniport, PH" },
  { id: "eleme", short: "Eleme Junction", name: "Eleme Junction", area: "Eleme, PH" },
  { id: "oilmill", short: "Oil Mill", name: "Oil Mill Bus Stop", area: "Rumuokwurusi, PH" },
  { id: "rumuomasi", short: "Rumuomasi", name: "Rumuomasi Bus Stop", area: "Rumuomasi, PH" },
];

export const placeById = (id: string) =>
  [...PLACES, ...PICKUPS].find((p) => p.id === id) ?? PLACES[0]!;

export interface NearbyDeal {
  vehicle: VehicleId;
  label: string;
  price: number;
  left: number;
  placeId: string;
  minutes: number;
}

export const NEARBY: NearbyDeal[] = [
  { vehicle: "bus", label: "Bus", price: 300, left: 7, placeId: "slaughter", minutes: 4 },
  { vehicle: "minibus", label: "Mini Bus", price: 400, left: 5, placeId: "artillery", minutes: 5 },
  { vehicle: "taxi", label: "Taxi", price: 750, left: 2, placeId: "shell", minutes: 7 },
  { vehicle: "bus", label: "Bus", price: 450, left: 2, placeId: "elelenwo", minutes: 9 },
];

export interface Driver {
  id: string;
  name: string;
  firstName: string;
  photo: string;
  rating: number;
  rides: number;
  car: string;
  color: string;
  plate: string;
  eta: number;
  free: number;
  phone: string;
}

export const DRIVERS: Driver[] = [
  {
    id: "emeka",
    name: "Emeka A.",
    firstName: "Emeka",
    photo: emeka,
    rating: 4.9,
    rides: 900,
    car: "Toyota Hiace",
    color: "Yellow",
    plate: "RBC567SW",
    eta: 2,
    free: 4,
    phone: "+2348030000001",
  },
  {
    id: "kelechi",
    name: "Kelechi Agu",
    firstName: "Kelechi",
    photo: kelechi,
    rating: 4.9,
    rides: 300,
    car: "Nissan Urvan",
    color: "White",
    plate: "PHC204KL",
    eta: 3,
    free: 7,
    phone: "+2348030000002",
  },
  {
    id: "ikechukwu",
    name: "Ikechukwu M.",
    firstName: "Ikechukwu",
    photo: ikechukwu,
    rating: 4.7,
    rides: 460,
    car: "Toyota Hiace",
    color: "Yellow",
    plate: "ABM881PH",
    eta: 3,
    free: 6,
    phone: "+2348030000003",
  },
];

export const driverById = (id: string | null) => DRIVERS.find((d) => d.id === id) ?? DRIVERS[0]!;

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

export function searchPlaces(q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return PLACES.filter(
    (p) => p.name.toLowerCase().includes(s) || p.area.toLowerCase().includes(s),
  );
}
