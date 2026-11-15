import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import type { IconName } from "@/lib/mock";
import { Cosmos, type Hub } from "./cosmos";

// A scene is the cosmos canvas with HTML cards pinned to its hubs. The
// canvas and the cards read the same coordinates: the canvas in script, the
// cards through CSS variables, switching between the portrait and landscape
// positions at the same point (a square).

type Band = [number, number];

export function Scene({
  hubs,
  links,
  bandTall = [0, 1],
  bandWide = [0, 1],
  fill = false,
  label,
  children,
}: {
  hubs: Hub[];
  links: [number, number][];
  bandTall?: Band;
  bandWide?: Band;
  // Cover the parent instead of drawing a framed panel.
  fill?: boolean;
  label: string;
  children: ReactNode;
}) {
  const style = {
    "--b0": bandTall[0],
    "--bs": bandTall[1] - bandTall[0],
    "--wb0": bandWide[0],
    "--wbs": bandWide[1] - bandWide[0],
  } as CSSProperties;
  return (
    <div className={fill ? "scene scene-fill" : "scene scene-frame"} style={style}>
      <Cosmos hubs={hubs} links={links} bandTall={bandTall} bandWide={bandWide} label={label} />
      {children}
    </div>
  );
}

export function SceneCard({
  hub,
  href,
  icon,
  title,
  lead,
  detail,
  tone,
  main = false,
}: {
  hub: Hub;
  href?: string;
  icon?: IconName;
  title: string;
  // Short figure shown in the accent color, e.g. "▲ 32%".
  lead?: string;
  detail?: string;
  // Class that colors the border: a cluster state, or "void".
  tone?: string;
  main?: boolean;
}) {
  const style = {
    "--tx": hub.tall[0],
    "--ty": hub.tall[1],
    "--wx": hub.wide[0],
    "--wy": hub.wide[1],
    "--tint": hub.color,
  } as CSSProperties;
  const className = ["scene-card", tone, main ? "main" : ""].filter(Boolean).join(" ");
  const body = (
    <>
      {icon && (
        <span className="scene-icon">
          <Icon name={icon} />
        </span>
      )}
      <span className="scene-text">
        <strong>{title}</strong>
        {(lead || detail) && (
          <span>
            {lead && <b>{lead}</b>}
            {lead && detail ? " · " : ""}
            {detail}
          </span>
        )}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className={className} style={style}>
      {body}
    </Link>
  ) : (
    <div className={className} style={style}>
      {body}
    </div>
  );
}

const ICONS: Record<IconName, string> = {
  spark: "M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z",
  cross: "M12 5v14M5 12h14",
  leaf: "M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7",
  car: "M4 15l1.5-5h13L20 15v3H4zM4 15h16M7 18v1.5M17 18v1.5",
  cap: "M3 9l9-4 9 4-9 4zM7 11v4c3 2 7 2 10 0v-4",
  bars: "M5 19v-8M12 19V5M19 19v-6",
  bag: "M6 8h12l-1 12H7zM9 8a3 3 0 016 0",
  play: "M8 5l11 7-11 7z",
  sprout: "M12 20v-8M12 12c0-4-3-6-7-6 0 4 3 6 7 6M12 12c0-3 2-5 6-5 0 3-2 5-6 5",
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}
