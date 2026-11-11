/** World coordinates are pixels on the map artwork (1088 × 1920). */
export const WORLD = { w: 1088, h: 1920 };
export const PICKUP = { x: 544, y: 900 };
export const DROPOFF = { x: 790, y: 1030 };
export const DRIVER = { x: 705, y: 790 };
export const ROUTE = "M544 900 L556 1000 L652 972 L716 1046 L790 1030";
export const DRIVER_ROUTE = `M${DRIVER.x} ${DRIVER.y} L640 830 L600 860 L${PICKUP.x} ${PICKUP.y}`;

export const TRAFFIC: { kind: "bus" | "car"; path: string; dur: number; delay: number }[] = [
  { kind: "bus", path: "M392 640 L420 1180", dur: 22, delay: -4 },
  { kind: "car", path: "M720 600 L520 1000", dur: 18, delay: -9 },
  { kind: "bus", path: "M260 960 L860 900", dur: 26, delay: -12 },
  { kind: "car", path: "M620 1260 L730 740", dur: 20, delay: -3 },
  { kind: "bus", path: "M880 560 L930 1200", dur: 24, delay: -16 },
  { kind: "car", path: "M180 790 L500 830", dur: 16, delay: -6 },
  { kind: "car", path: "M600 460 L650 880", dur: 19, delay: -11 },
  { kind: "bus", path: "M470 1300 L560 1010", dur: 21, delay: -2 },
];
