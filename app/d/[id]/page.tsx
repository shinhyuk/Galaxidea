import Link from "next/link";
import { notFound } from "next/navigation";
import {
  areasOf,
  domains,
  emptyAreasOf,
  findDomain,
  formatCount,
  STATE_LABEL,
  type ClusterState,
} from "@/lib/mock";
import type { Hub } from "@/app/ui/cosmos";
import { Scene, SceneCard } from "@/app/ui/scene";

const STATE_COLOR: Record<ClusterState | "void", string> = {
  growing: "127,224,196",
  saturated: "255,206,120",
  steady: "190,150,255",
  fading: "140,150,190",
  void: "170,180,215",
};

// Around the centre: two columns going down on a portrait screen, a ring on
// a landscape one.
function around(index: number, total: number): Pick<Hub, "tall" | "wide"> {
  const rows = Math.ceil(total / 2);
  const row = Math.floor(index / 2);
  const alone = total % 2 === 1 && index === total - 1;
  const angle = (index / total) * 6.2832 - 1.5708;
  return {
    tall: [alone ? 0.5 : index % 2 ? 0.75 : 0.25, 0.26 + (rows > 1 ? (row / (rows - 1)) * 0.68 : 0)],
    wide: [0.5 + 0.38 * Math.cos(angle), 0.48 + 0.44 * Math.sin(angle)],
  };
}

export function generateStaticParams() {
  return domains.map((domain) => ({ id: domain.id }));
}

export default async function DomainPage({ params }: PageProps<"/d/[id]">) {
  const { id } = await params;
  const domain = findDomain(id);
  if (!domain) notFound();

  const areas = areasOf(domain.id);
  const empty = emptyAreasOf(domain.id);
  const total = areas.length + empty.length;
  const centre: Hub = { tall: [0.5, 0.04], wide: [0.5, 0.48], size: 1.3, color: domain.color };
  const areaHubs: Hub[] = areas.map((area, i) => ({
    ...around(i, total),
    size: 0.7,
    color: STATE_COLOR[area.state],
  }));
  const emptyHubs: Hub[] = empty.map((_, i) => ({
    ...around(areas.length + i, total),
    size: 0.45,
    color: STATE_COLOR.void,
  }));
  const hubs = [centre, ...areaHubs, ...emptyHubs];
  const links = hubs.slice(1).map((_, i): [number, number] => [0, i + 1]);

  return (
    <>
      <section className="block">
        <header className="block-head">
          <p className="eyebrow">
            <Link href="/">전체 우주</Link> › 분야
          </p>
          <h1>{domain.label}</h1>
          <p>
            아이디어 {formatCount(domain.ideaCount)}개 · 영역 {areas.length}개 · 빈 영역{" "}
            {empty.length}개
          </p>
        </header>
        <Scene
          hubs={hubs}
          links={links}
          bandTall={[0.05, 0.86]}
          bandWide={[0.05, 0.84]}
          label={`${domain.label} 분야의 지도. 가운데가 이 분야이고, 둘레에 세부 영역이 이어져 있습니다.`}
        >
          <SceneCard
            hub={centre}
            icon={domain.icon}
            title={domain.label}
            lead={`▲ ${domain.growthPercent}%`}
            detail={`${formatCount(domain.ideaCount)}개`}
            main
          />
          {areas.map((area, i) => (
            <SceneCard
              key={area.id}
              hub={areaHubs[i]}
              href={`/c/${area.id}`}
              title={area.label}
              lead={STATE_LABEL[area.state]}
              detail={`제품 ${area.itemCount}개`}
              tone={area.state}
            />
          ))}
          {empty.map((area, i) => (
            <SceneCard
              key={area.id}
              hub={emptyHubs[i]}
              title={area.label}
              lead="빈 영역"
              detail={`화두 ${area.trendScore}`}
              tone="void"
            />
          ))}
        </Scene>
        <ul className="legend">
          <li><i className="d grow" />뜨는 중</li>
          <li><i className="d sat" />포화</li>
          <li><i className="d steady" />잔잔함</li>
          <li><i className="d fade" />식는 중</li>
          <li><i className="d void" />빈 영역</li>
        </ul>
      </section>

      <section className="block">
        <header className="block-head">
          <h2>이 분야의 영역</h2>
          <p>제품이 많은 순서</p>
        </header>
        <ol className="rank">
          {[...areas]
            .sort((a, b) => b.itemCount - a.itemCount)
            .map((area, i) => (
              <li key={area.id}>
                <Link href={`/c/${area.id}`} className="rank-row">
                  <span className="rank-no">{i + 1}</span>
                  <span className="rank-main">
                    <strong>{area.label}</strong>
                    <span>
                      제품 {area.itemCount}개 · 질문 {area.queryCount}개 · 평소의{" "}
                      {area.growthScore.toFixed(1)}배
                    </span>
                  </span>
                  <span className={`pill ${area.state}`}>{STATE_LABEL[area.state]}</span>
                </Link>
              </li>
            ))}
        </ol>
      </section>
    </>
  );
}
