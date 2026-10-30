import { bool, int, num, record, str, vec4, type Vec4 } from "@aicore-fivem/lib/shared";

/** ai-rental's contracts and panel content. No natives. */

export const EVENTS = {
  /** Callback: (locationId, model) -> { ok, plate, minutes } rents a vehicle at a rental point. */
  rent: "ai-rental:rent",
  /** Callback: (locationId) -> { ok, refund } brings the rented vehicle back. */
  giveBack: "ai-rental:giveBack",
  /** Server -> client: (active: boolean) whether the player has a rental (for the return prompt). */
  state: "ai-rental:state",
} as const;

type Point = { x: number; y: number; z: number };
const point = (v: unknown): Point => {
  const p = record(v);
  return { x: num(p.x, 0), y: num(p.y, 0), z: num(p.z, 0) };
};
const list = (v: unknown) => (Array.isArray(v) ? v.map(record) : []);

export interface Settings {
  /** ai-core account the fee and deposit are paid from and the deposit goes back to. */
  account: string;
  /** Up to 4 letters in front of the plate number. */
  platePrefix: string;
  /** Metres from the rental point where a rented vehicle can be given back. */
  returnRadius: number;
}

export function readSettings(raw: unknown): Settings {
  const v = record(raw);
  return {
    account: str(v.account, "bank", 32),
    platePrefix: str(v.platePrefix, "RNT", 4).toUpperCase(),
    returnRadius: num(v.returnRadius, 15, 3, 50),
  };
}

export interface RentalVehicle {
  model: string;
  label: string;
  fee: number;
  deposit: number;
}

export interface Location {
  id: string;
  label: string;
  coords: Point;
  spawn: Vec4;
  blip: boolean;
  blipStyle: { sprite: number; color: number; scale: number };
  /** How long a rental lasts; 0 = until it is given back. */
  minutes: number;
  vehicles: RentalVehicle[];
}

export function readLocations(raw: unknown): Map<string, Location> {
  const out = new Map<string, Location>();
  for (const [id, value] of Object.entries(record(raw))) {
    const v = record(value);
    const vehicles = list(v.vehicles).flatMap((row) =>
      typeof row.model === "string" && row.model
        ? [{ model: row.model.toLowerCase(), label: str(row.label, row.model, 48), fee: int(row.fee, 0, 0), deposit: int(row.deposit, 0, 0) }]
        : [],
    );
    out.set(id, {
      id,
      label: str(v.label, id, 48),
      coords: point(v.coords),
      spawn: vec4(v.spawn, { x: 0, y: 0, z: 0, heading: 0 }),
      blip: bool(v.blip, true),
      blipStyle: { sprite: int(record(v.blipStyle).sprite, 225, 0, 1000), color: int(record(v.blipStyle).color, 2, 0, 100), scale: num(record(v.blipStyle).scale, 0.7, 0.3, 2) },
      minutes: int(v.minutes, 60, 0, 1440),
      vehicles,
    });
  }
  return out;
}
