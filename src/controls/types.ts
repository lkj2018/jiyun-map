import type Map from "ol/Map";

export type ControlId = "reset" | "clear" | "switch";

export type ControlCtx = {
  map: Map;
  // 初始视图（用于 reset）
  initialCenter: [number, number]; // lon/lat
  initialZoom: number;

  // 底图（用于 switch）
  getBasemapKey: () => string;
  setBasemapKey: (key: string) => void;

  // 清理（用于 clear）
  clearManagedLayers: () => void;
  basemaps: { id: string; name: string }[];
};

export type ControlDef = {
  id: ControlId;
  label: string;
  title?: string;
  onClick: (ctx: ControlCtx) => void;
};
