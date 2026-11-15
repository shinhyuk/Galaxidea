import Form from "next/form";
import Link from "next/link";
import {
  domains,
  emptyAreas,
  findDomain,
  formatCount,
  reports,
  totals,
  trendingClusters,
  WEEKS,
} from "@/lib/mock";
import { Sparkline } from "@/app/ui/charts";
import type { Hub } from "@/app/ui/cosmos";
import { Scene, SceneCard } from "@/app/ui/scene";

const hubs: Hub[] = domains.map((domain) => ({
  tall: domain.tall,
  wide: domain.wide,
  size: domain.size,
  color: domain.color,
}));

// The first domain sits in the middle and is joined to every other one;
// the rest are joined to their neighbours around it.
const links: [number, number][] = [
  ...domains.slice(1).map((_, i): [number, number] => [0, i + 1]),
  [1, 2], [1, 3], [2, 4], [3, 6], [4, 5], [6, 8], [5, 7], [7, 8],
];

export default function MockHome() {
  return (
    <>
      <section className="hero">
        <Scene
          fill
          hubs={hubs}
          links={links}
          bandTall={[0.25, 0.69]}
          bandWide={[0.23, 0.67]}
          label="아이디어 우주 지도. 분야마다 은하가 하나씩 있고 서로 빛줄기로 이어져 있습니다."
        >
          {domains.map((domain, i) => (
            <SceneCard
              key={domain.id}
              hub={hubs[i]}
              href={`/d/${domain.id}`}
              icon={domain.icon}
              title={domain.label}
              lead={`▲ ${domain.growthPercent}%`}
              detail={`${formatCount(domain.ideaCount)}개`}
              main={i === 0}
            />
          ))}
        </Scene>
        <div className="hero-top">
          <h1>내 아이디어는 우주 어디쯤에 있을까</h1>
          <p>
            한 줄로 물으면 세계에서 누가 먼저 생각했고 어디까지 갔는지 알려
            드립니다.
          </p>
        </div>
        <div className="hero-bottom">
          {/* The mock always opens the first sample report. */}
          <Form action="/q/1" className="ask">
            <label htmlFor="idea">아이디어를 한 줄로 적어 보세요</label>
            <div className="row">
              <input
                id="idea"
                name="idea"
                type="text"
                maxLength={80}
                autoComplete="off"
                placeholder="예: 소리만으로 하는 잠수함 게임"
              />
              <button type="submit">별 띄우기</button>
            </div>
            <p className="hint">질문은 한 줄 요약으로 익명 공개됩니다</p>
          </Form>
          <div className="chips" aria-label="예시 질문">
            {reports.map((report) => (
              <Link key={report.id} href={`/q/${report.id}`} className="chip">
                {report.oneLiner}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="block">
        <header className="block-head">
          <h2>한눈에 보기</h2>
          <p>은하를 누르면 그 분야 안으로 들어갑니다</p>
        </header>
        <div className="stats">
          <div className="stat">
            <b>{formatCount(totals.ideas)}개</b>
            <span>모인 아이디어</span>
          </div>
          <div className="stat">
            <b>{totals.domains}개</b>
            <span>분야</span>
          </div>
          <div className="stat">
            <b>{totals.areas}개</b>
            <span>영역</span>
          </div>
          <div className="stat">
            <b>{totals.languages}개</b>
            <span>언어권</span>
          </div>
        </div>
      </section>

      <section className="block" id="trending">
        <header className="block-head">
          <h2>이번 주 뜨는 영역</h2>
          <p>이번 주 신규 제품 수가 최근 4주 평균보다 많은 곳</p>
        </header>
        <ol className="rank">
          {trendingClusters.map((cluster, i) => (
            <li key={cluster.id}>
              <Link href={`/c/${cluster.id}`} className="rank-row">
                <span className="rank-no">{i + 1}</span>
                <span className="rank-main">
                  <strong>{cluster.label}</strong>
                  <span>
                    {findDomain(cluster.domainId)?.label} · 평소의{" "}
                    {cluster.growthScore.toFixed(1)}배 · 신규 {cluster.weeklyNewItems}개
                  </span>
                </span>
                <Sparkline
                  values={cluster.weeklyLaunches}
                  label={`${WEEKS[0]}부터 ${WEEKS[WEEKS.length - 1]}까지 주간 출시 수 추이`}
                />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="block" id="empty">
        <header className="block-head">
          <h2>이번 주 빈 영역</h2>
          <p>화두는 뜨는데 제품이 거의 없는 곳</p>
        </header>
        <ol className="rank">
          {emptyAreas.map((area, i) => (
            <li key={area.id}>
              <Link href={`/d/${area.domainId}`} className="rank-row">
                <span className="rank-no void">{i + 1}</span>
                <span className="rank-main">
                  <strong>{area.label}</strong>
                  <span>
                    {findDomain(area.domainId)?.label} · 제품 {area.itemCount}개 · 질문{" "}
                    {area.queryCount}개
                  </span>
                </span>
                <span className="score">
                  <b>{area.trendScore}</b>
                  화두 점수
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
