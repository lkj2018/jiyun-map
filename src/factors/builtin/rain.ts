import type { FactorDef, LegendDef } from "../types";

export const rain1h: FactorDef = {
  id: "rain_1h",
  name: "1小时降水",
  legendId: "legend_rain",
  api: {
    endpointKey: "cog",
    buildCogUrl: (timeMs) => {
      // 你后端的规则你自己替换：
      // 例：/cog/rain_1h/202402110800.tif
      // if (!timeMs) return "/cog/rain_1h/latest.tif";
      // const d = new Date(timeMs);
      // const pad = (n: number) => String(n).padStart(2, "0");
      // const key = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
      // return `/cog/rain_1h/${key}.tif`;
      return `/test6.tif`;
    },
  },
  render: { opacity: 1, zIndex: 1 },
};

export const legendRain: LegendDef = {
  id: "legend_rain",
  name: "降水",
  unit: "mm",
  stops: [
    { value: -36, color: "#4F0E4A" },
    { value: -34, color: "#4C0F72" },
    { value: -30, color: "#3C1397" },
    { value: -26, color: "#2D18B7" },
    { value: -22, color: "#2128D1" },
    { value: -18, color: "#2C51DF" },
    { value: -14, color: "#397CE2" },
    { value: -10, color: "#4CA1D5" },
    { value: -6, color: "#6DBDCB" },
    { value: -2, color: "#8CCFC3" },
    { value: 2, color: "#84DB9E" },
    { value: 6, color: "#93E461" },
    { value: 10, color: "#D3ED51" },
    { value: 14, color: "#F5D049" },
    { value: 18, color: "#F79A42" },
    { value: 22, color: "#F06339" },
    { value: 26, color: "#DD3B30" },
    { value: 30, color: "#C72828" },
    { value: 34, color: "#AA2028" },
  ],
};
