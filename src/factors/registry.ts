import { BUILTIN_FACTORS, BUILTIN_LEGENDS } from "./builtin";
import type { FactorDef, LegendDef } from "./types";

const factorMap = new Map<string, FactorDef>(BUILTIN_FACTORS.map((f) => [f.id, f]));
const legendMap = new Map<string, LegendDef>(BUILTIN_LEGENDS.map((l) => [l.id, l]));

export function getFactorById(id: string): FactorDef | undefined {
  return factorMap.get(id);
}

export function listFactors(): FactorDef[] {
  return BUILTIN_FACTORS.slice();
}

export function getLegendById(id: string): LegendDef | undefined {
  return legendMap.get(id);
}
