import {
  AdminPanel,
  aiLog,
  aiLogChannels,
  entityCoords,
  isNear,
  isOnline,
  nearestVehicleAt,
  notify,
  onClientCallback,
  PlayerMap,
  randomPlate,
  resourceExport,
  spawnVehicle,
  vehicleKeys,
  vehicleType,
} from "@aicore-fivem/lib/server";
import {
  distance,
  fail,
  isRecord,
  oneArg,
  readText,
} from "@aicore-fivem/lib/shared";
import { Locale, ResourceName } from "common";
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
const settings = panel.view("settings", readSettings);
/** Panel content; locations are parsed again when they or the vehicle list change (their rows name list records). */
const content = {
  get settings() {
    return settings.value;
  },
  locations: readLocations(panel.get("locations"), vehicles()),
};
const readAllLocations = () =>
  (content.locations = readLocations(panel.get("locations"), vehicles()));
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

/** Share of the deposit a returned vehicle earns back: its engine and body health (1 = whole, 0 = wrecked). */
function condition(vehicle: number): number {
  const engine = Math.max(0, Math.min(1000, GetVehicleEngineHealth(vehicle)));
  const body = Math.max(0, Math.min(1000, GetVehicleBodyHealth(vehicle)));
  return (engine + body) / 2000;
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
  /** A drop ends the rental: vehicle gone, deposit kept. */
  private readonly active = new PlayerMap<Rental>({
    onDrop: (source, rental) => this.finish(source, rental, true),
  });

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
    if (nearestVehicleAt(location.spawn, 3)) return fail("RENTAL_ERR_BLOCKED");
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

    const plate = randomPlate(content.settings.platePrefix);
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
    // The player dropped while the vehicle was made: the drop handler already ran, so nothing may be stored.
    if (!isOnline(source)) {
      DeleteEntity(vehicle);
      aiLog("rentals", "renter left during the spawn", {
        source,
        metadata: { location: location.id, plate },
      });
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

  /** The vehicle back at a rental point: the deposit comes back scaled by the vehicle's condition. */
  giveBack(
    source: number,
    location: Location,
  ): { ok: true; refund: number; damaged: boolean } | ReturnType<typeof fail> {
    const rental = this.active.get(source);
    if (!rental) return fail("RENTAL_ERR_NONE");
    if (!DoesEntityExist(rental.vehicle)) {
      this.end(source, false);
      return { ok: true, refund: 0, damaged: true };
    }
    if (
      distance(entityCoords(rental.vehicle), location.coords) >
      content.settings.returnRadius
    )
      return fail("RENTAL_ERR_BRING");
    const share = condition(rental.vehicle);
    const refund = Math.floor(rental.deposit * share);
    this.end(source, true);
    if (refund > 0)
      core.AddMoney(source, content.settings.account, refund, "rental:deposit");
    aiLog("rentals", "gave a rental back", {
      source,
      metadata: {
        location: location.id,
        plate: rental.plate,
        refund,
        deposit: rental.deposit,
      },
    });
    return { ok: true, refund, damaged: share < 0.999 };
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
    this.finish(source, rental, remove);
  }

  private finish(source: number, rental: Rental, remove: boolean): void {
    if (rental.timer) clearTimeout(rental.timer);
    if (remove && DoesEntityExist(rental.vehicle)) {
      if (isOnline(source)) vehicleKeys.remove(source, rental.vehicle);
      DeleteEntity(rental.vehicle);
    }
    if (isOnline(source)) emitNet(EVENTS.state, source, false);
  }
}

const rentals = new Rentals();
onClientCallback(
  EVENTS.rent,
  {
    args: ([id, vehicle]): [string, string] | null => {
      const at = readText(id, 64);
      return at !== null &&
        typeof vehicle === "string" &&
        /^[a-z0-9_]{1,32}$/.test(vehicle)
        ? [at, vehicle]
        : null;
    },
    // Each rent walks the world's vehicles for a blocked spawn spot.
    rate: { count: 2, windowMs: 5_000 },
    lock: true,
  },
  async (source, id, vehicle) => {
    const at = content.locations.get(id);
    if (!at || !isNear(source, at.coords, 3)) return fail("RENTAL_ERR_FAR");
    return rentals.rent(source, at, vehicle);
  },
);

onClientCallback(
  EVENTS.giveBack,
  { args: oneArg((v) => readText(v, 64)), lock: true },
  (source, id) => {
    const at = content.locations.get(id);
    if (!at || !isNear(source, at.coords, content.settings.returnRadius))
      return fail("RENTAL_ERR_FAR");
    return rentals.giveBack(source, at);
  },
);

on("onResourceStop", (resource: string) => {
  if (resource !== ResourceName) return;
  rentals.endAll();
});
