<template>
  <div>
    <h3>JiYun Map</h3>
    <JiYunMap height="800px" :center="[114, 38.5]" :zoom="6" :controls="['reset', 'switch', 'clear']"/>
  </div>
</template>

<script setup lang="ts">
import JiYunMap from "../../components/JiYunMap.vue";
</script>
