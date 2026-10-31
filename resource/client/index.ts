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
import { RecordObjects } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import {
  EVENTS,
  offersAt,
  readLocation,
  readSettings,
  readVehicle,
} from "common/rental";

const world = new AdminWorld(["settings", "vehicles", "locations"]);
const settings = world.view("settings", readSettings);
/** The vehicle list: looked up when the menu opens, so a list edit rebuilds no point. */
const vehicles = world.records("vehicles", readVehicle);
const FALLBACK = { fallback: "RENTAL_ERR_FAR" };
let renting = false;

/**
 * Rental points: a rent point at the counter and, while the player has a rental, a return point in the return
 * radius (only in a vehicle). An edited point rebuilds only its own; the return radius (settings) rebuilds all.
 */
const points = new Points();
const locations = new RecordObjects(
  world,
  "locations",
  readLocation,
  (id, at) => {
    points.add(`rent:${id}`, {
      ped: at.ped ?? undefined,
      coords: at.coords,
      label: Locale("RENTAL_PROMPT_RENT", at.label),
      icon: "car",
      blip: at.blip ? { ...at.blipStyle, label: at.label } : undefined,
      onPressed: () => rent(id),
    });
    points.add(`back:${id}`, {
      coords: at.coords,
      label: Locale("RENTAL_PROMPT_RETURN"),
      icon: "rotate-left",
      radius: settings.value.returnRadius,
      canShow: () => renting && cache.vehicle !== false,
      onPressed: () => giveBack(id),
    });
    return () => {
      points.remove(`rent:${id}`);
      points.remove(`back:${id}`);
    };
  },
);
world.onChange("settings", () => locations.rebuildAll());
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
  const at = locations.records.get(id);
  if (!at) return;
  const offers = offersAt(at, vehicles);
  if (offers.length === 0) return notify(Locale("RENTAL_EMPTY"), "info");
  const duration =
    at.minutes > 0
      ? Locale("RENTAL_MINUTES", at.minutes)
      : Locale("RENTAL_UNTIL_RETURN");
  const pick = await menu({
    title: at.label,
    items: offers.map((v) => ({
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
