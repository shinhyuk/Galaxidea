"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

// Canvas map of the idea universe: one galaxy per cluster, dashed rings for
// empty areas, and the asker's own star. The layout of galaxies follows
// docs/demo.html; the sky around them is drawn denser and brighter.

export type MapGalaxy = {
  id: string;
  name: string;
  x: number;
  y: number;
  r: number;
  tone: "sat" | "grow" | "dim";
};

export type MapVoid = { id: string; name: string; x: number; y: number; r: number };

const RGB = {
  sat: "255,217,138",
  grow: "127,224,196",
  dim: "120,134,196",
  mine: "201,184,255",
  ink: "232,236,255",
  blue: "150,180,255",
};
const STAR_TINTS = [RGB.ink, RGB.ink, RGB.ink, RGB.blue, RGB.sat, RGB.mine, RGB.grow];
const MAX_STARS = 1100;

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
  hero = false,
  band = [0, 1],
}: {
  galaxies: MapGalaxy[];
  voids: MapVoid[];
  mine?: { x: number; y: number };
  label: string;
  // Fill the parent instead of drawing a framed square, and make each
  // galaxy a link to its area page.
  hero?: boolean;
  // Vertical slice of the canvas the galaxies are placed in, so page text
  // laid over the top and bottom stays clear of them.
  band?: [number, number];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [bandTop, bandBottom] = band;
  const mapY = (y: number) => bandTop + y * (bandBottom - bandTop);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const random = rng(20261115);
    const place = (y: number) => bandTop + y * (bandBottom - bandTop);

    const systems = galaxies.map((galaxy, index) => {
      const tilt = (random() - 0.5) * 1.6;
      const stars = Array.from({ length: Math.round(40 + galaxy.r * 900) }, (_, i) => {
        const t = Math.pow(random(), 0.7);
        return {
          t,
          a: (i % 2) * Math.PI + t * 4.2 + (random() - 0.5) * 0.9,
          z: 0.5 + random() * 1.4,
          p: random() * 6.28,
          white: random() < 0.35,
        };
      });
      return { galaxy, y: place(galaxy.y), tilt, dir: index % 2 ? -1 : 1, stars };
    });
    const areas = voids.map((area) => ({ area, y: place(area.y) }));
    const backdrop = Array.from({ length: MAX_STARS }, () => {
      const depth = random();
      return {
        x: random(),
        y: random(),
        z: 0.3 + depth * depth * 1.5,
        p: random() * 6.28,
        speed: 0.6 + random() * 1.8,
        tint: STAR_TINTS[Math.floor(random() * STAR_TINTS.length)],
        bright: depth > 0.93,
      };
    });
    // Faint clouds that give the sky some depth between galaxies.
    const clouds = Array.from({ length: 5 }, (_, i) => ({
      x: random(),
      y: random(),
      r: 0.35 + random() * 0.3,
      tint: [RGB.mine, RGB.blue, RGB.grow, RGB.sat, RGB.blue][i],
    }));

    let width = 0;
    let height = 0;
    let size = 0;
    let ratio = 1;
    let frame = 0;
    let starCount = 0;
    let meteor = { start: 3000, x: 0.2, y: 0.1, angle: 0.5 };
    const font = getComputedStyle(document.body).fontFamily;

    function dot(x: number, y: number, r: number, rgb: string, alpha: number) {
      ctx!.beginPath();
      ctx!.arc(x, y, r, 0, 6.2832);
      ctx!.fillStyle = `rgba(${rgb},${alpha})`;
      ctx!.fill();
    }

    function glow(x: number, y: number, r: number, rgb: string, alpha: number) {
      const gradient = ctx!.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
      gradient.addColorStop(1, `rgba(${rgb},0)`);
      ctx!.fillStyle = gradient;
      ctx!.fillRect(x - r, y - r, r * 2, r * 2);
    }

    function draw(now: number) {
      const c = ctx!;
      c.setTransform(ratio, 0, 0, ratio, 0, 0);
      c.clearRect(0, 0, width, height);
      c.globalCompositeOperation = "lighter";

      for (const cloud of clouds) {
        glow(cloud.x * width, cloud.y * height, cloud.r * Math.max(width, height), cloud.tint, 0.06);
      }

      for (let i = 0; i < starCount; i++) {
        const star = backdrop[i];
        const x = star.x * width;
        const y = star.y * height;
        const twinkle = 0.5 + 0.5 * Math.sin(now * 0.001 * star.speed + star.p);
        if (star.bright) {
          const reach = 5 + 5 * twinkle;
          glow(x, y, reach * 1.6, star.tint, 0.35);
          c.strokeStyle = `rgba(${star.tint},${0.35 + 0.4 * twinkle})`;
          c.lineWidth = 0.8;
          c.beginPath();
          c.moveTo(x - reach, y);
          c.lineTo(x + reach, y);
          c.moveTo(x, y - reach);
          c.lineTo(x, y + reach);
          c.stroke();
          dot(x, y, 1.5, RGB.ink, 1);
        } else {
          dot(x, y, star.z, star.tint, 0.2 + 0.6 * twinkle);
        }
      }

      for (const { galaxy, y, tilt, dir, stars } of systems) {
        const rgb = RGB[galaxy.tone];
        const cx = galaxy.x * width;
        const cy = y * height;
        const radius = galaxy.r * size;
        const rot = now * 0.00005 * dir;
        const cos = Math.cos(tilt);
        const sin = Math.sin(tilt);
        glow(cx, cy, radius * 1.7, rgb, 0.16);
        glow(cx, cy, radius * 0.6, rgb, 0.4);
        glow(cx, cy, Math.max(6, radius * 0.2), RGB.ink, 0.9);
        for (const star of stars) {
          const px = Math.cos(star.a + rot) * star.t * radius;
          const py = Math.sin(star.a + rot) * star.t * radius * 0.45;
          const twinkle = 0.5 + 0.5 * Math.sin(now * 0.002 + star.p);
          dot(cx + px * cos - py * sin, cy + px * sin + py * cos, star.z * (0.55 + (1 - star.t) * 0.6), star.white ? RGB.ink : rgb, 0.4 + 0.5 * twinkle);
        }
      }

      if (!still) {
        const age = now - meteor.start;
        if (age > 900) {
          meteor = { start: now + 2500 + random() * 5000, x: 0.1 + random() * 0.7, y: random() * 0.5, angle: 0.3 + random() * 0.5 };
        } else if (age > 0) {
          const k = age / 900;
          const length = 0.16 * size;
          const hx = meteor.x * width + Math.cos(meteor.angle) * k * size * 0.45;
          const hy = meteor.y * height + Math.sin(meteor.angle) * k * size * 0.45;
          const trail = c.createLinearGradient(hx, hy, hx - Math.cos(meteor.angle) * length, hy - Math.sin(meteor.angle) * length);
          trail.addColorStop(0, `rgba(${RGB.ink},${0.9 * (1 - k)})`);
          trail.addColorStop(1, `rgba(${RGB.ink},0)`);
          c.strokeStyle = trail;
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(hx, hy);
          c.lineTo(hx - Math.cos(meteor.angle) * length, hy - Math.sin(meteor.angle) * length);
          c.stroke();
        }
      }

      c.globalCompositeOperation = "source-over";
      c.lineWidth = 1;
      c.setLineDash([4, 5]);
      for (const { area, y } of areas) {
        c.beginPath();
        c.arc(area.x * width, y * height, area.r * size, 0, 6.2832);
        c.strokeStyle = `rgba(${RGB.ink},.5)`;
        c.stroke();
      }
      c.setLineDash([]);

      c.font = `500 12px ${font}`;
      c.textAlign = "center";
      c.textBaseline = "top";
      c.shadowColor = "rgba(7,11,26,.9)";
      c.shadowBlur = 6;
      const clampX = (x: number, text: string) => {
        const half = c.measureText(text).width / 2 + 6;
        return Math.max(half, Math.min(width - half, x));
      };
      for (const { galaxy, y } of systems) {
        c.fillStyle = `rgba(${galaxy.tone === "grow" ? RGB.grow : RGB.ink},.95)`;
        c.fillText(galaxy.name, clampX(galaxy.x * width, galaxy.name), y * height + galaxy.r * size * 0.5 + 8);
      }
      c.fillStyle = `rgba(${RGB.ink},.8)`;
      for (const { area, y } of areas) {
        c.fillText(area.name, clampX(area.x * width, area.name), y * height + area.r * size + 4);
      }
      c.shadowBlur = 0;

      if (mine) {
        const x = mine.x * width;
        const y = place(mine.y) * height;
        const pulse = still ? 0 : 3 * Math.sin(now * 0.003);
        c.globalCompositeOperation = "lighter";
        glow(x, y, 26 + pulse, RGB.mine, 0.55);
        c.globalCompositeOperation = "source-over";
        c.strokeStyle = `rgba(${RGB.mine},.95)`;
        c.beginPath();
        c.moveTo(x - 12, y);
        c.lineTo(x + 12, y);
        c.moveTo(x, y - 12);
        c.lineTo(x, y + 12);
        c.stroke();
        dot(x, y, 4.5, RGB.ink, 1);
        c.shadowBlur = 6;
        c.fillStyle = `rgba(${RGB.mine},1)`;
        c.textBaseline = "bottom";
        c.fillText("내 질문", clampX(x, "내 질문"), y - 15);
        c.shadowBlur = 0;
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
      starCount = Math.min(MAX_STARS, Math.max(260, Math.round((width * height) / 650)));
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
  }, [galaxies, voids, mine, bandTop, bandBottom]);

  if (hero) {
    return (
      <div className="sky-fill">
        <canvas ref={ref} role="img" aria-label={label} />
        {galaxies.map((galaxy) => (
          <Link
            key={galaxy.id}
            href={`/c/${galaxy.id}`}
            className="sky-link"
            style={{ left: `${galaxy.x * 100}%`, top: `${mapY(galaxy.y) * 100}%` }}
            aria-label={`${galaxy.name} 영역 보기`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="sky">
      <canvas ref={ref} role="img" aria-label={label} />
      <SkyLegend mine={Boolean(mine)} />
    </div>
  );
}

export function SkyLegend({ mine = false }: { mine?: boolean }) {
  return (
    <ul className="legend">
      <li><i className="d sat" />포화된 은하</li>
      <li><i className="d grow" />뻗는 중인 은하</li>
      <li><i className="d void" />빈 공간</li>
      {mine && <li><i className="d mine" />내 질문</li>}
    </ul>
  );
}
