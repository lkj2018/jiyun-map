<template>
  <div class="ol-map-container" :style="containerStyle">
    <div ref="mapEl" class="ol-map"></div>

    <ToolBar
      v-if="mapRef && controlCtx && controlDefs.length"
      :controls="controlDefs"
      :ctx="controlCtx"
      :position="controlPosition"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";

import OlMap from "ol/Map";
import View from "ol/View";
import LayerGroup from "ol/layer/Group";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import { fromLonLat } from "ol/proj";

// WebGL COG
import WebGLTileLayer from "ol/layer/WebGLTile";
import GeoTIFF from "ol/source/GeoTIFF";

import ToolBar from "./ToolBar.vue";
import { getControls } from "../controls/registry";
import type { ControlCtx, ControlId } from "../controls/types";

// factors registry
import { getFactorById, getLegendById } from "../factors/registry";
import { debounce } from "../factors/services/debounce";

type LonLat = [number, number];

function getTdtToken(): string {
  // @ts-ignore
  const w = typeof window !== "undefined" ? (window as any) : {};
  return (
    w.__TIANDITU_TOKEN__ ||
    (import.meta as any).env?.VITE_TIANDITU_TOKEN ||
    "2cb7c040a7b77a5c600e9fda547fde62"
  );
}

const BASEMAPS = [
  { id: "tdt_vec", name: "天地图·行政" },
  { id: "tdt_ter", name: "天地图·地形" },
  { id: "tdt_img", name: "天地图·影像" },
  { id: "custom_pub", name: "自定义底图" },
] as const;

const props = withDefaults(
  defineProps<{
    height?: string;
    width?: string;

    center: LonLat;
    zoom: number;
    minZoom?: number;
    maxZoom?: number;

    controls?: ControlId[];
    controlPosition?: "rt" | "rb" | "lt" | "lb";

    /** 外部控制显示的要素 id（单选传 1 个，叠加传多个） */
    activeFactorIds?: string[];

    /** 要素是否随 moveend 刷新（默认 false；只有当你的 COG url 会随 bbox 变化才需要 true） */
    factorRefreshOnMoveEnd?: boolean;

    /** moveend 刷新防抖 */
    factorRefreshDebounceMs?: number;

    /** 时间参数：影响要素数据（COG url） */
    time?: string | number | Date;
  }>(),
  {
    height: "600px",
    width: "100%",
    center: [114, 38.5],
    zoom: 6,
    controls: () => [],
    controlPosition: "rt",
    activeFactorIds: () => [],
    factorRefreshOnMoveEnd: false, // ✅ WebGLTileLayer 本身会随视图加载，不必刷新
    factorRefreshDebounceMs: 400,
    time: undefined,
  }
);

const emit = defineEmits<{
  (e: "ready", payload: { map: OlMap }): void;
  (e: "basemap-change", key: string): void;

  (e: "factor-loading", payload: { id: string; loading: boolean }): void;
  (e: "factor-ready", payload: { id: string }): void;
  (e: "factor-error", payload: { id: string; error: any }): void;

  /** 可选：地图点击取值（WebGLTileLayer.getData） */
  (e: "factor-pick", payload: { id: string; value: number; coordinate: any; pixel: any }): void;
}>();

const mapEl = ref<HTMLDivElement | null>(null);
const mapRef = shallowRef<OlMap | null>(null);

const containerStyle = computed(() => ({
  height: props.height,
  width: props.width,
  position: "relative",
}));

function normalizeTime(t?: string | number | Date): number | null {
  if (t == null) return null;
  if (typeof t === "number") return t;
  if (typeof t === "string") {
    const ms = Date.parse(t);
    return Number.isNaN(ms) ? null : ms;
  }
  if (t instanceof Date) return t.getTime();
  return null;
}
const timeMs = computed(() => normalizeTime(props.time));

function toViewCenter(center: LonLat) {
  return fromLonLat(center);
}

/* ------------------------------ 底图管理（内置 + 标注叠加） ------------------------------ */
let baseGroup: LayerGroup | null = null;
const basemapKeyInner = ref<string>("tdt_vec");

function makeTdtUrls(service: string, layerParam: string, tk: string) {
  const qs =
    `SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
    `&LAYER=${layerParam}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles` +
    `&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tk}`;
  return Array.from({ length: 8 }, (_, i) => `https://t${i}.tianditu.gov.cn/${service}/wmts?${qs}`);
}

