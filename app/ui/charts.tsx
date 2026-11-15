// Small single-series SVG charts. Each one shows one measure, so the heading
// above it names the series and there is no legend. Text stays in ink colors;
// only the marks carry the series color.

const W = 320;
const H = 140;
const PAD = { top: 18, right: 8, bottom: 22, left: 8 };

function scaleY(max: number) {
  const top = max <= 0 ? 1 : max;
  return (value: number) =>
    PAD.top + (1 - value / top) * (H - PAD.top - PAD.bottom);
}

// Label the first, the last and the highest point only.
function labelled(values: number[]) {
  const peak = values.indexOf(Math.max(...values));
  return new Set([0, values.length - 1, peak]);
}

export function BarChart({
  values,
  labels,
  unit,
  description,
}: {
  values: number[];
  labels: string[];
  unit: string;
  description: string;
}) {
  const y = scaleY(Math.max(...values));
  const slot = (W - PAD.left - PAD.right) / values.length;
  const width = slot - 2;
  const base = H - PAD.bottom;
  const show = labelled(values);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description}>
      <line className="chart-axis" x1={PAD.left} x2={W - PAD.right} y1={base} y2={base} />
      {values.map((value, i) => {
        const x = PAD.left + i * slot + 1;
        const top = y(value);
        const height = Math.max(base - top, 0);
        const radius = Math.min(4, height, width / 2);
        return (
          <g key={labels[i]}>
            <title>{`${labels[i]} 주: ${value}${unit}`}</title>
            <rect className="chart-hit" x={x - 1} y={PAD.top} width={slot} height={base - PAD.top} />
            {height > 0 && (
              <path
                className="chart-bar"
                d={`M${x},${base} V${top + radius} Q${x},${top} ${x + radius},${top} H${x + width - radius} Q${x + width},${top} ${x + width},${top + radius} V${base} Z`}
              />
            )}
            {show.has(i) && (
              <text className="chart-value" x={x + width / 2} y={top - 5} textAnchor="middle">
                {value}
              </text>
            )}
          </g>
        );
      })}
      <text className="chart-tick" x={PAD.left} y={H - 6}>{labels[0]}</text>
      <text className="chart-tick" x={W - PAD.right} y={H - 6} textAnchor="end">
        {labels[labels.length - 1]}
      </text>
    </svg>
  );
}

export function LineChart({
  values,
  labels,
  unit,
  description,
}: {
  values: number[];
  labels: string[];
  unit: string;
  description: string;
}) {
  const y = scaleY(Math.max(...values));
  const step = (W - PAD.left - PAD.right - 16) / (values.length - 1);
  const x = (i: number) => PAD.left + 8 + i * step;
  const base = H - PAD.bottom;
  const show = labelled(values);
  const path = values.map((value, i) => `${i ? "L" : "M"}${x(i)},${y(value)}`).join(" ");

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description}>
      <line className="chart-axis" x1={PAD.left} x2={W - PAD.right} y1={base} y2={base} />
      <path className="chart-line" d={path} />
      {values.map((value, i) => (
        <g key={labels[i]}>
          <title>{`${labels[i]} 주: ${value}${unit}`}</title>
          <rect className="chart-hit" x={x(i) - step / 2} y={PAD.top} width={step} height={base - PAD.top} />
          <circle className="chart-dot" cx={x(i)} cy={y(value)} r={show.has(i) ? 4 : 2.5} />
          {show.has(i) && (
            <text className="chart-value" x={x(i)} y={y(value) - 9} textAnchor="middle">
              {value}
            </text>
          )}
        </g>
      ))}
      <text className="chart-tick" x={PAD.left} y={H - 6}>{labels[0]}</text>
      <text className="chart-tick" x={W - PAD.right} y={H - 6} textAnchor="end">
        {labels[labels.length - 1]}
      </text>
    </svg>
  );
}

export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 72;
  const h = 24;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const point = (value: number, i: number) =>
    `${2 + (i * (w - 4)) / (values.length - 1)},${h - 3 - ((value - min) / span) * (h - 6)}`;
  const last = point(values[values.length - 1], values.length - 1).split(",");

  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <polyline className="spark-line" points={values.map(point).join(" ")} />
      <circle className="spark-dot" cx={last[0]} cy={last[1]} r="2.5" />
    </svg>
  );
}
