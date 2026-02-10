<template>
  <div class="ol-map-container" :style="containerStyle">
    <div ref="mapEl" class="ol-map"></div>

    <!-- ✅ map ready 之后才渲染工具条 -->
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

import Map from "ol/Map";
import View from "ol/View";
import LayerGroup from "ol/layer/Group";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import { fromLonLat } from "ol/proj";

import ToolBar from "./ToolBar.vue";
import { getControls } from "../controls/registry";
import type { ControlCtx, ControlId } from "../controls/types";

type LonLat = [number, number];

/**
 * ⚠️ 天地图需要 token
 * 你要求“不需要外部传入”，这里提供组件内部读取方式：
 * - 优先读 window.__TIANDITU_TOKEN__
 * - 再读 import.meta.env.VITE_TIANDITU_TOKEN
 */
function getTdtToken(): string {
  // @ts-ignore
  const w = typeof window !== "undefined" ? (window as any) : {};
  return (
    w.__TIANDITU_TOKEN__ ||
    (import.meta as any).env?.VITE_TIANDITU_TOKEN ||
    "2cb7c040a7b77a5c600e9fda547fde62"
  );
}

// 内置底图列表（用于面板展示）
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

    /** 默认按经纬度 [lon, lat] */
    center: LonLat;
    zoom: number;

    minZoom?: number;
    maxZoom?: number;

    /** 工具列表：['reset','switch','clear'] */
    controls?: ControlId[];
    controlPosition?: "rt" | "rb" | "lt" | "lb";
  }>(),
  {
    height: "600px",
    width: "100%",
    controls: () => [],
    controlPosition: "rt",
  }
);

const emit = defineEmits<{
  (e: "ready", payload: { map: Map }): void;
  (e: "basemap-change", key: string): void;
}>();

// DOM
const mapEl = ref<HTMLDivElement | null>(null);

// ✅ 用 shallowRef 保存 Map，避免深层响应式追踪 OL 内部结构
const mapRef = shallowRef<Map | null>(null);

// -------------------- 视图/容器 --------------------
const containerStyle = computed(() => ({
  height: props.height,
  width: props.width,
  position: "relative",
}));

// -------------------- 底图管理（内置 + 标注叠加） --------------------
let baseGroup: LayerGroup | null = null;

// 默认底图（你也可以改成 tdt_img）
const basemapKeyInner = ref<string>("tdt_vec");

/**
 * 生成天地图 WMTS GetTile urls（t0~t7）
 * service 示例：vec_w / cva_w / img_w / cia_w / ter_w / cta_w
 * layerParam 示例：vec / cva / img / cia / ter / cta
 */
function makeTdtUrls(service: string, layerParam: string, tk: string) {
  const qs =
    `SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
    `&LAYER=${layerParam}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles` +
    `&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tk}`;

  return Array.from(
    { length: 8 },
    (_, i) => `https://t${i}.tianditu.gov.cn/${service}/wmts?${qs}`
  );
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

/** 创建“底图 + 标注”的组合 group */
function createTdtBasemapGroup(opts: {
  id: string;
  base: { service: string; layer: string };
  label: { service: string; layer: string };
  tk: string;
}) {
  const baseLayer = createTdtTileLayer(opts.base.service, opts.base.layer, opts.tk);
  const labelLayer = createTdtTileLayer(opts.label.service, opts.label.layer, opts.tk);

  const group = new LayerGroup({
    layers: [baseLayer, labelLayer], // ✅ 底图 + 标注叠加
    visible: false,
  });

  group.set("basemapKey", opts.id);
  group.set("managedBy", "MapContainer");
  return group;
}

function createBasemaps() {
  const tk = getTdtToken();
  if (!tk) {
    console.warn(
      "[MapContainer] Missing Tianditu token. Set window.__TIANDITU_TOKEN__ or VITE_TIANDITU_TOKEN."
    );
  }

  // ✅ 行政（矢量）= vec + cva
  const tdtVecGroup = createTdtBasemapGroup({
    id: "tdt_vec",
    base: { service: "vec_w", layer: "vec" },
    label: { service: "cva_w", layer: "cva" },
    tk,
  });

  // ✅ 地形 = ter + cta
  const tdtTerGroup = createTdtBasemapGroup({
    id: "tdt_ter",
    base: { service: "ter_w", layer: "ter" },
    label: { service: "cta_w", layer: "cta" },
    tk,
  });

  // ✅ 影像 = img + cia
  const tdtImgGroup = createTdtBasemapGroup({
    id: "tdt_img",
    base: { service: "img_w", layer: "img" },
    label: { service: "cia_w", layer: "cia" },
    tk,
  });

  // ✅ 自定义发布底图（示例：XYZ）
  const customPub = new TileLayer({
    source: new XYZ({
      // TODO: 替换为你们自己的发布地址
      url: "https://your-domain.example.com/tiles/{z}/{x}/{y}.png",
      crossOrigin: "anonymous",
    }),
    visible: false,
  });
  customPub.set("basemapKey", "custom_pub");
  customPub.set("managedBy", "MapContainer");

  baseGroup = new LayerGroup({
    layers: [tdtVecGroup, tdtTerGroup, tdtImgGroup, customPub],
  });
  baseGroup.set("managedBy", "MapContainer");

  // 初始化可见
  applyBasemapVisible(basemapKeyInner.value);

  return baseGroup;
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

// -------------------- 托管清理层（clear 只清它） --------------------
let managedVectorLayer: VectorLayer<VectorSource> | null = null;

function createManagedVectorLayer() {
  const source = new VectorSource();
  managedVectorLayer = new VectorLayer({ source });
  managedVectorLayer.set("managedBy", "MapContainer");
  managedVectorLayer.set("scope", "managed");
  return managedVectorLayer;
}

function clearManagedLayers() {
  managedVectorLayer?.getSource()?.clear(true);
}

// -------------------- Controls --------------------
const controlDefs = computed(() => getControls(props.controls || []));

const controlCtx = computed<ControlCtx | null>(() => {
  const map = mapRef.value;
  if (!map) return null;

  return {
    map,
    initialCenter: props.center,
    initialZoom: props.zoom,

    // ✅ 给 ToolBar 弹层展示
    basemaps: BASEMAPS.map((b) => ({ id: b.id, name: b.name })),
    getBasemapKey,
    setBasemapKey,

    clearManagedLayers,
  };
});

// -------------------- Mount / Unmount --------------------
onMounted(() => {
  if (!mapEl.value) return;

  const base = createBasemaps();
  const managed = createManagedVectorLayer();

  const map = new Map({
    target: mapEl.value,
    layers: [base, managed],
    view: new View({
      center: fromLonLat(props.center),
      zoom: props.zoom,
      minZoom: props.minZoom,
      maxZoom: props.maxZoom,
    }),
  });

  mapRef.value = map;
  emit("ready", { map });
});

// props 更新：center / zoom
watch(
  () => props.center,
  (c) => {
    const map = mapRef.value;
    if (!map) return;
    map.getView().setCenter(fromLonLat(c));
  },
  { deep: true }
);

watch(
  () => props.zoom,
  (z) => {
    const map = mapRef.value;
    if (!map) return;
    map.getView().setZoom(z);
  }
);

onBeforeUnmount(() => {
  const map = mapRef.value;
  if (map) map.setTarget(undefined);
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
