import { notFound } from "next/navigation";
import Link from "next/link";
import { clusters, findCluster, findDomain, STATE_LABEL, WEEKS } from "@/lib/mock";
import { BarChart, LineChart } from "@/app/ui/charts";
import { ProductList } from "@/app/ui/product-list";

export function generateStaticParams() {
  return clusters.map((cluster) => ({ id: cluster.id }));
}

export default async function ClusterPage({ params }: PageProps<"/c/[id]">) {
  const { id } = await params;
  const cluster = findCluster(id);
  if (!cluster) notFound();

  const domain = findDomain(cluster.domainId);
  const range = `${WEEKS[0]}부터 ${WEEKS[WEEKS.length - 1]}까지`;

  return (
    <>
      <section className="card lead">
        <p className="eyebrow">
          <Link href="/">전체 우주</Link> ›{" "}
          {domain && <Link href={`/d/${domain.id}`}>{domain.label}</Link>} › 영역
        </p>
        <h1>{cluster.label}</h1>
        <span className={`pill ${cluster.state}`}>{STATE_LABEL[cluster.state]}</span>
        <div className="stats">
          <div className="stat">
            <b>{cluster.itemCount}개</b>
            <span>제품</span>
          </div>
          <div className="stat">
            <b>{cluster.queryCount}개</b>
            <span>질문</span>
          </div>
          <div className="stat">
            <b>{cluster.growthScore.toFixed(1)}배</b>
            <span>평소 대비 이번 주</span>
          </div>
        </div>
      </section>

      <section className="block">
        <header className="block-head">
          <h2>주간 출시 추이</h2>
          <p>주마다 새로 나온 제품 수, 최근 12주</p>
        </header>
        <BarChart
          values={cluster.weeklyLaunches}
          labels={WEEKS}
          unit="개"
          description={`${cluster.label} 영역의 주간 출시 수, ${range}`}
        />
      </section>

      <section className="block">
        <header className="block-head">
          <h2>질문 수 추이</h2>
          <p>주마다 들어온 질문 수, 최근 12주</p>
        </header>
        <LineChart
          values={cluster.weeklyQueries}
          labels={WEEKS}
          unit="개"
          description={`${cluster.label} 영역의 주간 질문 수, ${range}`}
        />
      </section>

      <section className="block">
        <header className="block-head">
          <h2>제품 목록</h2>
          <p>이 영역에 속한 제품</p>
        </header>
        <ProductList products={cluster.products} showSimilarity={false} />
      </section>
    </>
  );
}
