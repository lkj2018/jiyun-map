import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [vue()],
  // dev 时用（examples）
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // build 时用（组件库）
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "jiyun-map",
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: ["vue", "ol", "vue-router"],
      output: {
        globals: {
          vue: "Vue",
          ol: "ol",
          "vue-router": "VueRouter",
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
