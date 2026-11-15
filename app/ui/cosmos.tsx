"use client";

import { useEffect, useRef } from "react";

// Backdrop for a scene: one glowing galaxy per hub, each in its own color,
// joined by light trails, over a dense field of stars. The cards that name
// the hubs are ordinary HTML laid over this canvas by the Scene component,
// which positions them with the same coordinates.

export type Hub = {
  // Position as fractions of the scene band, for portrait and landscape.
  tall: [number, number];
  wide: [number, number];
  size: number;
  // "r,g,b"
  color: string;
};

const INK = "232,236,255";
const CLOUDS = ["120,90,255", "70,120,255", "220,110,255", "90,200,255", "140,90,230", "255,150,110"];
const STAR_TINTS = [INK, INK, INK, "170,200,255", "255,214,170", "214,190,255"];
const MAX_STARS = 1400;
const FLATTEN = 0.4;

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

export function Cosmos({
  hubs,
  links,
  bandTall,
  bandWide,
  label,
}: {
  hubs: Hub[];
  links: [number, number][];
  bandTall: [number, number];
  bandWide: [number, number];
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tallTop, tallBottom] = bandTall;
  const [wideTop, wideBottom] = bandWide;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const random = rng(20261115);

    const systems = hubs.map((hub, index) => ({
      hub,
      dir: index % 2 ? -1 : 1,
      stars: Array.from({ length: Math.round(70 + hub.size * 110) }, (_, i) => {
        const t = Math.pow(random(), 0.65);
        return {
          t,
          a: (i % 2) * Math.PI + t * 5 + (random() - 0.5) * 0.8,
          z: 0.5 + random() * 1.2,
          p: random() * 6.28,
          white: random() < 0.4,
        };
      }),
    }));
    const backdrop = Array.from({ length: MAX_STARS }, () => {
      const depth = random();
      return {
        x: random(),
        y: random(),
        z: 0.3 + depth * depth * 1.3,
        p: random() * 6.28,
        speed: 0.6 + random() * 1.8,
        tint: STAR_TINTS[Math.floor(random() * STAR_TINTS.length)],
        bright: depth > 0.975,
      };
    });
    const clouds = CLOUDS.map((tint) => ({
      x: random(),
      y: random(),
      r: 0.3 + random() * 0.3,
      tint,
    }));
    // Small outposts hanging off the nearest hub: ideas that sit between
    // the named fields.
    const outposts = Array.from({ length: 46 }, () => ({
      x: random(),
      y: random(),
      p: random() * 6.28,
      hub: -1,
    }));

    let width = 0;
    let height = 0;
    let size = 0;
    let ratio = 1;
    let frame = 0;
    let starCount = 0;
    let centers: { x: number; y: number; r: number }[] = [];

    function layout() {
      const wide = width >= height;
      const [top, bottom] = wide ? [wideTop, wideBottom] : [tallTop, tallBottom];
      centers = hubs.map((hub) => {
        const [x, y] = wide ? hub.wide : hub.tall;
        return {
          x: x * width,
          y: (top + y * (bottom - top)) * height,
          r: hub.size * size * 0.09,
        };
      });
      for (const outpost of outposts) {
        let best = 0;
        let bestDistance = Infinity;
        centers.forEach((center, i) => {
          const d = Math.hypot(center.x - outpost.x * width, center.y - outpost.y * height);
          if (d < bestDistance) {
            bestDistance = d;
            best = i;
          }
        });
        outpost.hub = best;
      }
    }

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
        glow(cloud.x * width, cloud.y * height, cloud.r * Math.max(width, height), cloud.tint, 0.075);
      }

      for (let i = 0; i < starCount; i++) {
        const star = backdrop[i];
        const x = star.x * width;
        const y = star.y * height;
        const twinkle = still ? 0.7 : 0.5 + 0.5 * Math.sin(now * 0.001 * star.speed + star.p);
        if (star.bright) {
          const reach = 4 + 4 * twinkle;
          glow(x, y, reach * 1.6, star.tint, 0.35);
          c.strokeStyle = `rgba(${star.tint},${0.3 + 0.4 * twinkle})`;
          c.lineWidth = 0.8;
          c.beginPath();
          c.moveTo(x - reach, y);
          c.lineTo(x + reach, y);
          c.moveTo(x, y - reach);
          c.lineTo(x, y + reach);
          c.stroke();
          dot(x, y, 1.2, INK, 1);
        } else {
          dot(x, y, star.z, star.tint, 0.25 + 0.6 * twinkle);
        }
      }

      // Trails between hubs, with a light travelling along each.
      c.lineWidth = 1;
      links.forEach(([from, to], index) => {
        const a = centers[from];
        const b = centers[to];
        if (!a || !b) return;
        const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.1;
        const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.1;
        const trail = c.createLinearGradient(a.x, a.y, b.x, b.y);
        trail.addColorStop(0, `rgba(${hubs[from].color},0.38)`);
        trail.addColorStop(1, `rgba(${hubs[to].color},0.38)`);
        c.strokeStyle = trail;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.quadraticCurveTo(mx, my, b.x, b.y);
        c.stroke();
        const k = still ? 0.5 : (now * 0.00012 + index * 0.37) % 1;
        const u = 1 - k;
        const px = u * u * a.x + 2 * u * k * mx + k * k * b.x;
        const py = u * u * a.y + 2 * u * k * my + k * k * b.y;
        glow(px, py, 7, INK, 0.7);
        dot(px, py, 1.4, INK, 1);
      });

      for (const outpost of outposts) {
        const center = centers[outpost.hub];
        if (!center) continue;
        const rgb = hubs[outpost.hub].color;
        const x = outpost.x * width;
        const y = outpost.y * height;
        c.strokeStyle = `rgba(${rgb},0.16)`;
        c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(center.x, center.y);
        c.stroke();
        c.strokeStyle = `rgba(${rgb},0.6)`;
        c.beginPath();
        c.ellipse(x, y, 6, 6 * FLATTEN, 0, 0, 6.2832);
        c.stroke();
        glow(x, y, 8, rgb, 0.5);
        dot(x, y, 1.3, INK, 0.95);
      }

      systems.forEach(({ hub, dir, stars }, index) => {
        const center = centers[index];
        const rgb = hub.color;
        const rot = still ? 0 : now * 0.00006 * dir;
        glow(center.x, center.y, center.r * 2.4, rgb, 0.2);
        glow(center.x, center.y, center.r * 0.9, rgb, 0.5);
        c.lineWidth = 0.8;
        for (const reach of [0.75, 1.15, 1.6]) {
          c.strokeStyle = `rgba(${rgb},${0.34 - reach * 0.12})`;
          c.beginPath();
          c.ellipse(center.x, center.y, center.r * reach, center.r * reach * FLATTEN, 0, 0, 6.2832);
          c.stroke();
        }
        for (const star of stars) {
          const twinkle = still ? 0.7 : 0.5 + 0.5 * Math.sin(now * 0.002 + star.p);
          dot(
            center.x + Math.cos(star.a + rot) * star.t * center.r * 1.5,
            center.y + Math.sin(star.a + rot) * star.t * center.r * 1.5 * FLATTEN,
            star.z * (0.5 + (1 - star.t) * 0.7),
            star.white ? INK : rgb,
            0.4 + 0.55 * twinkle,
          );
        }
        glow(center.x, center.y, Math.max(7, center.r * 0.3), INK, 0.95);
      });
    }

    function resize() {
      const box = canvas!.getBoundingClientRect();
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(box.width));
      height = Math.max(1, Math.round(box.height));
      canvas!.width = width * ratio;
      canvas!.height = height * ratio;
      size = Math.min(width, height);
      starCount = Math.min(MAX_STARS, Math.max(320, Math.round((width * height) / 520)));
      layout();
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
  }, [hubs, links, tallTop, tallBottom, wideTop, wideBottom]);

  return <canvas ref={ref} role="img" aria-label={label} />;
}
