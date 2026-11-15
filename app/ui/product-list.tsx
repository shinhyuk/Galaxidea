type Product = {
  name: string;
  oneLiner: string;
  launched: string | null;
  status: string;
  url: string | null;
  similarity: number;
  // How this one relates to the question, when the report says.
  note?: string;
};

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
          {product.note && <p className="note">{product.note}</p>}
          <p className="meta">
            {product.launched ? `${product.launched} 출시` : "출시 시기 미상"} · {product.status}
          </p>
        </li>
      ))}
    </ul>
  );
}
