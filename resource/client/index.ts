import { AdminWorld, cache, hidePrompt, loadLocaleTexts, menu, notify, onCache, onPromptPressed, onServerCallback, onServerEvent, showPrompt, triggerServerCallback, Zones } from "@aicore-fivem/lib/client";
import { record, vehicleTypeOfClass } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readLocations, readSettings } from "common/rental";

const world = new AdminWorld(["settings", "locations"]);
const texts = loadLocaleTexts();
const content = { settings: readSettings(world.get("settings")), locations: readLocations(world.get("locations")) };
const BLIP_TEXT = "AIRENTAL_BLIP";
AddTextEntry(BLIP_TEXT, "~a~");
const errorText = (v: unknown, fallback: string): string => {
  const key = typeof record(v).error === "string" ? String(record(v).error) : fallback;
  return texts[key] ?? key;
};

/**
 * Rental points: a rent prompt at the counter and, while the player has a rental, a return prompt in the return
 * radius (only in a vehicle). Built again when the panel changes them.
 */
class Points {
  private readonly zones = new Zones();
  private blips: number[] = [];
  private readonly inside = new Set<string>();
  renting = false;
  busy = false;

  rebuild(): void {
    this.zones.clear();
    for (const blip of this.blips) RemoveBlip(blip);
    this.blips = [];
    this.inside.clear();
    for (const at of content.locations.values()) {
      const rent = `rent:${at.id}`;
      this.zones.add(rent, { shape: { type: "sphere", center: at.coords, radius: 2 }, interval: 500, onEnter: () => showPrompt(rent, Locale("RENTAL_PROMPT_RENT", at.label)), onExit: () => hidePrompt(rent) });
      const back = `back:${at.id}`;
      this.zones.add(back, {
        shape: { type: "sphere", center: at.coords, radius: content.settings.returnRadius },
        interval: 500,
        onEnter: () => {
          this.inside.add(back);
          this.refresh();
        },
        onExit: () => {
          this.inside.delete(back);
          hidePrompt(back);
        },
      });
      if (at.blip) this.blip(at.coords, at.label);
    }
  }

  /** The return prompt shows while renting, in a vehicle, inside a return radius. */
  refresh(): void {
    for (const id of this.inside) {
      if (this.renting && cache.vehicle !== false) showPrompt(id, Locale("RENTAL_PROMPT_RETURN"));
      else hidePrompt(id);
    }
  }

  private blip(center: { x: number; y: number; z: number }, name: string): void {
    const blip = AddBlipForCoord(center.x, center.y, center.z);
    SetBlipSprite(blip, 225);
    SetBlipColour(blip, 2);
    SetBlipScale(blip, 0.7);
    SetBlipAsShortRange(blip, true);
    BeginTextCommandSetBlipName(BLIP_TEXT);
    AddTextComponentSubstringPlayerName(name);
    EndTextCommandSetBlipName(blip);
    this.blips.push(blip);
  }
}

const points = new Points();
points.rebuild();
world.onChange("settings", () => {
  content.settings = readSettings(world.get("settings"));
  points.rebuild();
});
world.onChange("locations", () => {
  content.locations = readLocations(world.get("locations"));
  points.rebuild();
});
onServerEvent(EVENTS.state, { args: ([active]) => (typeof active === "boolean" ? [active] : null) }, (active) => {
  points.renting = active;
  points.refresh();
});

onCache("vehicle", () => points.refresh());

/** The server asks which spawn type a model is; null when the game has no such vehicle. */
onServerCallback(EVENTS.vehicleType, (model) => {
  if (typeof model !== "string") return null;
  const hash = GetHashKey(model);
  return IsModelInCdimage(hash) && IsModelAVehicle(hash) ? vehicleTypeOfClass(GetVehicleClassFromName(hash)) : null;
});

async function rent(id: string): Promise<void> {
  const at = content.locations.get(id);
  if (!at) return;
  if (at.vehicles.length === 0) return notify(Locale("RENTAL_EMPTY"), "info");
  const duration = at.minutes > 0 ? Locale("RENTAL_MINUTES", at.minutes) : Locale("RENTAL_UNTIL_RETURN");
  const pick = await menu({
    title: at.label,
    items: at.vehicles.map((v) => ({ id: v.model, label: v.label, icon: "car", description: Locale("RENTAL_OFFER", v.fee, v.deposit, duration) })),
  });
  if (!pick) return;
  const result = record(await triggerServerCallback(EVENTS.rent, [id, pick]).catch(() => null));
  if (result.ok !== true) return notify(errorText(result, "RENTAL_ERR_FAR"), "error");
  notify(at.minutes > 0 ? Locale("RENTAL_RENTED", String(result.plate), at.minutes) : Locale("RENTAL_RENTED_OPEN", String(result.plate)), "success");
}

async function giveBack(id: string): Promise<void> {
  const result = record(await triggerServerCallback(EVENTS.giveBack, [id]).catch(() => null));
  if (result.ok !== true) return notify(errorText(result, "RENTAL_ERR_FAR"), "error");
  notify(Number(result.refund) > 0 ? Locale("RENTAL_RETURNED", Number(result.refund)) : Locale("RENTAL_RETURNED_NO_REFUND"), "success");
}

onPromptPressed((prompt) => {
  if (points.busy) return;
  const [kind, id = ""] = prompt.split(":");
  const run = kind === "rent" ? rent(id) : kind === "back" ? giveBack(id) : null;
  if (!run) return;
  points.busy = true;
  void run.finally(() => (points.busy = false));
});
