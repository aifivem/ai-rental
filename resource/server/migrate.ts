import type { AdminPanel } from "@aicore-fivem/lib/server";
import { int, record, str } from "@aicore-fivem/lib/shared";

type Offer = { model: string; label: string; fee: number; deposit: number };

/** The record key for an old vehicle row: its model, `_2`, `_3`... when that key holds a different offer. */
function keyFor(vehicles: Record<string, unknown>, offer: Offer): string {
  const base = offer.model.replace(/[^a-z0-9_]/g, "_").padEnd(2, "_");
  for (let n = 1; ; n++) {
    const key = n === 1 ? base.slice(0, 32) : `${base.slice(0, 28)}_${n}`;
    const found = vehicles[key];
    if (found === undefined) return key;
    const v = record(found);
    if (
      v.model === offer.model &&
      v.label === offer.label &&
      v.fee === offer.fee &&
      v.deposit === offer.deposit
    )
      return key;
  }
}

/**
 * Rental points used to carry their own vehicle rows (`{ model, label, fee, deposit }`); each row becomes a record of
 * the vehicle list (one record per distinct offer) and the point keeps `{ vehicle: key }`. Runs at start; a point
 * already in the new shape is left alone.
 */
export function migrateLocations(panel: AdminPanel): void {
  const vehicles = { ...panel.get<Record<string, unknown>>("vehicles") };
  const locations = panel.get<Record<string, unknown>>("locations");
  for (const [id, raw] of Object.entries(locations)) {
    const location = record(raw);
    const rows = Array.isArray(location.vehicles) ? location.vehicles : [];
    if (!rows.some((row) => typeof record(row).model === "string")) continue;
    const refs = rows.flatMap((row: unknown) => {
      const r = record(row);
      if (typeof r.vehicle === "string") return [{ vehicle: r.vehicle }];
      if (typeof r.model !== "string" || !r.model) return [];
      const model = r.model.toLowerCase();
      const offer: Offer = {
        model,
        label: str(r.label, model, 48),
        fee: int(r.fee, 0, 0, 1_000_000),
        deposit: int(r.deposit, 0, 0, 1_000_000),
      };
      const key = keyFor(vehicles, offer);
      if (!(key in vehicles)) {
        vehicles[key] = offer;
        panel.commit("vehicles", key, offer);
      }
      return [{ vehicle: key }];
    });
    panel.commit("locations", id, { ...location, vehicles: refs });
  }
}
