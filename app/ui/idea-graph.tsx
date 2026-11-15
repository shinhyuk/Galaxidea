"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// The whole collection as one graph, drawn from the static files that
// scripts/build_graph.py writes to public/graph. Every dot is one real
// idea; position, links and groups all come from what the ideas mean.
// Drag to move, pinch or scroll to zoom, tap a dot to read it.

type Group = { label: string; color: string; size: number; x: number; y: number };
type Meta = {
  count: number;
  links: number;
  built: string;
  sources: Record<string, number>;
  chunk: number;
  groups: Group[];
};
type Detail = [source: string, name: string, oneLiner: string, url: string | null, year: number | null];
type Selected = { index: number; detail: Detail | null; neighbours: number };

const NO_GROUP = 65535;
const LOOSE_COLOR = "rgb(132,138,160)";
const SPAN = 65535;
const SOURCE_LABEL: Record<string, string> = { github: "깃허브 저장소", patent: "특허" };

export function IdeaGraph({
  embedded = false,
  star,
}: {
  // A framed panel inside a page instead of the full-screen home view.
  embedded?: boolean;
  // A question to mark on the graph, in graph coordinates (0..65535).
  star?: { x: number; y: number };
} = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<"ask" | "find">("ask");
  const [idea, setIdea] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const starX = star?.x;
  const starY = star?.y;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ index: number; name: string }[]>([]);
  // Handles the drawing code hands back to the React side.
  const api = useRef<{
    focus: (index: number) => void;
    clear: () => void;
    zoom: (factor: number) => void;
    fit: () => void;
    highlight: (matches: number[] | null) => void;
    names: () => Promise<string[]>;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let cancelled = false;
    let cleanup = () => {};

    async function load() {
      const bytes = (name: string) => fetch(`/graph/${name}`).then((r) => {
        if (!r.ok) throw new Error(name);
        return r.arrayBuffer();
      });
      const [info, xyBuffer, groupBuffer, weightBuffer, edgeBuffer] = await Promise.all([
        fetch("/graph/graph.json").then((r) => {
          if (!r.ok) throw new Error("graph.json");
          return r.json() as Promise<Meta>;
        }),
        bytes("xy.bin"),
        bytes("group.bin"),
        bytes("weight.bin"),
        bytes("edges.bin"),
      ]);
      if (cancelled) return;
      cleanup = start(info, new Uint16Array(xyBuffer), new Uint16Array(groupBuffer), new Uint8Array(weightBuffer), new Uint32Array(edgeBuffer));
      setMeta(info);
    }

    function start(info: Meta, xy: Uint16Array, group: Uint16Array, weight: Uint8Array, edges: Uint32Array) {
      const c = ctx!;
      const count = info.count;
      const edgeCount = edges.length / 2;
      const screen = new Float32Array(count * 2);
      const font = getComputedStyle(document.body).fontFamily;

      // Nodes listed group by group, so each color is filled in one pass.
      const order: number[][] = info.groups.map(() => []);
      const loose: number[] = [];
      for (let i = 0; i < count; i++) (group[i] === NO_GROUP ? loose : order[group[i]]).push(i);

      // Neighbour lists, for lighting up a selected node's links.
      const degree = new Uint32Array(count + 1);
      for (let e = 0; e < edges.length; e++) degree[edges[e] + 1]++;
      for (let i = 0; i < count; i++) degree[i + 1] += degree[i];
      const fill = degree.slice(0, count);
      const adjacent = new Uint32Array(edges.length);
      for (let e = 0; e < edgeCount; e++) {
        const a = edges[e * 2];
        const b = edges[e * 2 + 1];
        adjacent[fill[a]++] = b;
        adjacent[fill[b]++] = a;
      }

      let width = 0;
      let height = 0;
      let ratio = 1;
      let scale = 1; // screen pixels per graph unit
      let originX = 0;
      let originY = 0;
      let chosen = -1;
      let matches: Uint8Array | null = null;
      let queued = 0;
      // On a large graph the links are the slow part to draw, so they are
      // left out while the view is moving and drawn once it comes to rest.
      const heavy = edgeCount > 12000;
      let moving = false;
      let settle = 0;
      const details = new Map<number, Promise<Detail[]>>();
      let names: Promise<string[]> | null = null;

      const fitScale = () => (Math.min(width, height) * 0.94) / SPAN;

      // The marked question is joined to the nodes nearest to it.
      const starLinks: number[] = [];
      if (starX !== undefined && starY !== undefined) {
        const byDistance: [number, number][] = [];
        for (let i = 0; i < count; i++) {
          byDistance.push([Math.hypot(xy[i * 2] - starX, xy[i * 2 + 1] - starY), i]);
        }
        byDistance.sort((a, b) => a[0] - b[0]);
        for (const [, i] of byDistance.slice(0, 6)) starLinks.push(i);
      }

      function fit() {
        scale = fitScale();
        originX = width / 2 - (SPAN / 2) * scale;
        originY = height / 2 - (SPAN / 2) * scale;
        redraw();
      }

      function zoomAt(px: number, py: number, factor: number) {
        const next = Math.min(Math.max(scale * factor, fitScale() * 0.6), fitScale() * 80);
        originX = px - ((px - originX) / scale) * next;
        originY = py - ((py - originY) / scale) * next;
        scale = next;
        motion();
      }

      function redraw() {
        if (!queued) queued = requestAnimationFrame(draw);
      }

      function motion() {
        if (heavy) {
          moving = true;
          window.clearTimeout(settle);
          settle = window.setTimeout(() => {
            moving = false;
            redraw();
          }, 160);
        }
        redraw();
      }

      function draw() {
        queued = 0;
        c.setTransform(ratio, 0, 0, ratio, 0, 0);
        c.clearRect(0, 0, width, height);
        for (let i = 0; i < count; i++) {
          screen[i * 2] = originX + xy[i * 2] * scale;
          screen[i * 2 + 1] = originY + xy[i * 2 + 1] * scale;
        }
        const zoom = scale / fitScale();
        const dimmed = matches !== null;

        // Links. Thin and faint: the shape matters, not each line.
        c.lineWidth = 0.6;
        c.strokeStyle = `rgba(150,160,200,${dimmed ? 0.05 : Math.min(0.1 + zoom * 0.03, 0.3)})`;
        c.beginPath();
        for (let e = 0; e < (moving ? 0 : edgeCount); e++) {
          const a = edges[e * 2] * 2;
          const b = edges[e * 2 + 1] * 2;
          const ax = screen[a];
          const ay = screen[a + 1];
          const bx = screen[b];
          const by = screen[b + 1];
          if ((ax < 0 && bx < 0) || (ax > width && bx > width) || (ay < 0 && by < 0) || (ay > height && by > height)) continue;
          c.moveTo(ax, ay);
          c.lineTo(bx, by);
        }
        c.stroke();

        const base = Math.max(0.7, Math.min(0.9 * Math.sqrt(zoom), 5));
        const paint = (indexes: number[], color: string) => {
          c.fillStyle = color;
          c.globalAlpha = dimmed ? 0.18 : 0.9;
          c.beginPath();
          for (const i of indexes) {
            const x = screen[i * 2];
            const y = screen[i * 2 + 1];
            if (x < -8 || x > width + 8 || y < -8 || y > height + 8) continue;
            const r = base * (0.75 + (weight[i] / 255) * 2.4);
            if (r < 1.6) c.rect(x - r, y - r, r * 2, r * 2);
            else {
              c.moveTo(x + r, y);
              c.arc(x, y, r, 0, 6.2832);
            }
          }
          c.fill();
        };
        paint(loose, LOOSE_COLOR);
        info.groups.forEach((g, index) => paint(order[index], g.color));
        c.globalAlpha = 1;

        if (matches) {
          c.fillStyle = "rgb(255,255,255)";
          c.beginPath();
          for (let i = 0; i < count; i++) {
            if (!matches[i]) continue;
            const x = screen[i * 2];
            const y = screen[i * 2 + 1];
            c.moveTo(x + base * 2.2, y);
            c.arc(x, y, base * 2.2, 0, 6.2832);
          }
          c.fill();
        }

        if (chosen >= 0) {
          const x = screen[chosen * 2];
          const y = screen[chosen * 2 + 1];
          c.strokeStyle = "rgba(255,255,255,0.9)";
          c.lineWidth = 1.2;
          c.beginPath();
          for (let k = degree[chosen]; k < degree[chosen + 1]; k++) {
            const other = adjacent[k] * 2;
            c.moveTo(x, y);
            c.lineTo(screen[other], screen[other + 1]);
          }
          c.stroke();
          c.fillStyle = "rgb(255,255,255)";
          c.beginPath();
          for (let k = degree[chosen]; k < degree[chosen + 1]; k++) {
            const other = adjacent[k] * 2;
            c.moveTo(screen[other] + base * 2, screen[other + 1]);
            c.arc(screen[other], screen[other + 1], base * 2, 0, 6.2832);
          }
          c.moveTo(x + base * 3.4, y);
          c.arc(x, y, base * 3.4, 0, 6.2832);
          c.fill();
          c.strokeStyle = "rgba(255,255,255,0.5)";
          c.beginPath();
          c.arc(x, y, base * 3.4 + 6, 0, 6.2832);
          c.stroke();
        }

        if (starX !== undefined && starY !== undefined) {
          const x = originX + starX * scale;
          const y = originY + starY * scale;
          c.strokeStyle = "rgba(201,184,255,0.8)";
          c.lineWidth = 1;
          c.beginPath();
          for (const i of starLinks) {
            c.moveTo(x, y);
            c.lineTo(screen[i * 2], screen[i * 2 + 1]);
          }
          c.moveTo(x - 14, y);
          c.lineTo(x + 14, y);
          c.moveTo(x, y - 14);
          c.lineTo(x, y + 14);
          c.stroke();
          c.fillStyle = "rgb(201,184,255)";
          c.beginPath();
          c.arc(x, y, 5, 0, 6.2832);
          c.fill();
          c.font = `500 12px ${font}`;
          c.textAlign = "center";
          c.textBaseline = "bottom";
          c.shadowColor = "rgba(0,0,0,0.95)";
          c.shadowBlur = 6;
          c.fillText("내 질문", x, y - 18);
          c.shadowBlur = 0;
        }

        // Names of the larger groups, biggest first, skipping any that
        // would land on one already written. Zooming in makes room for more.
        const shown = Math.min(info.groups.length, Math.round((width / 90) * (1 + zoom)));
        const taken: [number, number, number, number][] = [];
        c.font = `500 12px ${font}`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.shadowColor = "rgba(0,0,0,0.95)";
        c.shadowBlur = 6;
        c.globalAlpha = dimmed ? 0.35 : 1;
        c.fillStyle = "rgba(240,242,255,0.92)";
        for (let index = 0, written = 0; index < info.groups.length && written < shown; index++) {
          const g = info.groups[index];
          if (!g.label) continue;
          const x = originX + g.x * scale;
          const y = originY + g.y * scale;
          if (x < 0 || x > width || y < 0 || y > height) continue;
          const half = c.measureText(g.label).width / 2 + 6;
          if (taken.some(([l, t, r, b]) => x - half < r && x + half > l && y - 10 < b && y + 10 > t)) continue;
          taken.push([x - half, y - 10, x + half, y + 10]);
          c.fillText(g.label, x, y);
          written++;
        }
        c.globalAlpha = 1;
        c.shadowBlur = 0;
      }

      function resize() {
        const box = canvas!.getBoundingClientRect();
        const first = width === 0;
        ratio = Math.min(window.devicePixelRatio || 1, 2);
        width = Math.max(1, Math.round(box.width));
        height = Math.max(1, Math.round(box.height));
        canvas!.width = width * ratio;
        canvas!.height = height * ratio;
        if (first && starX !== undefined && starY !== undefined) {
          scale = fitScale() * 7;
          originX = width / 2 - starX * scale;
          originY = height / 2 - starY * scale;
          redraw();
        } else if (first) fit();
        else redraw();
      }

      function detailOf(index: number) {
        const chunk = Math.floor(index / info.chunk);
        if (!details.has(chunk)) {
          details.set(chunk, fetch(`/graph/d/${chunk}.json`).then((r) => r.json() as Promise<Detail[]>));
        }
        return details.get(chunk)!.then((list) => list[index % info.chunk]);
      }

      function choose(index: number) {
        chosen = index;
        redraw();
        if (index < 0) {
          setSelected(null);
          return;
        }
        const neighbours = degree[index + 1] - degree[index];
        setSelected({ index, detail: null, neighbours });
        detailOf(index).then(
          (detail) => {
            if (chosen === index) setSelected({ index, detail, neighbours });
          },
          () => {},
        );
      }

      function nearest(px: number, py: number, reach: number) {
        let best = -1;
        let bestDistance = reach * reach;
        for (let i = 0; i < count; i++) {
          const dx = screen[i * 2] - px;
          const dy = screen[i * 2 + 1] - py;
          const d = dx * dx + dy * dy;
          if (d < bestDistance) {
            bestDistance = d;
            best = i;
          }
        }
        return best;
      }

      // Pointers: one finger or the mouse drags, two fingers pinch, and a
      // press that barely moves is a tap.
      const pointers = new Map<number, { x: number; y: number }>();
      let moved = 0;
      let pinch = 0;
      const local = (event: PointerEvent | WheelEvent) => {
        const box = canvas!.getBoundingClientRect();
        return { x: event.clientX - box.left, y: event.clientY - box.top };
      };

      function down(event: PointerEvent) {
        canvas!.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, local(event));
        moved = 0;
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinch = Math.hypot(a.x - b.x, a.y - b.y);
        }
      }

      function move(event: PointerEvent) {
        const before = pointers.get(event.pointerId);
        if (!before) return;
        const now = local(event);
        pointers.set(event.pointerId, now);
        if (pointers.size === 1) {
          originX += now.x - before.x;
          originY += now.y - before.y;
          moved += Math.abs(now.x - before.x) + Math.abs(now.y - before.y);
          motion();
        } else if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, distance / pinch);
          pinch = distance;
          moved += 10;
        }
      }

      function up(event: PointerEvent) {
        const at = pointers.get(event.pointerId);
        pointers.delete(event.pointerId);
        pinch = 0;
        if (at && pointers.size === 0 && moved < 8) {
          choose(nearest(at.x, at.y, event.pointerType === "mouse" ? 12 : 24));
        }
      }

      function wheel(event: WheelEvent) {
        event.preventDefault();
        const at = local(event);
        zoomAt(at.x, at.y, Math.exp(-event.deltaY * 0.0015));
      }

      api.current = {
        focus(index) {
          scale = Math.max(scale, fitScale() * 6);
          originX = width / 2 - xy[index * 2] * scale;
          originY = height * 0.42 - xy[index * 2 + 1] * scale;
          choose(index);
        },
        clear: () => choose(-1),
        zoom: (factor) => zoomAt(width / 2, height / 2, factor),
        fit,
        highlight(list) {
          if (!list) matches = null;
          else {
            matches = new Uint8Array(count);
            for (const i of list) matches[i] = 1;
          }
          redraw();
        },
        names() {
          names ??= fetch("/graph/names.json").then((r) => r.json() as Promise<string[]>);
          return names;
        },
      };

      const observer = new ResizeObserver(resize);
      observer.observe(canvas!);
      canvas!.addEventListener("pointerdown", down);
      canvas!.addEventListener("pointermove", move);
      canvas!.addEventListener("pointerup", up);
      canvas!.addEventListener("pointercancel", up);
      canvas!.addEventListener("wheel", wheel, { passive: false });
      resize();

      return () => {
        observer.disconnect();
        canvas!.removeEventListener("pointerdown", down);
        canvas!.removeEventListener("pointermove", move);
        canvas!.removeEventListener("pointerup", up);
        canvas!.removeEventListener("pointercancel", up);
        canvas!.removeEventListener("wheel", wheel);
        cancelAnimationFrame(queued);
        window.clearTimeout(settle);
        api.current = null;
      };
    }

    load().catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [starX, starY]);

  // Search by name: light up every match and list the first few.
  useEffect(() => {
    const text = query.trim().toLowerCase();
    if (text.length < 2) {
      api.current?.highlight(null);
      return;
    }
    let stale = false;
    api.current?.names().then((names) => {
      if (stale) return;
      const found: number[] = [];
      for (let i = 0; i < names.length; i++) {
        if (names[i].toLowerCase().includes(text)) found.push(i);
      }
      api.current?.highlight(found);
      setResults(found.slice(0, 6).map((index) => ({ index, name: names[index] })));
    });
    return () => {
      stale = true;
    };
  }, [query]);

  async function submitIdea(event: React.FormEvent) {
    event.preventDefault();
    if (asking || idea.trim().length < 4) return;
    setAsking(true);
    setAskError("");
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.id) {
        router.push(`/q/${body.id}`);
        return;
      }
      setAskError(body.error || "지금은 답을 만들지 못했습니다.");
    } catch {
      setAskError("연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
    setAsking(false);
  }

  const searching = mode === "find" && query.trim().length >= 2;
  const total = meta?.count ?? 0;

  return (
    <div className={embedded ? "graph graph-embedded" : "graph"}>
      <canvas ref={canvasRef} role="img" aria-label="모인 아이디어 전체를 점과 선으로 그린 그래프. 뜻이 비슷한 것끼리 가까이 모여 있습니다." />

      {!embedded && <div className="graph-top">
        {meta ? (
          <p>
            <b>{total.toLocaleString("ko-KR")}</b>개의 아이디어 ·{" "}
            <b>{meta.links.toLocaleString("ko-KR")}</b>개의 연결 · {meta.groups.length}개의 무리
          </p>
        ) : failed ? (
          <p>그래프를 불러오지 못했습니다.</p>
        ) : (
          <p>불러오는 중…</p>
        )}
        {meta && (
          <p className="graph-note">
            {Object.entries(meta.sources)
              .map(([source, n]) => `${SOURCE_LABEL[source] ?? source} ${n.toLocaleString("ko-KR")}`)
              .join(" · ")}{" "}
            · {meta.built} 기준
          </p>
        )}
      </div>}

      <div className="graph-zoom">
        <button type="button" onClick={() => api.current?.zoom(1.6)} aria-label="확대">＋</button>
        <button type="button" onClick={() => api.current?.zoom(1 / 1.6)} aria-label="축소">－</button>
        <button type="button" onClick={() => api.current?.fit()} aria-label="전체 보기">⤢</button>
      </div>

      <div className="graph-bottom">
        {selected && (
          <article className="graph-card">
            <button type="button" className="graph-close" onClick={() => api.current?.clear()} aria-label="닫기">×</button>
            {selected.detail ? (
              <>
                <p className="eyebrow">
                  {SOURCE_LABEL[selected.detail[0]] ?? selected.detail[0]}
                  {selected.detail[4] ? ` · ${selected.detail[4]}년` : ""} · 이어진 아이디어 {selected.neighbours}개
                </p>
                <h2>{selected.detail[1]}</h2>
                <p>{selected.detail[2]}</p>
                {selected.detail[3] && (
                  <a href={selected.detail[3]} target="_blank" rel="noreferrer">원문 열기</a>
                )}
              </>
            ) : (
              <p className="eyebrow">불러오는 중…</p>
            )}
          </article>
        )}
        {searching && !selected && results.length > 0 && (
          <ul className="graph-results">
            {results.map(({ index, name }) => (
              <li key={index}>
                <button type="button" onClick={() => api.current?.focus(index)}>
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!embedded && mode === "ask" && (
          <form className="graph-ask" onSubmit={submitIdea}>
            <div className="graph-search">
              <input
                type="text"
                value={idea}
                maxLength={300}
                onChange={(event) => setIdea(event.target.value)}
                placeholder="아이디어를 한 줄로 적어 보세요"
                autoComplete="off"
                aria-label="아이디어"
              />
              <button type="submit" disabled={asking || idea.trim().length < 4}>
                {asking ? "찾는 중…" : "별 띄우기"}
              </button>
            </div>
            <p className="graph-hint">
              {askError ? <span className="graph-error">{askError}</span> : "질문은 한 줄 요약으로 익명 공개됩니다"}
              <button type="button" className="graph-switch" onClick={() => setMode("find")}>
                이름으로 찾기
              </button>
            </p>
          </form>
        )}
        {!embedded && mode === "find" && (
          <div className="graph-ask">
            <label className="graph-search">
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  api.current?.clear();
                }}
                placeholder="이름으로 찾기 (예: react, llm)"
                autoComplete="off"
                aria-label="이름으로 찾기"
              />
            </label>
            <p className="graph-hint">
              그래프에 있는 것의 이름에서 찾습니다
              <button
                type="button"
                className="graph-switch"
                onClick={() => {
                  setMode("ask");
                  setQuery("");
                }}
              >
                아이디어 묻기
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
