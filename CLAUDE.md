# ai-rental

Basic vehicle rental: panel-set rental points rent vehicles for a fee and a deposit; the deposit comes back when the vehicle is given back in time. Depends on ai-core (money, menu, prompts, vehicle keys through its key layer); no database.

## Decisions

- One rental per player, in memory only: a rental ends with the session (drop or resource stop deletes the vehicle, the deposit is kept), so nothing needs a table.
- Fee and deposit are taken together from the panel's account (`settings.account`); the deposit goes back only on a return within the return radius while the vehicle still exists. A rental time of 0 runs until the vehicle is given back; otherwise the vehicle is deleted when the time runs out and the deposit is kept.
- The vehicle is created on the server (`CreateVehicleServerSetter`, type asked from the renter's client), gets a `<prefix><digits>` plate, a full tank (`VEHICLE_BAGS.fuel`), the renter in the driver seat and the keys through lib `vehicleKeys`.
- No NUI: the vehicle list is ai-core's menu (lib `menu`), prompts are ai-core's prompts.

## Contracts

- Callbacks and events: `resource/common/rental.ts` (`rent`, `giveBack`, server -> client `state`, server -> client callback `vehicleType`).
- Panel files: `data/settings.json` and `data/locations.json`, both `sync: "all"` (clients draw blips and prompts from them).

## Entry points

- Rental logic (rent, give back, expiry, cleanup): `resource/server/index.ts` `Rentals`.
- Prompts, blips and the menu: `resource/client/index.ts`.
