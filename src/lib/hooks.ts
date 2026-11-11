import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { unitsQuery } from "./api";
import type { Unit } from "./units";

export function useUnitMap() {
  const { data = [] } = useQuery(unitsQuery);
  return useMemo(() => ({ units: data as Unit[], map: new Map(data.map((u) => [u.code, u] as const)) }), [data]);
}
