"use client";

import { useEffect, useRef } from "react";

// Canvas map of the idea universe: one galaxy per cluster, dashed rings for
// empty areas, and the asker's own star. The drawing follows docs/demo.html.

export type MapGalaxy = {
  id: string;
  name: string;
  x: number;
  y: number;
  r: number;
  count: number;
  tone: "sat" | "grow" | "dim";
};

export type MapVoid = { id: string; name: string; x: number; y: number; r: number };

const RGB = {
  sat: "255,217,138",
  grow: "127,224,196",
  dim: "120,134,196",
  mine: "201,184,255",
  ink: "232,236,255",
};

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

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const random = rng(20261115);
    const systems = galaxies.map((galaxy, index) => {
      const tilt = (random() - 0.5) * 1.6;
      const stars = Array.from({ length: Math.round(18 + galaxy.r * 450) }, (_, i) => {
        const t = Math.pow(random(), 0.7);
        return {
          t,
          a: (i % 2) * Math.PI + t * 4.2 + (random() - 0.5) * 0.9,
          z: 0.6 + random() * 1.3,
          p: random() * 6.28,
          white: random() < 0.3,
        };
      });
      return { galaxy, tilt, dir: index % 2 ? -1 : 1, stars };
    });
    const backdrop = Array.from({ length: 150 }, () => ({
      x: random(),
      y: random(),
      z: 0.4 + random() * 0.9,
      p: random() * 6.28,
    }));

    let width = 0;
    let height = 0;
    let size = 0;
    let ratio = 1;
    let frame = 0;
    const font = getComputedStyle(document.body).fontFamily;

    function dot(x: number, y: number, r: number, rgb: string, alpha: number) {
      ctx!.beginPath();
      ctx!.arc(x, y, r, 0, 6.2832);
      ctx!.fillStyle = `rgba(${rgb},${alpha})`;
      ctx!.fill();
    }

    function draw(now: number) {
      const c = ctx!;
      c.setTransform(ratio, 0, 0, ratio, 0, 0);
      c.clearRect(0, 0, width, height);

      for (const star of backdrop) {
        dot(star.x * width, star.y * height, star.z, RGB.ink, 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(now * 0.0012 + star.p)));
      }

      for (const { galaxy, tilt, dir, stars } of systems) {
        const rgb = RGB[galaxy.tone];
        const cx = galaxy.x * width;
        const cy = galaxy.y * height;
        const radius = galaxy.r * size;
        const rot = now * 0.00005 * dir;
        const cos = Math.cos(tilt);
        const sin = Math.sin(tilt);
        dot(cx, cy, radius * 0.34, rgb, 0.07);
        dot(cx, cy, radius * 0.19, rgb, 0.16);
        dot(cx, cy, Math.max(2.5, radius * 0.07), rgb, 1);
        for (const star of stars) {
          const px = Math.cos(star.a + rot) * star.t * radius;
          const py = Math.sin(star.a + rot) * star.t * radius * 0.45;
          const twinkle = 0.5 + 0.5 * Math.sin(now * 0.002 + star.p);
          dot(cx + px * cos - py * sin, cy + px * sin + py * cos, star.z * (0.55 + (1 - star.t) * 0.6), star.white ? RGB.ink : rgb, 0.45 + 0.5 * twinkle);
        }
      }

      c.lineWidth = 1;
      c.setLineDash([4, 5]);
      for (const area of voids) {
        c.beginPath();
        c.arc(area.x * width, area.y * height, area.r * size, 0, 6.2832);
        c.strokeStyle = `rgba(${RGB.ink},.5)`;
        c.stroke();
      }
      c.setLineDash([]);

      c.font = `500 12px ${font}`;
      c.textAlign = "center";
      c.textBaseline = "top";
      const clampX = (x: number, text: string) => {
        const half = c.measureText(text).width / 2 + 4;
        return Math.max(half, Math.min(width - half, x));
      };
      for (const { galaxy } of systems) {
        c.fillStyle = `rgba(${galaxy.tone === "grow" ? RGB.grow : RGB.ink},.9)`;
        c.fillText(galaxy.name, clampX(galaxy.x * width, galaxy.name), galaxy.y * height + galaxy.r * size * 0.5 + 8);
      }
      c.fillStyle = `rgba(${RGB.ink},.75)`;
      for (const area of voids) {
        c.fillText(area.name, clampX(area.x * width, area.name), area.y * height + area.r * size + 4);
      }

      if (mine) {
        const x = mine.x * width;
        const y = mine.y * height;
        const pulse = still ? 0 : 2 * Math.sin(now * 0.003);
        dot(x, y, 12 + pulse, RGB.mine, 0.16);
        c.strokeStyle = `rgba(${RGB.mine},.9)`;
        c.beginPath();
        c.moveTo(x - 10, y);
        c.lineTo(x + 10, y);
        c.moveTo(x, y - 10);
        c.lineTo(x, y + 10);
        c.stroke();
        dot(x, y, 4.5, RGB.mine, 1);
        c.fillStyle = `rgba(${RGB.mine},1)`;
        c.textBaseline = "bottom";
        c.fillText("내 질문", clampX(x, "내 질문"), y - 13);
      }
    }

    function resize() {
      const box = canvas!.getBoundingClientRect();
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(box.width));
      height = Math.max(1, Math.round(box.height));
      canvas!.width = width * ratio;
      canvas!.height = height * ratio;
      size = Math.min(width, height);
      if (still) draw(0);
    }

    function loop(now: number) {
      draw(now);
      frame = requestAnimationFrame(loop);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (!still) frame = requestAnimationFrame(loop);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [galaxies, voids, mine]);

  return (
    <div className="sky">
      <canvas ref={ref} role="img" aria-label={label} />
      <ul className="legend">
        <li><i className="d sat" />포화된 은하</li>
        <li><i className="d grow" />뻗는 중인 은하</li>
        <li><i className="d void" />빈 공간</li>
        {mine && <li><i className="d mine" />내 질문</li>}
      </ul>
    </div>
  );
}
