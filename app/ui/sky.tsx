import type { Cluster, EmptyArea } from "@/lib/mock";
import { UniverseMap, type MapGalaxy, type MapVoid } from "./universe-map";

// The star map of one domain: its areas sit on a ring, its empty areas in
// the middle, and the asker's star next to wherever the question landed.
export function Sky({
  areas,
  empty,
  mineAt,
}: {
  areas: Cluster[];
  empty: EmptyArea[];
  // Id of the area or empty area the question belongs to.
  mineAt?: string;
}) {
  const galaxies: MapGalaxy[] = areas.map((area, i) => {
    const angle = (i / areas.length) * 6.2832 - 1.5708;
    return {
      id: area.id,
      name: area.label,
      x: 0.5 + 0.33 * Math.cos(angle),
      y: 0.47 + 0.33 * Math.sin(angle),
      r: 0.1,
    };
  });
  const voids: MapVoid[] = empty.slice(0, 2).map((area, i) => ({
    id: area.id,
    name: area.label,
    x: empty.length > 1 ? 0.38 + i * 0.24 : 0.5,
    y: 0.47,
    r: 0.075,
  }));
  const home = galaxies.find((g) => g.id === mineAt);
  const gap = voids.find((v) => v.id === mineAt);
  const mine = home
    ? { x: home.x + 0.05, y: home.y + 0.04 }
    : gap
      ? { x: gap.x, y: gap.y }
      : undefined;

  return (
    <UniverseMap
      galaxies={galaxies}
      voids={voids}
      mine={mine}
      label="이 분야의 별 지도. 별 하나가 아이디어 하나이고, 뜻이 가까운 별끼리 선으로 이어져 있습니다. 빈 영역은 점선 원으로, 내 질문은 보라색 별로 표시됩니다."
    />
  );
}
