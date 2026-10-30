import {
  AdminPanel,
  aiLog,
  aiLogChannels,
  isOnline,
  notify,
  onClientCallback,
  resourceExport,
  spawnVehicle,
  vehicleKeys,
  vehicleType,
} from "@aicore-fivem/lib/server";
import { isRecord } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import {
  EVENTS,
  readLocations,
  readSettings,
  readVehicles,
  type Location,
} from "common/rental";
import { migrateLocations } from "./migrate";
import { rentalSchema } from "./schema";

const core = resourceExport("ai-core");
const panel = new AdminPanel(rentalSchema);
migrateLocations(panel);
const vehicles = () => readVehicles(panel.get("vehicles"));
/** Panel content, parsed again after every change. */
const content = {
  settings: readSettings(panel.get("settings")),
  locations: readLocations(panel.get("locations"), vehicles()),
};
const readAllLocations = () =>
  (content.locations = readLocations(panel.get("locations"), vehicles()));
panel.onChange(
  "settings",
  () => (content.settings = readSettings(panel.get("settings"))),
);
panel.onChange("vehicles", readAllLocations);
panel.onChange("locations", readAllLocations);
// A rental point's vehicle rows name records of the vehicle list ("" = a row not picked yet).
panel.rule("locations", (_key, next) => {
  const list = panel.get<Record<string, unknown>>("vehicles");
  const rows: unknown[] = Array.isArray(next.vehicles) ? next.vehicles : [];
  return rows.every((row) => {
    const key = isRecord(row) ? row.vehicle : undefined;
    return key === "" || (typeof key === "string" && key in list);
  })
    ? null
    : "ADMIN_ERR_LOOKUP";
});
aiLogChannels({ rentals: {} });

type Vec = { x: number; y: number; z: number };
const fail = (error: string) => ({ ok: false as const, error });
const posOf = (entity: number): Vec => {
  const [x = 0, y = 0, z = 0] = GetEntityCoords(entity);
  return { x, y, z };
};
const distance = (a: Vec, b: Vec) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const pedOf = (source: number) => GetPlayerPed(String(source));

/** Whether another vehicle stands on the spawn point. */
function spawnBlocked(at: Vec): boolean {
  for (const vehicle of GetAllVehicles() as number[])
    if (distance(posOf(vehicle), at) < 3) return true;
  return false;
}

interface Rental {
  location: string;
  vehicle: number;
  plate: string;
  deposit: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/** One rental per player, in memory (a rental ends with the session; the deposit only comes back on return). */
class Rentals {
  private readonly active = new Map<number, Rental>();

  has(source: number): boolean {
    return this.active.has(source);
  }

  async rent(
    source: number,
    location: Location,
    vehicleKey: string,
  ): Promise<
    { ok: true; plate: string; minutes: number } | ReturnType<typeof fail>
  > {
    if (this.active.has(source)) return fail("RENTAL_ERR_ACTIVE");
    const offer = location.vehicles.find((v) => v.id === vehicleKey);
    if (!offer) return fail("RENTAL_ERR_GONE");
    const model = offer.model;
    if (spawnBlocked(location.spawn)) return fail("RENTAL_ERR_BLOCKED");
    const type = await vehicleType(model, source);
    if (!type || !isOnline(source)) return fail("RENTAL_ERR_GONE");
    const total = offer.fee + offer.deposit;
    if (
      total > 0 &&
      !core.RemoveMoney(
        source,
        content.settings.account,
        total,
        `rental:${location.id}`,
      )
    )
      return fail("RENTAL_ERR_MONEY");

    const plate =
      `${content.settings.platePrefix}${Math.floor(Math.random() * 10 ** (8 - content.settings.platePrefix.length))}`.slice(
        0,
        8,
      );
    const vehicle = await spawnVehicle({
      model,
      type,
      coords: location.spawn,
      plate,
      fuel: 100,
      driver: source,
      keysTo: source,
      purpose: "rental",
    });
    if (vehicle === null) {
      if (total > 0)
        core.AddMoney(source, content.settings.account, total, "rental:refund");
      return fail("RENTAL_ERR_GONE");
    }

    const timer =
      location.minutes > 0
        ? setTimeout(() => this.expire(source), location.minutes * 60_000)
        : null;
    this.active.set(source, {
      location: location.id,
      vehicle,
      plate,
      deposit: offer.deposit,
      timer,
    });
    emitNet(EVENTS.state, source, true);
    aiLog("rentals", `rented ${model}`, {
      source,
      metadata: {
        location: location.id,
        vehicle: offer.id,
        plate,
        fee: offer.fee,
        deposit: offer.deposit,
      },
    });
    return { ok: true, plate, minutes: location.minutes };
  }

