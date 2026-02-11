export type BlendMode = "normal" | "add" | "multiply";

export type FactorDef = {
  id: string;
  name: string;
  legendId: string;

  api: {
    endpointKey: "cog";
      // 根据时间返回该时次的 COG 地址（或接口返回的 presigned url）
    buildCogUrl: (timeMs: number | null) => '/test6.tif';
  };

  render?: {
    opacity?: number; // default 0.7
    zIndex?: number;  // default 50
    blend?: BlendMode;
  };

  meta?: Record<string, any>;
};

export type LegendStop = { value: number; color: string; label?: string };

export type LegendDef = {
  id: string;
  name: string;
  unit?: string;
  stops: LegendStop[];
  nodataColor?: string; // default transparent
};

export type ViewState = {
  bbox4326: [number, number, number, number]; // [minLon,minLat,maxLon,maxLat]
  zoom: number;
  widthPx: number;
  heightPx: number;
};

export type GridData = {
  width: number;
  height: number;
  // 行主序，长度 = width*height
  values: Float32Array;
  nodata?: number;
  bbox4326: [number, number, number, number];
};
