import { useSyncExternalStore } from "react";
import { PICKUPS, type VehicleId } from "./move-data";
import type { Place } from "./geo";

export type Role = "passenger" | "driver";

export interface User {
  name: string;
  email: string;
  phone: string;
  role: Role | null;
  photo: string | null;
}

export type RideStage =
  | "idle"
  | "choose"
  | "finding"
  | "arriving"
  | "here"
  | "started"
  | "tracking"
  | "arrived";

export interface Ride {
  stage: RideStage;
  pickup: Place;
  dropoff: Place | null;
  /** Real road distance (m) and driving time (s) once the route is known. */
  trip: { distance: number; duration: number } | null;
  vehicle: VehicleId;
  seats: number;
  price: number;
  recommended: number;
  payment: "Cash" | "Card" | "Transfer";
  driverId: string | null;
  extraBags: boolean;
}

export interface PastRide {
  id: string;
  date: string;
  pickup: Place;
  dropoff: Place;
  driverId: string;
  vehicle: VehicleId;
  seats: number;
  total: number;
  rating: number;
  payment: string;
}

interface State {
  user: User;
  ride: Ride;
  history: PastRide[];
  permissions: { location: boolean; notifications: boolean };
}

const KEY = "move-naija:v2";

export const emptyRide = (pickup: Place = PICKUPS[0]!): Ride => ({
  stage: "idle",
  pickup,
  dropoff: null,
  trip: null,
  vehicle: "bus",
  seats: 1,
  price: 300,
  recommended: 300,
  payment: "Cash",
  driverId: null,
  extraBags: false,
});

const initial: State = {
  user: { name: "", email: "", phone: "", role: null, photo: null },
  ride: emptyRide(),
  history: [],
  permissions: { location: false, notifications: false },
};

let state: State = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>;
      state = { ...initial, ...saved };
      // Older saves without real coordinates start a fresh ride.
      if (!state.ride?.pickup || typeof state.ride.pickup.lng !== "number") state = { ...state, ride: emptyRide() };
    }
  } catch {
    /* ignore corrupt storage */
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full — keep in memory */
  }
}

export function getState() {
  load();
  return state;
}

export function setState(updater: (s: State) => State) {
  load();
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

export const updateUser = (patch: Partial<User>) =>
  setState((s) => ({ ...s, user: { ...s.user, ...patch } }));

export const updateRide = (patch: Partial<Ride>) =>
  setState((s) => ({ ...s, ride: { ...s.ride, ...patch } }));

export const resetRide = () => setState((s) => ({ ...s, ride: emptyRide(s.ride.pickup) }));

export const addHistory = (r: PastRide) =>
  setState((s) => ({ ...s, history: [r, ...s.history] }));

export const resetAll = () => setState(() => initial);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useMove<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(initial),
  );
}
