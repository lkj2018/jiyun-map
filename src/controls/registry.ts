import type { ControlDef, ControlId } from "./types";
import { resetControl } from "./reset";
import { clearControl } from "./clear";
import { switchControl } from "./switch";

const registry = new Map<ControlId, ControlDef>([
  [resetControl.id, resetControl],
  [clearControl.id, clearControl],
  [switchControl.id, switchControl],
]);

export function getControls(ids: ControlId[]) {
  return ids.map((id) => registry.get(id)).filter(Boolean) as ControlDef[];
}
