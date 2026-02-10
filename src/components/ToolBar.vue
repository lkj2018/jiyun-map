<template>
  <div class="ol-toolbar" :class="`pos-${position}`" ref="toolbarEl">
    <div v-for="c in controls" :key="c.id" class="tool-item">
      <button
        class="ol-tool-btn"
        type="button"
        :title="c.title || c.label"
        @click="onToolClick(c)"
      >
        {{ c.label }}
      </button>

      <!-- ✅ 底图弹层：只跟随 switch 这个按钮 -->
      <div
        v-if="c.id === 'switch' && panelOpen"
        class="basemap-panel"
        @click.stop
      >
        <div class="panel-title">选择底图</div>
        <div class="panel-list">
          <button
            v-for="bm in ctx.basemaps"
            :key="bm.id"
            type="button"
            class="panel-item"
            :class="{ active: bm.id === ctx.getBasemapKey() }"
            @click="selectBasemap(bm.id)"
          >
            <span class="dot" />
            <span class="name">{{ bm.name }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { ControlDef } from "../controls/types";
import type { ControlCtx } from "../controls/types";

const props = defineProps<{
  controls: ControlDef[];
  ctx: ControlCtx;
  position?: "rt" | "rb" | "lt" | "lb";
}>();

const panelOpen = ref(false);
const toolbarEl = ref<HTMLElement | null>(null);

function onToolClick(c: ControlDef) {
  if (c.id === "switch") {
    panelOpen.value = !panelOpen.value;
    return;
  }
  panelOpen.value = false;
  c.onClick(props.ctx);
}

function selectBasemap(id: string) {
  props.ctx.setBasemapKey(id);
  panelOpen.value = false;
}

// 点击外部关闭
function onDocClick(e: MouseEvent) {
  const el = toolbarEl.value;
  if (!el) return;
  if (!el.contains(e.target as Node)) panelOpen.value = false;
}

onMounted(() => document.addEventListener("click", onDocClick));
onBeforeUnmount(() => document.removeEventListener("click", onDocClick));
</script>

<style scoped>
.ol-toolbar {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
}

.pos-rt { top: 12px; right: 12px; }
.pos-rb { bottom: 12px; right: 12px; }
.pos-lt { top: 12px; left: 12px; }
.pos-lb { bottom: 12px; left: 12px; }

.tool-item { position: relative; }

.ol-tool-btn {
  padding: 10px 12px;
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 10px;
  background: rgba(255,255,255,0.92);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  box-shadow: 0 6px 18px rgba(0,0,0,0.08);
}

.ol-tool-btn:hover { background: rgba(255,255,255,1); }

/* 弹层（在按钮左侧弹出，避免遮挡右上角） */
.basemap-panel {
  position: absolute;
  top: 0;
  right: calc(100% + 10px);
  width: 180px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(255,255,255,0.96);
  border: 1px solid rgba(0,0,0,0.10);
  box-shadow: 0 10px 30px rgba(0,0,0,0.12);
}

.panel-title {
  font-size: 12px;
  opacity: 0.75;
  margin-bottom: 8px;
}

.panel-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.panel-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,0.08);
  background: rgba(255,255,255,0.8);
  cursor: pointer;
  text-align: left;
}

.panel-item:hover { background: rgba(255,255,255,1); }

.panel-item.active {
  border-color: rgba(0,0,0,0.22);
  font-weight: 600;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 99px;
  background: rgba(0,0,0,0.25);
}

.panel-item.active .dot {
  background: rgba(0,0,0,0.65);
}

.name { font-size: 13px; }
</style>