  /** The vehicle back at a rental point: the deposit comes back while the vehicle is still whole. */
  giveBack(
    source: number,
    location: Location,
  ): { ok: true; refund: number } | ReturnType<typeof fail> {
    const rental = this.active.get(source);
    if (!rental) return fail("RENTAL_ERR_NONE");
    if (!DoesEntityExist(rental.vehicle)) {
      this.end(source, false);
      return { ok: true, refund: 0 };
    }
    if (
      distance(posOf(rental.vehicle), location.coords) >
      content.settings.returnRadius
    )
      return fail("RENTAL_ERR_BRING");
    const refund = rental.deposit;
    this.end(source, true);
    if (refund > 0)
      core.AddMoney(source, content.settings.account, refund, "rental:deposit");
    aiLog("rentals", "gave a rental back", {
      source,
      metadata: { location: location.id, plate: rental.plate, refund },
    });
    return { ok: true, refund };
  }

  /** The time ran out: the vehicle goes, the deposit is kept. */
  private expire(source: number): void {
    const rental = this.active.get(source);
    if (!rental) return;
    notify(source, Locale("RENTAL_EXPIRED"), "warning");
    aiLog("rentals", "rental time ran out", {
      source,
      metadata: { plate: rental.plate },
    });
    this.end(source, true);
  }

  /** Ends every rental (resource stop). */
  endAll(): void {
    // Deleting the current entry while iterating a Map is safe.
    for (const source of this.active.keys()) this.end(source, true);
  }

  /** Ends a rental; `remove` takes the vehicle and the keys away. */
  end(source: number, remove: boolean): void {
    const rental = this.active.get(source);
    if (!rental) return;
    this.active.delete(source);
    if (rental.timer) clearTimeout(rental.timer);
    if (remove && DoesEntityExist(rental.vehicle)) {
      if (isOnline(source)) vehicleKeys.remove(source, rental.vehicle);
      DeleteEntity(rental.vehicle);
    }
    if (isOnline(source)) emitNet(EVENTS.state, source, false);
  }
}

const rentals = new Rentals();
const location = (id: unknown): Location | null =>
  typeof id === "string" ? (content.locations.get(id) ?? null) : null;

onClientCallback(
  EVENTS.rent,
  {
    args: ([id, vehicle]): [string, string] | null =>
      typeof id === "string" &&
      typeof vehicle === "string" &&
      /^[a-z0-9_]{1,32}$/.test(vehicle)
        ? [id, vehicle]
        : null,
    lock: true,
  },
  async (source, id, vehicle) => {
    const at = location(id);
    if (!at || distance(posOf(pedOf(source)), at.coords) > 3)
      return fail("RENTAL_ERR_FAR");
    return rentals.rent(source, at, vehicle);
  },
);

onClientCallback(
  EVENTS.giveBack,
  { args: ([id]) => (typeof id === "string" ? [id] : null), lock: true },
  (source, id) => {
    const at = location(id);
    if (
      !at ||
      distance(posOf(pedOf(source)), at.coords) > content.settings.returnRadius
    )
      return fail("RENTAL_ERR_FAR");
    return rentals.giveBack(source, at);
  },
);

on("playerDropped", () => rentals.end(Number(globalThis.source), true));
on("onResourceStop", (resource: string) => {
  if (resource !== GetCurrentResourceName()) return;
  rentals.endAll();
});
