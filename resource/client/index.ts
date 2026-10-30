import {
  AdminWorld,
  cache,
  callAction,
  menu,
  notify,
  onCache,
  onServerEvent,
  Points,
} from "@aicore-fivem/lib/client";
import { Locale } from "common";
import {
  EVENTS,
  readLocations,
  readSettings,
  readVehicles,
} from "common/rental";

const world = new AdminWorld(["settings", "vehicles", "locations"]);
const readAllLocations = () =>
  readLocations(world.get("locations"), readVehicles(world.get("vehicles")));
const settings = world.view("settings", readSettings);
const content = {
  locations: readAllLocations(),
};
const FALLBACK = { fallback: "RENTAL_ERR_FAR" };
let renting = false;

/**
 * Rental points: a rent point at the counter and, while the player has a rental, a return point in the return
 * radius (only in a vehicle). Built again when the panel changes them.
 */
const points = new Points();
function rebuild(): void {
  points.clear();
  for (const at of content.locations.values()) {
    points.add(`rent:${at.id}`, {
      ped: at.ped ?? undefined,
      coords: at.coords,
      label: Locale("RENTAL_PROMPT_RENT", at.label),
      icon: "car",
      blip: at.blip ? { ...at.blipStyle, label: at.label } : undefined,
      onPressed: () => rent(at.id),
    });
    points.add(`back:${at.id}`, {
      coords: at.coords,
      label: Locale("RENTAL_PROMPT_RETURN"),
      icon: "rotate-left",
      radius: settings.value.returnRadius,
      canShow: () => renting && cache.vehicle !== false,
      onPressed: () => giveBack(at.id),
    });
  }
}

rebuild();
world.onChange("settings", rebuild);
const locationsChanged = () => {
  content.locations = readAllLocations();
  rebuild();
};
world.onChange("vehicles", locationsChanged);
world.onChange("locations", locationsChanged);
onServerEvent(
  EVENTS.state,
  { args: ([active]) => (typeof active === "boolean" ? [active] : null) },
  (active) => {
    renting = active;
    points.refresh();
  },
);
onCache("vehicle", () => points.refresh());

async function rent(id: string): Promise<void> {
  const at = content.locations.get(id);
  if (!at) return;
  if (at.vehicles.length === 0) return notify(Locale("RENTAL_EMPTY"), "info");
  const duration =
    at.minutes > 0
      ? Locale("RENTAL_MINUTES", at.minutes)
      : Locale("RENTAL_UNTIL_RETURN");
  const pick = await menu({
    title: at.label,
    items: at.vehicles.map((v) => ({
      id: v.id,
      label: v.label,
      icon: "car",
      description: Locale("RENTAL_OFFER", v.fee, v.deposit, duration),
    })),
  });
  if (!pick) return;
  const result = await callAction(EVENTS.rent, [id, pick], FALLBACK);
  if (!result) return;
  notify(
    at.minutes > 0
      ? Locale("RENTAL_RENTED", String(result.plate), at.minutes)
      : Locale("RENTAL_RENTED_OPEN", String(result.plate)),
    "success",
  );
}

async function giveBack(id: string): Promise<void> {
  const result = await callAction(EVENTS.giveBack, [id], FALLBACK);
  if (!result) return;
  const refund = typeof result.refund === "number" ? result.refund : 0;
  notify(
    refund <= 0
      ? Locale("RENTAL_RETURNED_NO_REFUND")
      : result.damaged === true
        ? Locale("RENTAL_RETURNED_DAMAGED", refund)
        : Locale("RENTAL_RETURNED", refund),
    "success",
  );
}
