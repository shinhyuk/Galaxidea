import { clusters, emptyAreas } from "@/lib/mock";
import { UniverseMap, type MapGalaxy, type MapVoid } from "./universe-map";

const galaxies: MapGalaxy[] = clusters.map((cluster) => ({
  id: cluster.id,
  name: cluster.label,
  x: cluster.x,
  y: cluster.y,
  r: cluster.r,
  count: cluster.itemCount,
  tone: cluster.state === "saturated" ? "sat" : cluster.state === "growing" ? "grow" : "dim",
}));

const voids: MapVoid[] = emptyAreas.slice(0, 3).map((area) => ({
  id: area.id,
  name: area.label,
  x: area.x,
  y: area.y,
  r: area.r,
}));

export function Sky({ mine }: { mine?: { x: number; y: number } }) {
  return (
    <UniverseMap
      galaxies={galaxies}
      voids={voids}
      mine={mine}
      label="아이디어 우주 지도. 영역마다 은하가 하나씩 있고, 빈 영역은 점선 원으로, 내 질문은 보라색 별로 표시됩니다."
    />
  );
}
