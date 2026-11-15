"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// The idea universe as a graph: every star is one idea (a shipped product or
// someone's question), stars that mean similar things sit close together and
// are joined by thin lines, and areas show up as denser regions. Drawn to
// look like a deep-field photograph rather than a diagram.

export type MapGalaxy = {
  id: string;
  name: string;
  x: number;
  y: number;
  r: number;
};

export type MapVoid = { id: string; name: string; x: number; y: number; r: number };

type Picked = {
  left: number;
  top: number;
  title: string;
  kind: string;
  area?: { id: string; name: string };
};

const WARM = ["255,176,112", "255,150,84", "255,206,150", "255,224,186"];
const COOL = ["176,204,255", "214,230,255", "150,186,255"];
const MINE = "201,184,255";
const INK = "232,236,255";
const MAX_NODES = 2800;
const MINOR_CLUSTERS = 14;

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

export function UniverseMap({
  galaxies,
  voids,
  mine,
  label,
}: {
  galaxies: MapGalaxy[];
  voids: MapVoid[];
  mine?: { x: number; y: number };
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const random = rng(20261115);
    const gauss = () =>
      Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(6.2832 * random());
    const place = (y: number) => y;

    // Named areas first, then small unnamed clumps scattered around them.
    const centers = [
      ...galaxies.map((g) => ({ x: g.x, y: place(g.y), spread: g.r * 0.5, named: g })),
      ...Array.from({ length: MINOR_CLUSTERS }, () => ({
        x: 0.04 + random() * 0.92,
        y: 0.04 + random() * 0.92,
        spread: 0.02 + random() * 0.035,
        named: undefined as MapGalaxy | undefined,
      })),
    ].map((center) => ({
      ...center,
      stretch: 0.55 + random() * 0.45,
      cos: Math.cos(random() * 3.14),
      sin: Math.sin(random() * 3.14),
      weight: center.spread * center.spread,
      members: [] as number[],
    }));
    const totalWeight = centers.reduce((sum, center) => sum + center.weight, 0);
    const empty = voids.map((area) => ({ area, y: place(area.y) }));

    type Node = {
      center: number;
      x: number;
      y: number;
      z: number;
      tint: string;
      question: boolean;
      spike: boolean;
      oval: boolean;
      rot: number;
      phase: number;
      link: number;
    };
    const nodes: Node[] = [];
    // Nodes are generated in mixed order and each links only to an earlier
    // one, so any prefix of the list is a complete smaller graph.
    for (let i = 0; i < MAX_NODES; i++) {
      const question = random() < 0.38;
      const palette = question ? COOL : WARM;
      const depth = random();
      const node: Node = {
        center: -1,
        x: 0,
        y: 0,
        z: 0.55 + depth * depth * 1.5,
        tint: palette[Math.floor(random() * palette.length)],
        question,
        spike: depth > 0.985,
        oval: !question && random() < 0.14,
        rot: random() * 3.14,
        phase: random() * 6.28,
        link: -1,
      };
      if (random() < 0.3) {
        // A lone idea that belongs to no area yet. Keep empty areas empty.
        for (let tries = 0; tries < 8; tries++) {
          node.x = random();
          node.y = random();
          const inside = empty.some(
            ({ area, y }) => Math.hypot(node.x - area.x, node.y - y) < area.r * 1.1,
          );
          if (!inside) break;
        }
      } else {
        let pick = random() * totalWeight;
        let index = 0;
        while (index < centers.length - 1 && pick > centers[index].weight) {
          pick -= centers[index].weight;
          index++;
        }
        const center = centers[index];
        const first = center.members.length === 0;
        const a = first ? 0 : gauss() * center.spread;
        const b = first ? 0 : gauss() * center.spread * center.stretch;
        node.center = index;
        node.x = a * center.cos - b * center.sin;
        node.y = a * center.sin + b * center.cos;
        if (first) {
          node.spike = Boolean(center.named);
          node.z = center.named ? 1.9 : 1.2;
          node.oval = false;
        } else if (random() < 0.12) {
          node.link = center.members[0];
        } else {
          let best = -1;
          let bestDistance = Infinity;
          for (let k = 0; k < 10; k++) {
            const other = center.members[Math.floor(random() * center.members.length)];
            const distance = Math.hypot(nodes[other].x - node.x, nodes[other].y - node.y);
            if (distance < bestDistance) {
              bestDistance = distance;
              best = other;
            }
          }
          node.link = best;
        }
        center.members.push(i);
      }
      nodes.push(node);
    }

    let width = 0;
    let height = 0;
    let size = 0;
    let ratio = 1;
    let frame = 0;
    let count = 0;
    let selected = -1;
    const positions = new Float32Array(MAX_NODES * 2);
    const font = getComputedStyle(document.body).fontFamily;

    function locate(now: number) {
      for (let i = 0; i < count; i++) {
        const node = nodes[i];
        const sway = still ? 0 : 1.4;
        const ox = Math.sin(now * 0.0004 + node.phase) * sway;
        const oy = Math.cos(now * 0.0003 + node.phase * 1.7) * sway;
        if (node.center < 0) {
          positions[i * 2] = node.x * width + ox;
          positions[i * 2 + 1] = node.y * height + oy;
        } else {
          const center = centers[node.center];
          positions[i * 2] = center.x * width + node.x * size + ox;
          positions[i * 2 + 1] = center.y * height + node.y * size + oy;
        }
      }
    }

    function glow(x: number, y: number, r: number, rgb: string, alpha: number) {
      const gradient = ctx!.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
      gradient.addColorStop(1, `rgba(${rgb},0)`);
      ctx!.fillStyle = gradient;
      ctx!.fillRect(x - r, y - r, r * 2, r * 2);
    }

    function spikes(x: number, y: number, reach: number, rgb: string, alpha: number) {
      const c = ctx!;
      glow(x, y, reach * 0.9, rgb, alpha * 0.5);
      c.strokeStyle = `rgba(${rgb},${alpha})`;
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(x - reach, y);
      c.lineTo(x + reach, y);
      c.moveTo(x, y - reach);
      c.lineTo(x, y + reach);
      c.stroke();
    }

    function draw(now: number) {
      const c = ctx!;
      locate(now);
      c.setTransform(ratio, 0, 0, ratio, 0, 0);
      c.clearRect(0, 0, width, height);
      c.globalCompositeOperation = "lighter";

      // Soft light where an area is dense.
      for (const center of centers) {
        if (center.named) {
          glow(center.x * width, center.y * height, center.spread * size * 3.2, "255,190,130", 0.07);
        }
      }

      c.lineWidth = 0.5;
      c.strokeStyle = "rgba(150,172,255,0.2)";
      c.beginPath();
      for (let i = 0; i < count; i++) {
        const link = nodes[i].link;
        if (link < 0) continue;
        c.moveTo(positions[i * 2], positions[i * 2 + 1]);
        c.lineTo(positions[link * 2], positions[link * 2 + 1]);
      }
      c.stroke();

      for (let i = 0; i < count; i++) {
        const node = nodes[i];
        const x = positions[i * 2];
        const y = positions[i * 2 + 1];
        const twinkle = still ? 0.8 : 0.6 + 0.4 * Math.sin(now * 0.0015 + node.phase * 3);
        if (node.spike) {
          spikes(x, y, 5 + node.z * 4, node.tint, 0.55 + 0.35 * twinkle);
          c.fillStyle = `rgba(${INK},1)`;
          c.beginPath();
          c.arc(x, y, 1.2 + node.z * 0.5, 0, 6.2832);
          c.fill();
        } else if (node.oval) {
          c.fillStyle = `rgba(${node.tint},${0.5 + 0.4 * twinkle})`;
          c.beginPath();
          c.ellipse(x, y, node.z * 2.6, node.z * 0.9, node.rot, 0, 6.2832);
          c.fill();
        } else {
          c.fillStyle = `rgba(${node.tint},${0.6 + 0.4 * twinkle})`;
          c.beginPath();
          c.arc(x, y, node.z, 0, 6.2832);
          c.fill();
        }
      }

      // The chosen star: its direct links and neighbours light up.
      if (selected >= 0 && selected < count) {
        const sx = positions[selected * 2];
        const sy = positions[selected * 2 + 1];
        c.strokeStyle = `rgba(${INK},0.85)`;
        c.lineWidth = 1;
        c.beginPath();
        for (let i = 0; i < count; i++) {
          const link = nodes[i].link;
          if (i !== selected && link !== selected) continue;
          if (link < 0) continue;
          c.moveTo(positions[i * 2], positions[i * 2 + 1]);
          c.lineTo(positions[link * 2], positions[link * 2 + 1]);
          const other = i === selected ? link : i;
          glow(positions[other * 2], positions[other * 2 + 1], 9, INK, 0.5);
        }
        c.stroke();
        spikes(sx, sy, 16, INK, 0.9);
      }

      if (mine) {
        const mx = mine.x * width;
        const my = place(mine.y) * height;
        const nearest: { i: number; d: number }[] = [];
        for (let i = 0; i < count; i++) {
          const d = Math.hypot(positions[i * 2] - mx, positions[i * 2 + 1] - my);
          if (nearest.length < 6 || d < nearest[nearest.length - 1].d) {
            nearest.push({ i, d });
            nearest.sort((a, b) => a.d - b.d);
            if (nearest.length > 6) nearest.pop();
          }
        }
        c.strokeStyle = `rgba(${MINE},0.75)`;
        c.lineWidth = 1;
        c.beginPath();
        for (const { i } of nearest) {
          c.moveTo(mx, my);
          c.lineTo(positions[i * 2], positions[i * 2 + 1]);
          glow(positions[i * 2], positions[i * 2 + 1], 8, MINE, 0.5);
        }
        c.stroke();
        const pulse = still ? 0 : 3 * Math.sin(now * 0.003);
        glow(mx, my, 30 + pulse, MINE, 0.6);
        spikes(mx, my, 18, MINE, 1);
        c.fillStyle = `rgba(${INK},1)`;
        c.beginPath();
        c.arc(mx, my, 3.5, 0, 6.2832);
        c.fill();
      }

      c.globalCompositeOperation = "source-over";
      c.lineWidth = 1;
      c.setLineDash([3, 5]);
      c.strokeStyle = `rgba(${INK},.38)`;
      for (const { area, y } of empty) {
        c.beginPath();
        c.arc(area.x * width, y * height, area.r * size, 0, 6.2832);
        c.stroke();
      }
      c.setLineDash([]);

      c.font = `500 12px ${font}`;
      c.textAlign = "center";
      c.textBaseline = "top";
      c.shadowColor = "rgba(0,0,0,.95)";
      c.shadowBlur = 8;
      const clampX = (x: number, text: string) => {
        const half = c.measureText(text).width / 2 + 6;
        return Math.max(half, Math.min(width - half, x));
      };
      c.fillStyle = `rgba(${INK},.92)`;
      for (const center of centers) {
        if (!center.named) continue;
        const name = center.named.name;
        c.fillText(name, clampX(center.x * width, name), center.y * height + center.spread * size * 1.5 + 6);
      }
      c.fillStyle = `rgba(${INK},.6)`;
      for (const { area, y } of empty) {
        c.fillText(area.name, clampX(area.x * width, area.name), y * height + area.r * size + 4);
      }
      if (mine) {
        c.fillStyle = `rgba(${MINE},1)`;
        c.textBaseline = "bottom";
        c.fillText("내 질문", clampX(mine.x * width, "내 질문"), place(mine.y) * height - 20);
      }
      c.shadowBlur = 0;
    }

    function resize() {
      const box = canvas!.getBoundingClientRect();
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(box.width));
      height = Math.max(1, Math.round(box.height));
      canvas!.width = width * ratio;
      canvas!.height = height * ratio;
      size = Math.min(width, height);
      count = Math.min(MAX_NODES, Math.max(700, Math.round((width * height) / 260)));
      if (still) draw(0);
    }

    function pick(event: PointerEvent) {
      const box = canvas!.getBoundingClientRect();
      const px = event.clientX - box.left;
      const py = event.clientY - box.top;
      const reach = event.pointerType === "mouse" ? 14 : 26;
      let best = -1;
      let bestDistance = reach;
      for (let i = 0; i < count; i++) {
        const d = Math.hypot(positions[i * 2] - px, positions[i * 2 + 1] - py);
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      }
      if (best === selected) return;
      selected = best;
      if (best < 0) {
        setPicked(null);
      } else {
        const node = nodes[best];
        const named = node.center >= 0 ? centers[node.center].named : undefined;
        const kind = node.question ? "누군가의 질문" : "출시된 제품";
        setPicked({
          left: Math.max(96, Math.min(width - 96, positions[best * 2])),
          top: positions[best * 2 + 1],
          title: named ? `${named.name} 쪽 아이디어` : "아직 영역이 없는 아이디어",
          kind,
          area: named ? { id: named.id, name: named.name } : undefined,
        });
      }
      if (still) draw(0);
    }

    function loop(now: number) {
      draw(now);
      frame = requestAnimationFrame(loop);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener("pointermove", pick);
    canvas.addEventListener("pointerdown", pick);
    resize();
    if (!still) frame = requestAnimationFrame(loop);

    return () => {
      observer.disconnect();
      canvas.removeEventListener("pointermove", pick);
      canvas.removeEventListener("pointerdown", pick);
      cancelAnimationFrame(frame);
    };
  }, [galaxies, voids, mine]);

  const tip = picked && (
    <div className="sky-tip" style={{ left: picked.left, top: picked.top }}>
      <strong>{picked.title}</strong>
      <span>{picked.kind}</span>
      {picked.area && <Link href={`/c/${picked.area.id}`}>{picked.area.name} 영역 보기</Link>}
    </div>
  );

  return (
    <div className="sky">
      <div className="sky-frame">
        <canvas ref={ref} role="img" aria-label={label} />
        {tip}
      </div>
      <SkyLegend mine={Boolean(mine)} />
    </div>
  );
}

export function SkyLegend({ mine = false }: { mine?: boolean }) {
  return (
    <ul className="legend">
      <li><i className="d warm" />출시된 제품</li>
      <li><i className="d cool" />누군가의 질문</li>
      <li><i className="d void" />빈 공간</li>
      {mine && <li><i className="d mine" />내 질문</li>}
    </ul>
  );
}