function createTdtTileLayer(service: string, layerParam: string, tk: string) {
  return new TileLayer({
    source: new XYZ({
      urls: makeTdtUrls(service, layerParam, tk),
      crossOrigin: "anonymous",
    }),
    visible: true,
  });
}

function createTdtBasemapGroup(opts: {
  id: string;
  base: { service: string; layer: string };
  label: { service: string; layer: string };
  tk: string;
}) {
  const baseLayer = createTdtTileLayer(opts.base.service, opts.base.layer, opts.tk);
  const labelLayer = createTdtTileLayer(opts.label.service, opts.label.layer, opts.tk);

  const group = new LayerGroup({
    layers: [baseLayer, labelLayer],
    visible: false,
  });

  group.set("basemapKey", opts.id);
  group.set("managedBy", "jiyun-map");
  return group;
}

function applyBasemapVisible(key: string) {
  if (!baseGroup) return;
  baseGroup.getLayers().forEach((lyr) => {
    const k = (lyr as any).get?.("basemapKey");
    if (!k) return;
    (lyr as any).setVisible(k === key);
  });
}

function setBasemapKey(key: string) {
  basemapKeyInner.value = key;
  applyBasemapVisible(key);
  emit("basemap-change", key);
}
function getBasemapKey() {
  return basemapKeyInner.value;
}

function createBasemaps() {
  const tk = getTdtToken();
  if (!tk) {
    console.warn("[jiyun-map] Missing Tianditu token. Set window.__TIANDITU_TOKEN__ or VITE_TIANDITU_TOKEN.");
  }

  const tdtVecGroup = createTdtBasemapGroup({
    id: "tdt_vec",
    base: { service: "vec_w", layer: "vec" },
    label: { service: "cva_w", layer: "cva" },
    tk,
  });

  const tdtTerGroup = createTdtBasemapGroup({
    id: "tdt_ter",
    base: { service: "ter_w", layer: "ter" },
    label: { service: "cta_w", layer: "cta" },
    tk,
  });

  const tdtImgGroup = createTdtBasemapGroup({
    id: "tdt_img",
    base: { service: "img_w", layer: "img" },
    label: { service: "cia_w", layer: "cia" },
    tk,
  });

  const customPub = new TileLayer({
    source: new XYZ({
      url: "https://your-domain.example.com/tiles/{z}/{x}/{y}.png",
      crossOrigin: "anonymous",
    }),
    visible: false,
  });
  customPub.set("basemapKey", "custom_pub");
  customPub.set("managedBy", "jiyun-map");

  baseGroup = new LayerGroup({
    layers: [tdtVecGroup, tdtTerGroup, tdtImgGroup, customPub],
  });
  baseGroup.set("managedBy", "jiyun-map");

  applyBasemapVisible(basemapKeyInner.value);
  return baseGroup;
}

/* ------------------------------ 托管清理层（clear 只清它） ------------------------------ */
let managedVectorLayer: VectorLayer<VectorSource> | null = null;

function createManagedVectorLayer() {
  const source = new VectorSource();
  managedVectorLayer = new VectorLayer({ source });
  managedVectorLayer.set("managedBy", "jiyun-map");
  managedVectorLayer.set("scope", "managed");
  return managedVectorLayer;
}

function clearManagedLayers() {
  managedVectorLayer?.getSource()?.clear(true);
}

/* ------------------------------ Factors：COG(WebGLTileLayer + GeoTIFF) ------------------------------ */
/**
 * 关键变化：
 * - 不再 fetchGrid/生成图片
 * - factor.api.buildCogUrl(timeMs) -> GeoTIFF source url
 * - WebGLTileLayer style: legend stops -> case 表达式
 */
type LegendStop = { value: number; color: string };
type LegendDef = { id: string; stops: LegendStop[] };

const abortControllers = new globalThis.Map<string, AbortController>();

function layerKeyOfFactor(id: string) {
  return `factor:${id}`;
}

