import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findCluster,
  findEmptyArea,
  findReport,
  reports,
  STATE_LABEL,
  VERDICT_LABEL,
  WEEKS,
} from "@/lib/mock";
import { Sparkline } from "@/app/ui/charts";
import { ProductList } from "@/app/ui/product-list";
import { Sky } from "@/app/ui/sky";

export function generateStaticParams() {
  return reports.map((report) => ({ id: report.id }));
}

export default async function ReportPage({ params }: PageProps<"/q/[id]">) {
  const { id } = await params;
  const report = findReport(id);
  if (!report) notFound();

  const cluster = report.clusterId ? findCluster(report.clusterId) : undefined;
  const area = report.emptyAreaId ? findEmptyArea(report.emptyAreaId) : undefined;
  const total = report.sameIdea.count;

  return (
    <>
      <section className="card lead">
        <p className="eyebrow">보고서</p>
        <h1>{report.oneLiner}</h1>
        <span className={`pill ${report.verdict}`}>{VERDICT_LABEL[report.verdict]}</span>
        <p className="lead-text">{report.summary}</p>
        <p className="where">
          도착한 곳{" "}
          {cluster ? (
            <>
              <Link href={`/c/${cluster.id}`}>{cluster.label} 은하</Link> · 상태{" "}
              {STATE_LABEL[cluster.state]}
            </>
          ) : (
            <b>빈 공간{area ? ` (${area.label})` : ""}</b>
          )}
        </p>
      </section>

      <section className="block">
        <header className="block-head">
          <h2>가까운 제품</h2>
          <p>뜻이 가장 가까운 순서</p>
        </header>
        <ProductList products={report.products} />
      </section>

      <section className="block">
        <header className="block-head">
          <h2>같은 생각을 한 사람</h2>
        </header>
        <div className="stats">
          <div className="stat">
            <b>{total}명</b>
            <span>비슷한 질문</span>
          </div>
          <div className="stat">
            <b>{report.sameIdea.firstAt}</b>
            <span>가장 먼저 물은 날</span>
          </div>
        </div>
        <ul className="langs">
          {report.sameIdea.langs.map((lang) => (
            <li key={lang.label}>
              <span>{lang.label}</span>
              <span className="meter">
                <i style={{ width: `${(lang.count / total) * 100}%` }} />
              </span>
              <span className="num">{lang.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block">
        <header className="block-head">
          <h2>관련 화두 추세</h2>
          <p>최근 12주, 4주 전 대비 변화</p>
        </header>
        <ul className="trends">
          {report.trends.map((trend) => (
            <li key={trend.word}>
              <strong>{trend.word}</strong>
              <Sparkline
                values={trend.series}
                label={`${trend.word}: ${WEEKS[0]}부터 ${WEEKS[WEEKS.length - 1]}까지 추이`}
              />
              <span className="num">
                {trend.change >= 0 ? "▲" : "▼"} {Math.abs(Math.round(trend.change * 100))}%
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block">
        <header className="block-head">
          <h2>우주 지도</h2>
          <p>내 질문이 놓인 자리</p>
        </header>
        <Sky mine={report.star} />
      </section>

      <section className="block">
        <header className="block-head">
          <h2>공유 카드</h2>
        </header>
        <div className="share" aria-label="공유 카드 미리보기">
          <span className="mark">Galaxidea</span>
          <strong>{report.oneLiner}</strong>
          <span className={`pill ${report.verdict}`}>{VERDICT_LABEL[report.verdict]}</span>
          <span className="share-foot">
            {cluster ? `${cluster.label} 은하` : "빈 공간"} · 같은 생각 {total}명
          </span>
        </div>
        <div className="row">
          <button type="button" className="ghost" disabled>이미지 저장</button>
          <button type="button" className="ghost" disabled>링크 복사</button>
        </div>
        <p className="hint">버튼은 M5에서 연결됩니다.</p>
      </section>
    </>
  );
}
