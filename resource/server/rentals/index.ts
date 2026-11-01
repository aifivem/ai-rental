import {
  aiLogChannels,
  isNear,
  onClientCallback,
  onStop,
} from "@aicore-fivem/lib/server";
import { fail, oneArg, readText } from "@aicore-fivem/lib/shared";
import { EVENTS } from "common/rental";
import { content } from "../content";
import { Rentals } from "./rentals";

aiLogChannels({ rentals: {} });

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

onStop(() => {
  rentals.endAll();
});
