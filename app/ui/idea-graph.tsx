"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// The whole collection drawn as a universe, from the static files that
// scripts/build_graph.py writes to public/graph. Every dot is one real
// idea; where it sits, what it links to and which galaxy it falls in all
// come from what the ideas mean. Nothing here is sorted by hand.
// Drag to move, pinch or scroll to zoom, tap a dot to read it.

type Region = {
  label: string;
  color: string; // "r,g,b"
  size: number;
  x: number;
  y: number;
  spread: number;
  recent: number;
  lift: number;
};
type Group = { label: string; color: string; size: number; x: number; y: number; recent?: number; lift?: number };
type Meta = {
  count: number;
  links: number;
  built: string;
  sources: Record<string, number>;
  chunk: number;
  since?: number;
  years?: Record<string, number>;
  regions?: Region[];
  groups: Group[];
};
type Detail = [source: string, name: string, oneLiner: string, url: string | null, year: number | null];
type Selected = { index: number; detail: Detail | null; neighbours: number };
type Trending = { index: number; label: string; recent: number; size: number };

const SPAN = 65535;
const INK = "232,236,255";
const PLAIN = "150,158,190";
const SOURCE_LABEL: Record<string, string> = { github: "깃허브 저장소", patent: "특허" };

function rng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const korean = (value: number) => value.toLocaleString("ko-KR");

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [tab, setTab] = useState<"all" | "rising">("all");
  const [panel, setPanel] = useState<"glance" | "rising" | null>(null);
  const [mode, setMode] = useState<"ask" | "find">("ask");
  const [idea, setIdea] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ index: number; name: string }[]>([]);
  const starX = star?.x;
  const starY = star?.y;
  // Handles the drawing code hands back to the React side.
  const api = useRef<{
    focus: (index: number) => void;
    lookAt: (x: number, y: number, reach: number) => void;
    clear: () => void;
    relayout: () => void;
    zoom: (factor: number) => void;
    fit: () => void;
    highlight: (matches: number[] | null) => void;
    highlightGroups: (groups: number[] | null) => void;
    names: () => Promise<string[]>;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let cancelled = false;
    let cleanup = () => {};

    async function load() {
      const bytes = (name: string, optional = false) =>
        fetch(`/graph/${name}`).then((r) => {
          if (r.ok) return r.arrayBuffer();
          if (optional) return null;
          throw new Error(name);
        });
      const [info, xyBuffer, groupBuffer, weightBuffer, edgeBuffer, regionBuffer] = await Promise.all([
        fetch("/graph/graph.json").then((r) => {
          if (!r.ok) throw new Error("graph.json");
          return r.json() as Promise<Meta>;
        }),
        bytes("xy.bin"),
        bytes("group.bin"),
        bytes("weight.bin"),
        bytes("edges.bin"),
        bytes("region.bin", true),
      ]);
      if (cancelled) return;
      cleanup = start(
        info,
        new Uint16Array(xyBuffer!),
        new Uint16Array(groupBuffer!),
        new Uint8Array(weightBuffer!),
        new Uint32Array(edgeBuffer!),
        regionBuffer ? new Uint8Array(regionBuffer) : null,
      );
      setMeta(info);
    }

    function start(
      info: Meta,
      xy: Uint16Array,
      group: Uint16Array,
      weight: Uint8Array,
      edges: Uint32Array,
      regionOf: Uint8Array | null,
    ) {
      const c = ctx!;
      const count = info.count;
      const edgeCount = edges.length / 2;
      const regions = regionOf ? (info.regions ?? []) : [];
      const screen = new Float32Array(count * 2);
      const font = getComputedStyle(document.body).fontFamily;
      const random = rng(20261115);

      // Nodes listed galaxy by galaxy, so each color is filled in one pass.
      const order: number[][] = regions.map(() => []);
      const plain: number[] = [];
      const hubs: number[] = [];
      for (let i = 0; i < count; i++) {
        if (regionOf && regions[regionOf[i]]) order[regionOf[i]].push(i);
        else plain.push(i);
        if (weight[i] > 215) hubs.push(i);
      }

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

      // Far stars behind everything; they do not move with the graph.
      const backdrop = Array.from({ length: 420 }, () => ({
        x: random(),
        y: random(),
        z: 0.4 + random() * random() * 1.6,
        tint: [INK, INK, "170,200,255", "255,214,170", "214,190,255"][Math.floor(random() * 5)],
      }));

      let width = 0;
      let height = 0;
      let ratio = 1;
      // On a wide screen the universe is drawn as a disc seen at an angle;
      // on a tall one it stays round so it can fill the width.
      let tilt = 0.62;
      let cardSizes: [number, number][] = [];
      let scale = 1; // screen pixels per graph unit, horizontally
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

      const sx = (x: number) => originX + x * scale;
      const sy = (y: number) => originY + y * scale * tilt;
      // The overview leaves room for the header above and the bar below.
      const fitScale = () => Math.min((width * 0.98) / SPAN, (height * (embedded ? 0.92 : 0.72)) / (SPAN * tilt));

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

      function centreOn(x: number, y: number, at = 0.5) {
        originX = width / 2 - x * scale;
        originY = height * at - y * scale * tilt;
      }

      function fit() {
        scale = fitScale();
        centreOn(SPAN / 2, SPAN / 2, embedded ? 0.5 : 0.47);
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

      function glow(x: number, y: number, r: number, rgb: string, alpha: number) {
        if (r < 1) return;
        const gradient = c.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
        gradient.addColorStop(1, `rgba(${rgb},0)`);
        c.fillStyle = gradient;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }

      function draw() {
        queued = 0;
        c.setTransform(ratio, 0, 0, ratio, 0, 0);
        c.clearRect(0, 0, width, height);
        for (let i = 0; i < count; i++) {
          screen[i * 2] = sx(xy[i * 2]);
          screen[i * 2 + 1] = sy(xy[i * 2 + 1]);
        }
        const zoom = scale / fitScale();
        const dimmed = matches !== null;
        const near = Math.min(Math.max((zoom - 2.2) / 2.4, 0), 1); // 0 overview .. 1 close up

        c.globalCompositeOperation = "lighter";
        for (const star of backdrop) {
          c.fillStyle = `rgba(${star.tint},${0.25 + star.z * 0.28})`;
          c.fillRect(star.x * width, star.y * height, star.z, star.z);
        }

        // Each galaxy: a haze of its color, a bright core and orbit rings.
        for (const region of regions) {
          const x = sx(region.x);
          const y = sy(region.y);
          const reach = region.spread * scale;
          if (x < -reach * 3 || x > width + reach * 3 || y < -reach * 3 || y > height + reach * 3) continue;
          const strength = dimmed ? 0.35 : 1 - near * 0.6;
          glow(x, y, reach * 3, region.color, 0.2 * strength);
          glow(x, y, reach * 1.1, region.color, 0.3 * strength);
          glow(x, y, reach * 0.35, INK, 0.5 * strength);
          c.lineWidth = 1;
          for (const ring of [1.15, 1.75, 2.4]) {
            c.strokeStyle = `rgba(${region.color},${(0.4 - ring * 0.11) * strength})`;
            c.beginPath();
            c.ellipse(x, y, reach * ring, reach * ring * tilt, 0, 0, 6.2832);
            c.stroke();
          }
        }

        // Links. Thin and faint: the shape matters, not each line.
        c.lineWidth = 0.6;
        c.strokeStyle = `rgba(150,165,255,${dimmed ? 0.05 : Math.min(0.1 + zoom * 0.03, 0.3)})`;
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

        const base = Math.max(0.6, Math.min(0.8 * Math.sqrt(zoom), 5));
        const paint = (indexes: number[], rgb: string) => {
          c.fillStyle = `rgba(${rgb},${dimmed ? 0.14 : 0.62})`;
          c.beginPath();
          for (const i of indexes) {
            const x = screen[i * 2];
            const y = screen[i * 2 + 1];
            if (x < -8 || x > width + 8 || y < -8 || y > height + 8) continue;
            const r = base * (0.7 + (weight[i] / 255) * 2.2);
            if (r < 1.5) c.rect(x - r, y - r, r * 2, r * 2);
            else {
              c.moveTo(x + r, y);
              c.arc(x, y, r, 0, 6.2832);
            }
          }
          c.fill();
        };
        paint(plain, PLAIN);
        regions.forEach((region, index) => paint(order[index], region.color));

        // The best connected ideas shine.
        if (!dimmed) {
          for (const i of hubs) {
            const x = screen[i * 2];
            const y = screen[i * 2 + 1];
            if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;
            const rgb = regionOf && regions[regionOf[i]] ? regions[regionOf[i]].color : PLAIN;
            glow(x, y, 5 + base * 4, rgb, 0.55);
            c.fillStyle = `rgba(${INK},0.9)`;
            c.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
          }
        }

        if (matches) {
          c.fillStyle = `rgba(${INK},1)`;
          c.beginPath();
          for (let i = 0; i < count; i++) {
            if (!matches[i]) continue;
            const x = screen[i * 2];
            const y = screen[i * 2 + 1];
            c.moveTo(x + base * 1.8, y);
            c.arc(x, y, base * 1.8, 0, 6.2832);
          }
          c.fill();
        }
        c.globalCompositeOperation = "source-over";

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
          const x = sx(starX);
          const y = sy(starY);
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
          glow(x, y, 22, "201,184,255", 0.6);
          c.fillStyle = "rgb(255,255,255)";
          c.beginPath();
          c.arc(x, y, 4, 0, 6.2832);
          c.fill();
          c.font = `500 12px ${font}`;
          c.textAlign = "center";
          c.textBaseline = "bottom";
          c.shadowColor = "rgba(0,0,0,0.95)";
          c.shadowBlur = 6;
          c.fillStyle = "rgb(201,184,255)";
          c.fillText("내 질문", x, y - 18);
          c.shadowBlur = 0;
        }

        // Names of the smaller groups appear on the way in; from far away
        // the galaxy cards carry the names.
        if (near > 0 || regions.length === 0) {
          const shown = Math.min(info.groups.length, Math.round((width / 90) * (1 + zoom)));
          const taken: [number, number, number, number][] = [];
          c.font = `500 12px ${font}`;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.shadowColor = "rgba(0,0,0,0.95)";
          c.shadowBlur = 6;
          c.fillStyle = `rgba(240,242,255,${(regions.length ? near : 1) * (dimmed ? 0.4 : 0.92)})`;
          for (let index = 0, written = 0; index < info.groups.length && written < shown; index++) {
            const g = info.groups[index];
            if (!g.label) continue;
            const x = sx(g.x);
            const y = sy(g.y);
            if (x < 0 || x > width || y < 0 || y > height) continue;
            const half = c.measureText(g.label).width / 2 + 6;
            if (taken.some(([l, t, r, b]) => x - half < r && x + half > l && y - 10 < b && y + 10 > t)) continue;
            taken.push([x - half, y - 10, x + half, y + 10]);
            c.fillText(g.label, x, y);
            written++;
          }
          c.shadowBlur = 0;
        }

        // The galaxy cards are HTML; move them with the view. Larger
        // galaxies go first, and a card that would cover one already
        // placed stays hidden until zooming in makes room.
        const cards = cardsRef.current?.children;
        if (cards) {
          const placed: [number, number, number, number][] = [];
          regions.forEach((region, index) => {
            const card = cards[index] as HTMLElement | undefined;
            if (!card) return;
            const [w, h] = cardSizes[index] ?? [150, 44];
            const x = sx(region.x);
            const y = sy(region.y);
            const box: [number, number, number, number] = [x - w / 2 - 4, y + 6, x + w / 2 + 4, y + 14 + h];
            const inside = box[0] > 0 && box[2] < width && box[1] > 96 && box[3] < height - 150;
            const free = !placed.some(([l, t, r, b]) => box[0] < r && box[2] > l && box[1] < b && box[3] > t);
            const visible = (embedded || inside) && free && near < 1;
            if (visible) placed.push(box);
            card.style.transform = `translate(${x}px, ${y}px) translate(-50%, 10px)`;
            card.style.opacity = visible ? String((1 - near) * (dimmed ? 0.5 : 1)) : "0";
            card.style.pointerEvents = visible && near < 0.5 ? "auto" : "none";
          });
        }
      }

      function measureCards() {
        cardSizes = [...(cardsRef.current?.children ?? [])].map((card) => [
          (card as HTMLElement).offsetWidth,
          (card as HTMLElement).offsetHeight,
        ]);
      }

      function resize() {
        const box = canvas!.getBoundingClientRect();
        const first = width === 0;
        ratio = Math.min(window.devicePixelRatio || 1, 2);
        width = Math.max(1, Math.round(box.width));
        height = Math.max(1, Math.round(box.height));
        canvas!.width = width * ratio;
        canvas!.height = height * ratio;
        tilt = width >= height ? 0.62 : 0.94;
        measureCards();
        if (first && starX !== undefined && starY !== undefined) {
          scale = fitScale() * 6;
          centreOn(starX, starY);
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
          centreOn(xy[index * 2], xy[index * 2 + 1], 0.42);
          choose(index);
        },
        lookAt(x, y, reach) {
          scale = Math.min((Math.min(width, height) * 0.42) / Math.max(reach, 1), fitScale() * 40);
          centreOn(x, y, 0.45);
          motion();
        },
        clear: () => choose(-1),
        relayout() {
          measureCards();
          redraw();
        },
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
        highlightGroups(list) {
          if (!list) matches = null;
          else {
            const wanted = new Set(list);
            matches = new Uint8Array(count);
            for (let i = 0; i < count; i++) if (wanted.has(group[i])) matches[i] = 1;
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
  }, [starX, starY, embedded]);

  // The groups with the largest share of recent items, among those big
  // enough for the share to mean something.
  const rising: Trending[] = meta
    ? meta.groups
        .map((g, index) => ({ index, label: g.label, recent: g.recent ?? 0, size: g.size }))
        .filter((g) => g.size >= 40 && g.label)
        .sort((a, b) => b.recent - a.recent)
        .slice(0, 5)
    : [];
  const risingKey = rising.map((g) => g.index).join(",");

  // The cards exist only once the data has arrived; measure them then.
  useEffect(() => {
    api.current?.relayout();
  }, [meta]);

  // Search by name, or the "rising" tab: light up the matching dots.
  useEffect(() => {
    const text = query.trim().toLowerCase();
    if (mode === "find" && text.length >= 2) {
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
    }
    if (tab === "rising" && risingKey) api.current?.highlightGroups(risingKey.split(",").map(Number));
    else api.current?.highlight(null);
  }, [query, mode, tab, risingKey, meta]);

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
  const regions = meta?.regions ?? [];
  const years = Object.entries(meta?.years ?? {});
  const peak = Math.max(1, ...years.map(([, n]) => n));
  const since = meta?.since;

  return (
    <div className={embedded ? "graph graph-embedded" : "graph"}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="모인 아이디어 전체를 은하들로 그린 지도. 뜻이 비슷한 것끼리 가까이 모여 있습니다."
      />

      {!embedded && (
        <div className="galaxy-cards" ref={cardsRef}>
          {regions.map((region) => (
            <button
              key={`${region.x}-${region.y}`}
              type="button"
              className="galaxy-card"
              style={{ "--tint": region.color } as React.CSSProperties}
              onClick={() => api.current?.lookAt(region.x, region.y, region.spread * 2.6)}
            >
              <i />
              <span>
                <strong>{region.label}</strong>
                <span>
                  <b>{region.lift >= 1 ? "▲" : "▽"} 평균의 {region.lift.toFixed(1)}배</b> · {korean(region.size)}개
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {!embedded && (
        <div className="graph-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")}>
            우주
          </button>
          <button type="button" role="tab" aria-selected={tab === "rising"} onClick={() => setTab("rising")}>
            뜨는 무리
          </button>
        </div>
      )}

      {!embedded && !meta && <p className="graph-status">{failed ? "지도를 불러오지 못했습니다." : "불러오는 중…"}</p>}

      <div className="graph-zoom">
        <button type="button" onClick={() => api.current?.zoom(1.6)} aria-label="확대">＋</button>
        <button type="button" onClick={() => api.current?.zoom(1 / 1.6)} aria-label="축소">－</button>
        <button type="button" onClick={() => api.current?.fit()} aria-label="전체 보기">⤢</button>
      </div>

      {!embedded && meta && (
        <>
          <section className={panel === "glance" ? "graph-panel glance open" : "graph-panel glance"}>
            <h2>한눈에 보기</h2>
            <div className="glance-numbers">
              <p><b>{korean(meta.count)}</b>아이디어</p>
              <p><b>{korean(meta.links)}</b>연결</p>
              <p><b>{korean(meta.groups.length)}</b>무리</p>
            </div>
            {years.length > 1 && (
              <svg className="glance-chart" viewBox="0 0 200 48" role="img" aria-label={`${years[0][0]}년부터 ${years[years.length - 1][0]}년까지 해마다 새로 생긴 수`}>
                <polyline
                  points={years.map(([, n], i) => `${(i / (years.length - 1)) * 196 + 2},${44 - (n / peak) * 38}`).join(" ")}
                />
              </svg>
            )}
            <p className="panel-note">
              {years.length > 1 ? `해마다 새로 생긴 수, ${years[0][0]}~${years[years.length - 1][0]}년 · ` : ""}
              {Object.entries(meta.sources)
                .map(([source, n]) => `${SOURCE_LABEL[source] ?? source} ${korean(n)}`)
                .join(", ")}{" "}
              · {meta.built} 기준
            </p>
          </section>

          <section className={panel === "rising" ? "graph-panel rising open" : "graph-panel rising"}>
            <h2>지금 뜨는 무리</h2>
            <ol>
              {rising.map((g, i) => (
                <li key={g.index}>
                  <button
                    type="button"
                    onClick={() => {
                      const target = meta.groups[g.index];
                      api.current?.lookAt(target.x, target.y, 2600);
                      setPanel(null);
                    }}
                  >
                    <span className="rank">{i + 1}</span>
                    <span className="name">{g.label}</span>
                    <b>{Math.round(g.recent * 100)}%</b>
                  </button>
                </li>
              ))}
            </ol>
            <p className="panel-note">{since ? `${since}년 이후에 생긴 것의 비중` : "최근에 생긴 것의 비중"}</p>
          </section>
        </>
      )}

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
        {!embedded && (
          <div className="graph-toggles">
            <button type="button" aria-pressed={panel === "glance"} onClick={() => setPanel(panel === "glance" ? null : "glance")}>
              한눈에 보기
            </button>
            <button type="button" aria-pressed={panel === "rising"} onClick={() => setPanel(panel === "rising" ? null : "rising")}>
              지금 뜨는 무리
            </button>
          </div>
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
              지도에 있는 것의 이름에서 찾습니다
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
