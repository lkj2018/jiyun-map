import WebGLTileLayer from "ol/layer/WebGLTile";
import GeoTIFF from "ol/source/GeoTIFF";
import type Map from "ol/Map";
import type { LegendDef } from "../types";

/** legend stops -> WebGL style.case 表达式 */
export function buildWebGLColorExpr(legend: LegendDef) {
  // 形如：['case', cond1, color1, cond2, color2, ..., fallback]
  const expr: any[] = ["case"];

  // nodata（你的示例用了 'nan'，也可以额外判断 -9999 之类）
  expr.push(["==", ["band", 1], "nan"], [0, 0, 0, 0]);

  // stops 按 value 升序
  const stops = [...legend.stops].sort((a, b) => a.value - b.value);

  for (const s of stops) {
    // 这里用 <= 分段（和你示例一致）
    expr.push(["<=", ["band", 1], s.value], cssColorToRGBA(s.color));
  }

  // fallback
  expr.push([0, 0, 0, 0]);
  return expr;
}

function cssColorToRGBA(c: string): [number, number, number, number] {
  // 支持 #RRGGBB 或 rgba()
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [r, g, b, 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/i);
  if (!m) return [0, 0, 0, 0];
  const p = m[1].split(",").map((s) => s.trim());
  const r = Number(p[0]);
  const g = Number(p[1]);
  const b = Number(p[2]);
  const a = p.length >= 4 ? Number(p[3]) : 1;
  return [r, g, b, a];
}

export function upsertWebGLCogLayer(opts: {
  map: Map;
  layerKey: string;
  cogUrl: string;
  legend: LegendDef;
  opacity: number;
  zIndex: number;
  interpolate?: boolean;
}) {
  const { map, layerKey, cogUrl, legend, opacity, zIndex, interpolate = true } = opts;

  const layers = map.getLayers().getArray();
  let layer = layers.find((l) => (l as any).get?.("factorLayerKey") === layerKey) as
    | WebGLTileLayer
    | undefined;

  const source = new GeoTIFF({
    normalize: false,
    interpolate,
    sources: [{ url: cogUrl }],
  });

  const style = {
    color: buildWebGLColorExpr(legend),
  };

  if (!layer) {
    layer = new WebGLTileLayer({ source, style });
    layer.set("factorLayerKey", layerKey);
    layer.set("managedBy", "jiyun-map");
    map.addLayer(layer);
  } else {
    // ✅ 切换时次/要素：替换 source + style
    layer.setSource(source);
    layer.setStyle(style as any);
  }

  layer.setOpacity(opacity);
  layer.setZIndex(zIndex);

  return layer;
}

export function removeWebGLCogLayer(map: Map, layerKey: string) {
  const layers = map.getLayers().getArray();
  const target = layers.find((l) => (l as any).get?.("factorLayerKey") === layerKey);
  if (target) map.removeLayer(target);
}
