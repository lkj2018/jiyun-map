import { createRouter, createWebHashHistory } from "vue-router";

import Basic from "../views/Basic.vue";

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/basic" },
    { path: "/basic", component: Basic }
  ],
});
