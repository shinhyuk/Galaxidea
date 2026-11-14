import Form from "next/form";
import Link from "next/link";
import { emptyAreas, reports, trendingClusters, WEEKS } from "@/lib/mock";
import { Sparkline } from "./ui/charts";

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>내 아이디어는 우주 어디쯤에 있을까</h1>
        <p>
          한 줄로 물으면 세계에서 누가 먼저 생각했고 어디까지 갔는지 알려
          드립니다.
        </p>
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
      </section>

      <section className="block">
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
                    평소의 {cluster.growthScore.toFixed(1)}배 · 이번 주 신규{" "}
                    {cluster.weeklyNewItems}개
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

      <section className="block">
        <header className="block-head">
          <h2>이번 주 빈 영역</h2>
          <p>화두는 뜨는데 제품이 거의 없는 곳</p>
        </header>
        <ol className="rank">
          {emptyAreas.map((area, i) => (
            <li key={area.id}>
              <div className="rank-row">
                <span className="rank-no void">{i + 1}</span>
                <span className="rank-main">
                  <strong>{area.label}</strong>
                  <span>
                    제품 {area.itemCount}개 · 질문 {area.queryCount}개 ·{" "}
                    {area.words.join(", ")}
                  </span>
                </span>
                <span className="score">
                  <b>{area.trendScore}</b>
                  화두 점수
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
