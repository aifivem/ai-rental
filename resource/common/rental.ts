import {
  bool,
  int,
  num,
  type PlacePed,
  readBlipStyle,
  readPlacePed,
  record,
  str,
  vec4,
  type Vec4,
} from "@aicore-fivem/lib/shared";

/** ai-rental's contracts and panel content. No natives. */

export const EVENTS = {
  /** Callback: (locationId, vehicleKey) -> { ok, plate, minutes } rents a vehicle of the list at a rental point. */
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
const rows = (v: unknown) => (Array.isArray(v) ? v.map(record) : []);

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

/** A vehicle of the panel's vehicle list (record key `id`); rental points name these keys. */
export interface RentalVehicle {
  id: string;
  model: string;
  label: string;
  fee: number;
  deposit: number;
}

/** One vehicle of the list (`panel.records` / `world.records`); null without a model. */
export function readVehicle(
  id: string,
  v: Record<string, unknown>,
): RentalVehicle | null {
  if (typeof v.model !== "string" || !v.model) return null;
  return {
    id,
    model: v.model.toLowerCase(),
    label: str(v.label, v.model, 48),
    fee: int(v.fee, 0, 0),
    deposit: int(v.deposit, 0, 0),
  };
}

export interface Location {
  /** NPC standing at the place (panel), null for none. */
  ped: PlacePed | null;
  id: string;
  label: string;
  coords: Point;
  spawn: Vec4;
  blip: boolean;
  blipStyle: { sprite: number; color: number; scale: number };
  /** How long a rental lasts; 0 = until it is given back. */
  minutes: number;
  /** What this point rents out: keys of the vehicle list ("" rows left out), looked up on use (`offersAt`). */
  vehicles: string[];
}

/** One rental point (`panel.records` / `world.records`). */
export function readLocation(id: string, v: Record<string, unknown>): Location {
  return {
    ped: readPlacePed(v.ped),
    id,
    label: str(v.label, id, 48),
    coords: point(v.coords),
    spawn: vec4(v.spawn, { x: 0, y: 0, z: 0, heading: 0 }),
    blip: bool(v.blip, true),
    blipStyle: readBlipStyle(v.blipStyle, {
      sprite: 225,
      color: 2,
      scale: 0.7,
    }),
    minutes: int(v.minutes, 60, 0, 1440),
    vehicles: rows(v.vehicles).flatMap((row) =>
      typeof row.vehicle === "string" && row.vehicle ? [row.vehicle] : [],
    ),
  };
}

/** A rental point's offers from the vehicle list (a key no longer in the list is left out). */
export const offersAt = (
  location: Location,
  list: ReadonlyMap<string, RentalVehicle>,
): RentalVehicle[] =>
  location.vehicles.flatMap((key) => {
    const found = list.get(key);
    return found ? [found] : [];
  });
