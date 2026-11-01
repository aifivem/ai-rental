import { AdminPanel } from "@aicore-fivem/lib/server";
import { isRecord } from "@aicore-fivem/lib/shared";
import { readLocation, readSettings, readVehicle } from "common/rental";
import { migrateLocations } from "./migrate";
import { rentalSchema } from "./schema";

const panel = new AdminPanel(rentalSchema);
migrateLocations(panel);
const settings = panel.view("settings", readSettings);
/** Panel content, one record re-read per edit; a point's rows name vehicle list keys, looked up on rent. */
export const content = {
  get settings() {
    return settings.value;
  },
  vehicles: panel.records("vehicles", readVehicle),
  locations: panel.records("locations", readLocation),
};
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
