<template>
  <div>
    <h3>JiYun Map</h3>

    <div style="display:flex; gap:8px; margin:12px 0; flex-wrap:wrap;">
      <button @click="setSingle('rain_1h')">气温</button>
      <button @click="clearAll">清空要素</button>
    </div>

    <JiYunMap height="600px" :controls="['reset', 'switch']"
      :activeFactorIds="activeFactorIds" :time="currentTime" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import JiYunMap from "../../components/JiYunMap.vue";

const activeFactorIds = ref<string[]>([""]); // 默认显示一个
const currentTimeStr = ref("2024-07-20T08:00");

const currentTime = computed(() =>
  new Date(currentTimeStr.value).toISOString()
);

function setSingle(id: string) {
  activeFactorIds.value = [id];
}

function toggle(id: string) {
  const set = new Set(activeFactorIds.value);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  activeFactorIds.value = Array.from(set);
}

function clearAll() {
  activeFactorIds.value = [];
}
</script>