function normalizeActiveIds(ids: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids || []) {
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function cssColorToRGBA(c: string): [number, number, number, number] {
  // WebGL style 里 alpha 用 0~1
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

function buildWebGLColorExpr(legend: LegendDef) {
  const stops = [...legend.stops].sort((a, b) => a.value - b.value);

  const expr: any[] = ["case"];
  // nodata: nan -> transparent
  expr.push(["==", ["band", 1], "nan"], [0, 0, 0, 0]);

  for (const s of stops) {
    expr.push(["<=", ["band", 1], s.value], cssColorToRGBA(s.color));
  }

  expr.push([0, 0, 0, 0]);
  return expr;
}

function findFactorLayer(olMap: OlMap, layerKey: string): WebGLTileLayer | undefined {
  return olMap
    .getLayers()
    .getArray()
    .find((l) => (l as any).get?.("factorLayerKey") === layerKey) as WebGLTileLayer | undefined;
}

function upsertWebGLCogLayer(opts: {
  map: OlMap;
  layerKey: string;
  cogUrl: string;
  legend: LegendDef;
  opacity: number;
  zIndex: number;
  interpolate?: boolean;
}) {
  const { map, layerKey, cogUrl, legend, opacity, zIndex, interpolate = true } = opts;

  const source = new GeoTIFF({
    normalize: false,
    interpolate,
    sources: [{ url: cogUrl }],
  });

  const style = {
    color: buildWebGLColorExpr(legend),
  };

  let layer = findFactorLayer(map, layerKey);

  if (!layer) {
    layer = new WebGLTileLayer({ source, style });
    layer.set("factorLayerKey", layerKey);
    layer.set("managedBy", "jiyun-map");
    map.addLayer(layer);
  } else {
    layer.setSource(source);
    // @ts-ignore
    layer.setStyle(style);
  }

  layer.setOpacity(opacity);
  layer.setZIndex(zIndex);

  return layer;
}

function removeWebGLCogLayer(olMap: OlMap, layerKey: string) {
  const layers = olMap.getLayers().getArray();
  const target = layers.find((l) => (l as any).get?.("factorLayerKey") === layerKey);
  if (target) olMap.removeLayer(target);
}

async function renderFactorById(factorId: string) {
  const olMap = mapRef.value;
  if (!olMap) return;

  const factor = getFactorById(factorId) as any;
  if (!factor) {
    emit("factor-error", { id: factorId, error: "Unknown factorId" });
    return;
  }

  const legend = getLegendById(factor.legendId) as any;
  if (!legend) {
    emit("factor-error", { id: factorId, error: "Unknown legendId" });
    return;
  }

  // 取消之前的（如果你的 buildCogUrl 内部要先请求 presigned url，这里有意义）
  abortControllers.get(factorId)?.abort();
  const ac = new AbortController();
  abortControllers.set(factorId, ac);

  try {
    emit("factor-loading", { id: factorId, loading: true });

    if (typeof factor.api?.buildCogUrl !== "function") {
      throw new Error(`Factor(${factorId}) api.buildCogUrl(timeMs) is required for COG mode.`);
    }

    const url = factor.api.buildCogUrl(timeMs.value);

    upsertWebGLCogLayer({
      map: olMap,
      layerKey: layerKeyOfFactor(factorId),
      cogUrl: url,
      legend,
      opacity: factor.render?.opacity ?? 0.75,
      zIndex: factor.render?.zIndex ?? 60,
      interpolate: true,
    });

    emit("factor-ready", { id: factorId });
  } catch (err: any) {
    if (err?.name !== "AbortError") emit("factor-error", { id: factorId, error: err });
  } finally {
    emit("factor-loading", { id: factorId, loading: false });
  }
}

function removeFactorLayerById(factorId: string) {
  const olMap = mapRef.value;
  if (!olMap) return;

  abortControllers.get(factorId)?.abort();
  abortControllers.delete(factorId);

  removeWebGLCogLayer(olMap, layerKeyOfFactor(factorId));
}

function syncActiveFactors(activeIds: string[]) {
  const olMap = mapRef.value;
  if (!olMap) return;

  const ids = normalizeActiveIds(activeIds);
  const activeSet = new Set(ids);

  // 1) 移除不在 active 的旧要素层
  const layers = olMap.getLayers().getArray();
  for (const lyr of layers) {
    const k = (lyr as any).get?.("factorLayerKey");
    if (typeof k === "string" && k.startsWith("factor:")) {
      const id = k.slice("factor:".length);
      if (!activeSet.has(id)) removeFactorLayerById(id);
    }
  }

  // 2) 渲染/刷新 active 的层（时间变化会触发重新 setSource）
  for (const id of ids) renderFactorById(id);
}

/* ------------------------------ Controls / ToolBar ctx ------------------------------ */
const controlDefs = computed(() => getControls(props.controls || []));

const controlCtx = computed<ControlCtx | null>(() => {
  const olMap = mapRef.value;
  if (!olMap) return null;

  return {
    map: olMap,
    initialCenter: props.center,
    initialZoom: props.zoom,

    basemaps: BASEMAPS.map((b) => ({ id: b.id, name: b.name })),
    getBasemapKey,
    setBasemapKey,

    clearManagedLayers,
  };
});

/* ------------------------------ Mount / Unmount ------------------------------ */
let offMoveEnd: (() => void) | null = null;
let offClick: (() => void) | null = null;

onMounted(() => {
  if (!mapEl.value) return;

  const base = createBasemaps();
  const managed = createManagedVectorLayer();

  const olMap = new OlMap({
    target: mapEl.value,
    layers: [base, managed],
    view: new View({
      center: toViewCenter(props.center),
      zoom: props.zoom,
      minZoom: props.minZoom,
      maxZoom: props.maxZoom,
      smoothResolutionConstraint: false, // ✅ 和你示例一致（可选）
    }),
    controls: [],
  });

  mapRef.value = olMap;
  emit("ready", { map: olMap });

  // ✅ moveend 刷新要素（只有当你的 url 与 bbox 相关才需要）
  const refresh = debounce(() => {
    if (!props.factorRefreshOnMoveEnd) return;
    syncActiveFactors(props.activeFactorIds || []);
  }, props.factorRefreshDebounceMs);

  const moveHandler = () => refresh();
  olMap.on("moveend", moveHandler);
  offMoveEnd = () => olMap.un("moveend", moveHandler);

  // ✅ 点击取值（可选能力：从当前第一个 active factor 取值）
  const clickHandler = async (evt: any) => {
    const ids = props.activeFactorIds || [];
    if (!ids.length) return;

    const id = ids[0];
    const layer = findFactorLayer(olMap, layerKeyOfFactor(id)) as any;
    if (!layer?.getData) return;

    try {
      const data = await layer.getData(evt.pixel);
      if (!data) return;
      emit("factor-pick", { id, value: data[0], coordinate: evt.coordinate, pixel: evt.pixel });
    } catch {
      // ignore
    }
  };
  olMap.on("click", clickHandler);
  offClick = () => olMap.un("click", clickHandler);

  // 初次同步
  syncActiveFactors(props.activeFactorIds || []);
});

// center / zoom props 更新
watch(
  () => props.center,
  (c) => {
    const olMap = mapRef.value;
    if (!olMap) return;
    olMap.getView().setCenter(toViewCenter(c));
  },
  { deep: true }
);

watch(
  () => props.zoom,
  (z) => {
    const olMap = mapRef.value;
    if (!olMap) return;
    olMap.getView().setZoom(z);
  }
);

// activeFactorIds 更新（外部控制）
watch(
  () => props.activeFactorIds || [],
  (ids) => {
    syncActiveFactors(ids);
  },
  { deep: true }
);

// time 更新 -> 刷新要素（更换 COG url）
watch(
  () => timeMs.value,
  () => {
    // cancel all pending
    for (const id of Array.from(abortControllers.keys())) {
      abortControllers.get(id)?.abort();
    }
    syncActiveFactors(props.activeFactorIds || []);
  }
);

onBeforeUnmount(() => {
  const olMap = mapRef.value;

  offMoveEnd?.();
  offMoveEnd = null;

  offClick?.();
  offClick = null;

  // 取消所有要素请求 + 移除要素层
  for (const id of Array.from(abortControllers.keys())) {
    removeFactorLayerById(id);
  }
  abortControllers.clear();

  if (olMap) olMap.setTarget(undefined);
  mapRef.value = null;

  baseGroup = null;
  managedVectorLayer = null;
});
</script>

<style scoped>
.ol-map-container {
  overflow: hidden;
  border-radius: 12px;
}

.ol-map {
  height: 100%;
  width: 100%;
}
</style>
