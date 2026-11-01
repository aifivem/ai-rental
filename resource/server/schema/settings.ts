import type { FileSpec, TabSpec } from "@aicore-fivem/shared";

export const settingsFile: FileSpec = {
  kind: "settings",
  sync: "all",
  sections: {
    account: { type: "text", lookup: "account", min: 2, max: 32 },
    platePrefix: {
      type: "text",
      min: 0,
      max: 4,
      pattern: "^[A-Za-z]{0,4}$",
    },
    returnRadius: { type: "number", min: 3, max: 50 },
  },
};

export const settingsTab: TabSpec = {
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
        {
          widget: "text",
          lookup: "account",
          path: "account",
          label: "ADMIN_F_ACCOUNT",
          hint: "ADMIN_H_ACCOUNT",
          placeholder: "ADMIN_P_ACCOUNT",
        },
        {
          widget: "text",
          path: "platePrefix",
          label: "ADMIN_F_PLATE_PREFIX",
          hint: "ADMIN_H_PLATE_PREFIX",
          placeholder: "RNT",
        },
        {
          widget: "number",
          path: "returnRadius",
          label: "ADMIN_F_RETURN_RADIUS",
          hint: "ADMIN_H_RETURN_RADIUS",
          min: 3,
          max: 50,
          unit: "m",
        },
      ],
    },
  ],
};
