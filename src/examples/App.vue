<template>
  <div style="display:flex; height:100vh;">
    <aside style="width:220px; padding:12px; border-right:1px solid #eee;">
      <h3>示例</h3>

      <ul style="list-style:none; padding:0; line-height:1.8;">
        <li><RouterLink to="/basic">地图初始化</RouterLink></li>
      </ul>
    </aside>

    <main style="flex:1; padding:12px;">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<style>
body{
  margin:0;
}
</style>
