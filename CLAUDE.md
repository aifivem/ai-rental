# ai-rental

Basic vehicle rental: panel-set rental points rent vehicles for a fee and a deposit; the deposit comes back when the vehicle is given back in time. Depends on ai-core (money, menu, prompts, vehicle keys through its key layer); no database.

## Decisions

- One rental per player, in memory only: a rental ends with the session (drop or resource stop deletes the vehicle, the deposit is kept), so nothing needs a table.
- Fee and deposit are taken together from the panel's account (`settings.account`); the deposit goes back only on a return within the return radius while the vehicle still exists, scaled by its condition ((engine + body health) / 2000; a wreck returns nothing). A rental time of 0 runs until the vehicle is given back; otherwise the vehicle is deleted when the time runs out and the deposit is kept.
- Rentals are a lib `PlayerMap` (a drop deletes the vehicle). A player who drops while `spawnVehicle` is awaited gets nothing stored: the new vehicle is deleted at once. The blocked-spawn check is lib `nearestVehicleAt(spawn, 3)` (walks every vehicle), so `rent` is limited to 2 calls per 5 s.
- The vehicle is created with lib `spawnVehicle` (type asked from the renter's client), gets a lib `randomPlate(prefix)` plate (`<prefix><digits>`, 8 characters), a full tank (`VEHICLE_BAGS.fuel`), the renter in the driver seat and the keys through lib `vehicleKeys`.
- No NUI: the vehicle list is ai-core's menu (lib `menu`), prompts are ai-core's prompts.
- Vehicles are one list (`data/vehicles.json`, records: model, label, fee, deposit); a rental point's `vehicles` rows are `{ vehicle: <record key> }` picked with the panel's `records: "vehicles"` text widget. The lib checks `records` only on top-level sections, so the `locations` rule in `server/content.ts` refuses a row key that is not in the list ("" = a row not picked yet, skipped by the reader). A deleted list vehicle silently leaves every point. The rent callback takes the vehicle key, not the model.
- `server/migrate.ts` turns old inline rows (`{ model, label, fee, deposit }`) into list records at start (one record per distinct offer, key = model, `_2`... on a clash) and rewrites the point; keep it while old data files may exist.

## Contracts

- Callbacks and events: `resource/common/rental.ts` (`rent`, `giveBack`, server -> client `state`, server -> client callback `vehicleType`).
- Panel files: `data/settings.json`, `data/vehicles.json` and `data/locations.json`, all `sync: "all"` (clients draw blips, prompts and the menu from them).

## Entry points

- Rental logic (rent, give back, expiry, cleanup): `resource/server/rentals/rentals.ts` `Rentals` (deposit share `condition.ts`), its callbacks and stop cleanup `rentals/index.ts`; panel, migration and the `locations` rule `server/content.ts`, schema `server/schema/` (one file per tab).
- Prompts, blips and the menu: `resource/client/rental.ts` (lib `RecordObjects`: an edited rental point rebuilds only its points, the return radius setting all; a point keeps its vehicle keys and looks them up in the list when the menu opens or a rent arrives, so a vehicle list edit rebuilds nothing).
