import type { ControlDef } from "./types";

export const switchControl: ControlDef = {
  id: "switch",
  label: "底图",
  title: "切换底图",
  // 这里不做轮换；ToolBar 会处理弹层与选择
  onClick() {},
};
