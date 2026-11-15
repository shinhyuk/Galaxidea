import type { Product } from "@/lib/mock";

export function ProductList({
  products,
  showSimilarity = true,
}: {
  products: Product[];
  showSimilarity?: boolean;
}) {
  return (
    <ul className="products">
      {products.map((product) => (
        <li key={product.name}>
          <div className="product-head">
            <strong>
              {product.url ? (
                <a href={product.url} target="_blank" rel="noreferrer">
                  {product.name}
                </a>
              ) : (
                product.name
              )}
            </strong>
            {showSimilarity && (
              <span className="num">유사도 {Math.round(product.similarity * 100)}%</span>
            )}
          </div>
          <p>{product.oneLiner}</p>
          <p className="meta">
            {product.launched ? `${product.launched} 출시` : "출시 시기 미상"} · {product.status}
          </p>
        </li>
      ))}
    </ul>
  );
}
