import type { PanelSchema } from "@aicore-fivem/shared";

const MODEL = "^[a-z0-9_]{1,32}$";

/** ai-rental's panel: rental points with their vehicles, and the money settings. */
export const rentalSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "car",
  files: {
    settings: {
      kind: "settings",
      sync: "all",
      sections: {
        account: { type: "text", min: 2, max: 32 },
        platePrefix: { type: "text", min: 0, max: 4, pattern: "^[A-Za-z]{0,4}$" },
        returnRadius: { type: "number", min: 3, max: 50 },
      },
    },
    locations: {
      kind: "records",
      sync: "all",
      labelPath: "label",
      newRecord: { label: "", coords: { x: 0, y: 0, z: 0 }, spawn: { x: 0, y: 0, z: 0, heading: 0 }, blip: true, minutes: 60, vehicles: [] },
      sections: {
        label: { type: "text", min: 1, max: 48 },
        coords: { type: "vec3" },
        spawn: { type: "vec4" },
        blip: { type: "bool" },
        minutes: { type: "number", min: 0, max: 1440, integer: true },
        vehicles: {
          type: "list",
          max: 30,
          of: {
            type: "object",
            fields: {
              model: { type: "text", min: 1, max: 32, pattern: MODEL },
              label: { type: "text", min: 1, max: 48 },
              fee: { type: "number", min: 0, max: 1_000_000, integer: true },
              deposit: { type: "number", min: 0, max: 1_000_000, integer: true },
            },
          },
        },
      },
    },
  },
  tabs: [
    {
      id: "locations",
      file: "locations",
      icon: "car",
      label: "ADMIN_TAB_LOCATIONS",
      desc: "ADMIN_TAB_LOCATIONS_DESC",
      createLabel: "ADMIN_NEW_LOCATION",
      deleteLabel: "ADMIN_DELETE_LOCATION",
      deleteDesc: "ADMIN_DELETE_LOCATION_DESC",
      cards: [
        {
          icon: "location-dot",
          title: "ADMIN_C_LOCATION",
          desc: "ADMIN_C_LOCATION_DESC",
          fields: [
            { widget: "text", path: "label", label: "ADMIN_F_LABEL", placeholder: "ADMIN_P_LABEL" },
            { widget: "point", path: "coords", label: "ADMIN_F_COORDS", hint: "ADMIN_H_COORDS", ground: true },
            { widget: "point", path: "spawn", label: "ADMIN_F_SPAWN", hint: "ADMIN_H_SPAWN", heading: true, ground: true },
            { widget: "switch", path: "blip", label: "ADMIN_F_BLIP" },
            { widget: "number", path: "minutes", label: "ADMIN_F_MINUTES", hint: "ADMIN_H_MINUTES", min: 0, max: 1440, unit: "min" },
          ],
        },
        {
          icon: "car-side",
          title: "ADMIN_C_VEHICLES",
          desc: "ADMIN_C_VEHICLES_DESC",
          fields: [
            {
              widget: "list",
              path: "vehicles",
              label: "ADMIN_F_VEHICLES",
              addLabel: "ADMIN_ADD_VEHICLE",
              max: 30,
              newRow: { model: "blista", label: "Blista", fee: 150, deposit: 300 },
              rows: [
                { widget: "text", path: "model", label: "ADMIN_F_MODEL", placeholder: "ADMIN_P_MODEL" },
                { widget: "text", path: "label", label: "ADMIN_F_VEHICLE_LABEL", placeholder: "ADMIN_P_VEHICLE_LABEL" },
                { widget: "number", path: "fee", label: "ADMIN_F_FEE", min: 0, max: 1_000_000, unit: "$" },
                { widget: "number", path: "deposit", label: "ADMIN_F_DEPOSIT", min: 0, max: 1_000_000, unit: "$" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "settings",
      file: "settings",
      icon: "sliders",
      label: "ADMIN_TAB_SETTINGS",
      desc: "ADMIN_TAB_SETTINGS_DESC",
      cards: [
        {
          icon: "sliders",
          title: "ADMIN_C_SETTINGS",
          desc: "ADMIN_C_SETTINGS_DESC",
          fields: [
            { widget: "text", path: "account", label: "ADMIN_F_ACCOUNT", hint: "ADMIN_H_ACCOUNT", placeholder: "ADMIN_P_ACCOUNT" },
            { widget: "text", path: "platePrefix", label: "ADMIN_F_PLATE_PREFIX", hint: "ADMIN_H_PLATE_PREFIX", placeholder: "RNT" },
            { widget: "number", path: "returnRadius", label: "ADMIN_F_RETURN_RADIUS", hint: "ADMIN_H_RETURN_RADIUS", min: 3, max: 50, unit: "m" },
          ],
        },
      ],
    },
  ],
};
