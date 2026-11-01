import type { PanelSchema } from "@aicore-fivem/shared";
import { locationsFile, locationsTab } from "./locations";
import { vehiclesFile, vehiclesTab } from "./vehicles";
import { settingsFile, settingsTab } from "./settings";

/** ai-rental's panel: the vehicle list, rental points that pick from it, and the money settings. */
export const rentalSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "car",
  files: {
    settings: settingsFile,
    vehicles: vehiclesFile,
    locations: locationsFile,
  },
  tabs: [locationsTab, vehiclesTab, settingsTab],
};
