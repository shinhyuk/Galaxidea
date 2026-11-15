import { clusters, emptyAreas } from "@/lib/mock";
import { UniverseMap, type MapGalaxy, type MapVoid } from "./universe-map";

const galaxies: MapGalaxy[] = clusters.map((cluster) => ({
  id: cluster.id,
  name: cluster.label,
  x: cluster.x,
  y: cluster.y,
  r: cluster.r,
}));

const voids: MapVoid[] = emptyAreas.slice(0, 3).map((area) => ({
  id: area.id,
  name: area.label,
  x: area.x,
  y: area.y,
  r: area.r,
}));

// The home page lays its heading over the top of the sky and the question
// form over the bottom, so galaxies stay in the band between them.
const HERO_BAND: [number, number] = [0.2, 0.7];

export function Sky({
  mine,
  hero = false,
}: {
  mine?: { x: number; y: number };
  hero?: boolean;
}) {
  return (
    <UniverseMap
      galaxies={galaxies}
      voids={voids}
      mine={mine}
      hero={hero}
      band={hero ? HERO_BAND : undefined}
      label="아이디어 우주 지도. 별 하나가 아이디어 하나이고, 뜻이 가까운 별끼리 선으로 이어져 있습니다. 빈 영역은 점선 원으로, 내 질문은 보라색 별로 표시됩니다."
    />
  );
}
