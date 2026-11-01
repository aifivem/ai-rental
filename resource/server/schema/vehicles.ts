import type { FileSpec, TabSpec } from "@aicore-fivem/shared";

const MONEY = {
  type: "number",
  min: 0,
  max: 1_000_000,
  integer: true,
} as const;

const MODEL = "^[a-z0-9_]{1,32}$";

export const vehiclesFile: FileSpec = {
  kind: "records",
  sync: "all",
  labelPath: "label",
  newRecord: { model: "blista", label: "", fee: 150, deposit: 300 },
  sections: {
    model: { type: "text", min: 1, max: 32, pattern: MODEL },
    label: { type: "text", min: 1, max: 48 },
    fee: MONEY,
    deposit: MONEY,
  },
};

export const vehiclesTab: TabSpec = {
  id: "vehicles",
  file: "vehicles",
  icon: "car-side",
  label: "ADMIN_TAB_VEHICLES",
  desc: "ADMIN_TAB_VEHICLES_DESC",
  createLabel: "ADMIN_NEW_VEHICLE",
  deleteLabel: "ADMIN_DELETE_VEHICLE",
  deleteDesc: "ADMIN_DELETE_VEHICLE_DESC",
  cards: [
    {
      icon: "car-side",
      title: "ADMIN_C_VEHICLE",
      desc: "ADMIN_C_VEHICLE_DESC",
      fields: [
        {
          widget: "model",
          kind: "vehicle",
          path: "model",
          label: "ADMIN_F_MODEL",
          hint: "ADMIN_H_MODEL",
          placeholder: "ADMIN_P_MODEL",
        },
        {
          widget: "text",
          path: "label",
          label: "ADMIN_F_VEHICLE_LABEL",
          hint: "ADMIN_H_VEHICLE_LABEL",
          placeholder: "ADMIN_P_VEHICLE_LABEL",
        },
        {
          widget: "number",
          path: "fee",
          label: "ADMIN_F_FEE",
          hint: "ADMIN_H_FEE",
          min: 0,
          max: 1_000_000,
          unit: "$",
        },
        {
          widget: "number",
          path: "deposit",
          label: "ADMIN_F_DEPOSIT",
          hint: "ADMIN_H_DEPOSIT",
          min: 0,
          max: 1_000_000,
          unit: "$",
        },
      ],
    },
  ],
};
