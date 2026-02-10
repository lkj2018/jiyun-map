import type { ControlDef } from "./types";
import { fromLonLat } from "ol/proj";

export const resetControl: ControlDef = {
  id: "reset",
  label: "重置",
  title: "回到初始视角",
  onClick(ctx) {
    const view = ctx.map.getView();
    view.setCenter(fromLonLat(ctx.initialCenter));
    view.setZoom(ctx.initialZoom);
  },
};
