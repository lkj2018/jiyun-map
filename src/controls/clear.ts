import type { ControlDef } from "./types";

export const clearControl: ControlDef = {
  id: "clear",
  label: "清除",
  title: "清除组件托管图层内容",
  onClick(ctx) {
    ctx.clearManagedLayers();
  },
};
