"use client";

import { useState, useEffect } from "react";

const PALETTE = [
  "#DC2626", "#FACC15", "#3B82F6", "#10B981",
  "#A855F7", "#F97316", "#06B6D4", "#84CC16",
];

type Slice = { label: string; count: number };

// Enforce a minimum visual angle so tiny slices are still visible
const MIN_ANGLE = 0.12; // ~7 degrees

export function PieChart({
  title,
  data,
  maxSlices = 4,
}: {
  title: string;
  data: Slice[];
  maxSlices?: number;
}) {
  const [hovered, setHovered] = useState<number>(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (data.length === 0) return null;

  if (!mounted) {
    return (
      <div className="flex flex-col items-center gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
        <div style={{ width: 180, height: 180 }} />
      </div>
    );
  }

  const top = data.slice(0, maxSlices);
  const rest = data.slice(maxSlices);
  const otherCount = rest.reduce((sum, s) => sum + s.count, 0);
  const slices =
    otherCount > 0
      ? [...top, { label: "Other", count: otherCount }]
      : top;

  const total = slices.reduce((sum, s) => sum + s.count, 0);

  // Compute angles with minimum enforcement
  let rawAngles = slices.map((s) => (s.count / total) * 2 * Math.PI);
  // Clamp small angles up to MIN_ANGLE
  const clamped = rawAngles.map((a) => Math.max(a, MIN_ANGLE));
  const clampedSum = clamped.reduce((a, b) => a + b, 0);
  // Normalize so they sum to 2π
  const angles = clamped.map((a) => (a / clampedSum) * 2 * Math.PI);

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 65;
  const innerR = 32; // donut hole
  const hoverOuterR = 71;
  const cornerR = 4; // round corners

  let cumAngle = -Math.PI / 2;

  // Build donut arc paths with rounded corners
  const paths = slices.map((s, i) => {
    const angle = angles[i];
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;

    const isHovered = hovered === i;
    const oR = isHovered ? hoverOuterR : outerR;
    const iR = innerR;
    const color = PALETTE[i % PALETTE.length];

    if (slices.length === 1) {
      return (
        <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(0)} style={{ cursor: "pointer" }}>
          <circle cx={cx} cy={cy} r={oR} fill={color} style={{ transition: "all 0.15s ease-out" }} />
          <circle cx={cx} cy={cy} r={iR} fill="var(--background)" />
        </g>
      );
    }

    // Outer arc endpoints
    const ox1 = cx + oR * Math.cos(startAngle);
    const oy1 = cy + oR * Math.sin(startAngle);
    const ox2 = cx + oR * Math.cos(endAngle);
    const oy2 = cy + oR * Math.sin(endAngle);

    // Inner arc endpoints (reversed)
    const ix1 = cx + iR * Math.cos(endAngle);
    const iy1 = cy + iR * Math.sin(endAngle);
    const ix2 = cx + iR * Math.cos(startAngle);
    const iy2 = cy + iR * Math.sin(startAngle);

    const largeArc = angle > Math.PI ? 1 : 0;

    const d = [
      `M ${ox1} ${oy1}`,
      `A ${oR} ${oR} 0 ${largeArc} 1 ${ox2} ${oy2}`,
      `L ${ix1} ${iy1}`,
      `A ${iR} ${iR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      `Z`,
    ].join(" ");

    // Nudge hovered segment outward slightly
    const midAngle = (startAngle + endAngle) / 2;
    const nudge = isHovered ? 3 : 0;
    const tx = nudge * Math.cos(midAngle);
    const ty = nudge * Math.sin(midAngle);

    return (
      <path
        key={i}
        d={d}
        fill={color}
        stroke="var(--background)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{
          transition: "transform 0.15s ease-out",
          transform: `translate(${tx}px, ${ty}px)`,
          cursor: "pointer",
        }}
        onMouseEnter={() => setHovered(i)}
        onMouseLeave={() => setHovered(0)}
      />
    );
  });

  // Tooltip — always visible, defaults to largest slice
  const hoveredSlice = slices[hovered];
  const hoveredPct = Math.round((hoveredSlice.count / total) * 100);
  let tooltipAngle = -Math.PI / 2;
  for (let j = 0; j < hovered; j++) tooltipAngle += angles[j];
  const tooltipMid = tooltipAngle + angles[hovered] / 2;
  const tooltipR = hoverOuterR + 16;
  const ttx = cx + tooltipR * Math.cos(tooltipMid);
  const tty = cy + tooltipR * Math.sin(tooltipMid);
  const anchor =
    Math.abs(Math.cos(tooltipMid)) < 0.3
      ? "middle"
      : Math.cos(tooltipMid) > 0
        ? "start"
        : "end";

  const tooltip = (
    <g style={{ pointerEvents: "none" }}>
      <text
        x={ttx}
        y={tty - 5}
        textAnchor={anchor}
        className="fill-foreground"
        style={{ fontSize: "10px", fontWeight: 600 }}
      >
        {hoveredSlice.label}
      </text>
      <text
        x={ttx}
        y={tty + 7}
        textAnchor={anchor}
        className="fill-muted-foreground"
        style={{ fontSize: "9px" }}
      >
        {hoveredSlice.count.toLocaleString()} ({hoveredPct}%)
      </text>
    </g>
  );

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="overflow-visible"
      >
        {paths}
        {tooltip}
      </svg>
    </div>
  );
}
