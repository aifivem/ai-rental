import {
  BLIP_STYLE_FIELDS,
  PLACE_PED_SPEC,
  placePedFields,
} from "@aicore-fivem/lib/shared";
import type { FileSpec, TabSpec } from "@aicore-fivem/shared";

export const locationsFile: FileSpec = {
  kind: "records",
  sync: "all",
  labelPath: "label",
  newRecord: {
    label: "",
    coords: { x: 0, y: 0, z: 0 },
    spawn: { x: 0, y: 0, z: 0, heading: 0 },
    blip: true,
    blipStyle: { sprite: 225, color: 2, scale: 0.7 },
    minutes: 60,
    vehicles: [],
  },
  sections: {
    ped: PLACE_PED_SPEC,
    label: { type: "text", min: 1, max: 48 },
    coords: { type: "vec3" },
    spawn: { type: "vec4" },
    blip: { type: "bool" },
    blipStyle: {
      type: "object",
      optional: true,
      fields: BLIP_STYLE_FIELDS,
    },
    minutes: { type: "number", min: 0, max: 1440, integer: true },
    vehicles: {
      type: "list",
      max: 30,
      of: {
        type: "object",
        // A key of the vehicles file ("" = not picked yet); checked by the rule in server/index.ts.
        fields: {
          vehicle: { type: "text", min: 0, max: 32, records: "vehicles" },
        },
      },
    },
  },
};

export const locationsTab: TabSpec = {
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
        {
          widget: "text",
          path: "label",
          suggest: { from: "coords" },
          label: "ADMIN_F_LABEL",
          placeholder: "ADMIN_P_LABEL",
        },
        {
          widget: "point",
          path: "coords",
          label: "ADMIN_F_COORDS",
          hint: "ADMIN_H_COORDS",
          ground: true,
        },
        {
          widget: "point",
          path: "spawn",
          label: "ADMIN_F_SPAWN",
          hint: "ADMIN_H_SPAWN",
          heading: true,
          ground: true,
        },
        { widget: "switch", path: "blip", label: "ADMIN_F_BLIP" },
        { widget: "blip", path: "blipStyle", label: "ADMIN_F_BLIP_STYLE" },
        {
          widget: "number",
          path: "minutes",
          label: "ADMIN_F_MINUTES",
          hint: "ADMIN_H_MINUTES",
          min: 0,
          max: 1440,
          unit: "min",
        },
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
          newRow: { vehicle: "" },
          rows: [
            {
              widget: "text",
              path: "vehicle",
              records: "vehicles",
              label: "ADMIN_F_VEHICLE",
              placeholder: "ADMIN_P_VEHICLE",
            },
          ],
        },
      ],
    },
    {
      icon: "user",
      title: "ADMIN_C_PED",
      desc: "ADMIN_C_PED_DESC",
      fields: placePedFields(),
    },
  ],
};
