import type { App } from "vue";
import JiYunMap from "./components/JiYunMap.vue";

export default {
  install(app: App) {
    app.component("JiYunMap", JiYunMap);
  },
};
