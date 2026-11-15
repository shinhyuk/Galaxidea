import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadReport } from "@/lib/ask/pipeline";
import type { Report } from "@/lib/ask/logic";
import { IdeaGraph } from "@/app/ui/idea-graph";
import { ProductList } from "@/app/ui/product-list";

const VERDICT_LABEL: Record<Report["verdict"], string> = {
  exists: "이미 있음",
  similar: "비슷한 것 있음",
  rare: "거의 없음",
};
const SOURCE_LABEL: Record<string, string> = { github: "깃허브 저장소", patent: "특허" };
const STATUS_LABEL: Record<string, string> = { active: "운영 중", archived: "보관됨", published: "공개됨" };

export default function ReportPage({ params }: PageProps<"/q/[id]">) {
  return (
    <Suspense fallback={<p className="hint">보고서를 불러오는 중…</p>}>
      {params.then(({ id }) => (
        <ReportView id={id} />
      ))}
    </Suspense>
  );
}

async function ReportView({ id }: { id: string }) {
  const stored = await loadReport(id);
  if (!stored) notFound();
  const { report, createdAt } = stored;

  return (
    <>
      <section className="card lead">
        <p className="eyebrow">
          보고서 · {createdAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
        </p>
        <h1>{report.oneLiner}</h1>
        <span className={`pill ${report.verdict}`}>{VERDICT_LABEL[report.verdict]}</span>
        <p className="lead-text">{report.summary}</p>
        <p className="where">
          도착한 곳 <b>{report.arrival ? `${report.arrival} 무리` : "어느 무리에도 속하지 않는 자리"}</b> · 가장
          가까운 것과의 유사도 {Math.round(report.topSimilarity * 100)}%
        </p>
        {!report.written && (
          <p className="hint">요약 글을 쓰는 모델을 쓸 수 없어 검색 결과만으로 만든 보고서입니다.</p>
        )}
      </section>

      <section className="block">
        <header className="block-head">
          <h2>가까운 것</h2>
          <p>뜻이 가장 가까운 순서. 지금 모음 안에서 찾은 것이며 세상의 전부는 아닙니다.</p>
        </header>
        {report.products.length ? (
          <ProductList
            products={report.products.map((product) => ({
              name: product.name,
              oneLiner: product.oneLiner,
              launched: product.year ? `${product.year}년` : null,
              status: `${SOURCE_LABEL[product.source] ?? product.source} · ${STATUS_LABEL[product.status ?? ""] ?? product.status ?? ""}`,
              url: product.url,
              similarity: product.similarity,
              note: product.note,
            }))}
          />
        ) : (
          <p className="hint">가까운 것을 찾지 못했습니다.</p>
        )}
      </section>

      <section className="block">
        <header className="block-head">
          <h2>같은 생각을 한 사람</h2>
        </header>
        {report.same.count ? (
          <div className="stats">
            <div className="stat">
              <b>{report.same.count}명</b>
              <span>먼저 비슷하게 물은 사람</span>
            </div>
            {report.same.firstAt && (
              <div className="stat">
                <b>{new Date(report.same.firstAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</b>
                <span>가장 먼저 물은 날</span>
              </div>
            )}
            <div className="stat">
              <b>{report.same.langs.map((entry) => entry.lang).join(", ")}</b>
              <span>언어</span>
            </div>
          </div>
        ) : (
          <p className="hint">여기서 이 생각을 물은 것은 이 질문이 처음입니다.</p>
        )}
      </section>

      {report.star && (
        <section className="block">
          <header className="block-head">
            <h2>그래프에서의 자리</h2>
            <p>보라색 별이 이 질문입니다. 가장 가까운 것들과 선으로 이어져 있습니다.</p>
          </header>
          <IdeaGraph embedded star={report.star} />
        </section>
      )}

      <p className="hint">
        <Link href="/">다른 아이디어 물어보기</Link>
      </p>
    </>
  );
}
