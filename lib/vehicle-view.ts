export const VEHICLES = [
  "electric_bus",
  "construction_truck",
  "maintenance_van",
] as const;
export type Vehicle = (typeof VEHICLES)[number];
export const VEHICLE_LABELS: Record<Vehicle, string> = {
  electric_bus: "Electric bus",
  construction_truck: "Construction truck",
  maintenance_van: "Maintenance van",
};
/**
 * Scales the traffic fleet with user-placed roads:
 * Starts with the 3 base vehicles, adding another trio every 10 placed roads.
 */
export function trafficFleet(roadCount: number): Vehicle[] {
  const sets = 1 + Math.floor(Math.max(0, roadCount) / 10);
  const fleet: Vehicle[] = [];
  for (let s = 0; s < sets; s++) {
    fleet.push(...VEHICLES);
  }
  return fleet;
}
export const DIRECTIONS = [
  "lower_right",
  "down",
  "lower_left",
  "left",
  "upper_left",
  "up",
  "upper_right",
  "right",
] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const screenHeading = (angle: number) =>
  Math.atan2(
    0.5625 * (Math.cos(angle) + Math.sin(angle)),
    Math.cos(angle) - Math.sin(angle),
  );
export function vehicleView(angle: number) {
  const target = screenHeading(angle);
  let best = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < 8; i++) {
    const delta = Math.atan2(
      Math.sin(target - screenHeading((i * Math.PI) / 4)),
      Math.cos(target - screenHeading((i * Math.PI) / 4)),
    );
    if (Math.abs(delta) < Math.abs(bestDelta)) {
      bestDelta = delta;
      best = i;
    }
  }
  return {
    direction: DIRECTIONS[best],
    rotation: (bestDelta * 180) / Math.PI,
  };
}
export function vehicleSize(vehicle: Vehicle, angle: number) {
  const length = vehicle === "electric_bus" ? 17 : 13,
    width = 4.8,
    height = vehicle === "electric_bus" ? 6 : 5;
  const along = Math.abs(Math.cos(angle) - Math.sin(angle));
  const across = Math.abs(Math.cos(angle) + Math.sin(angle));
  return {
    width: along * length + across * width,
    height: 0.5625 * (across * length + along * width) + height,
    lift: height / 2,
  };
}
