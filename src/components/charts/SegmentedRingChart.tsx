"use client";

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

/**
 * Generic, calculator-agnostic multi-segment ring (donut) chart with an
 * optional center label. Lives alongside the shared report engine
 * (src/lib/reports/) as a reusable visual building block \u2014 takes a plain
 * array of named/colored segments, so any current or future calculator can
 * use it for whatever breakdown it has (calorie sources, macro splits,
 * category composition, etc.) without a bespoke chart per use case.
 *
 * Intended as a single "hero" visual for one headline figure \u2014 not meant
 * to be repeated many times on one page (for a repeated per-item chart,
 * consider a lighter-weight visual instead, e.g. an inline bar).
 */

export interface RingChartSegment {
  label: string;
  value: number;
  pct: number;
  color: string;
}

export interface SegmentedRingChartProps {
  segments: RingChartSegment[];
  /** Width/height in px \u2014 the chart is always square. Default 160. */
  size?: number;
  /** Large text drawn in the ring's hollow center (e.g. the total). */
  centerLabel?: string;
  /** Small text drawn below centerLabel (e.g. a unit like "CAL/DAY"). */
  centerSubLabel?: string;
  ariaLabel?: string;
}

interface TooltipPayloadEntry {
  payload: RingChartSegment;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  /** Pixel position (in the chart's own coordinate space, 0 to chartSize)
   * that recharts wants to anchor the tooltip to. Used to decide which
   * side the tooltip should open on — see nearRightEdge below. */
  coordinate?: { x: number; y: number };
  /** The chart's width/height in px (the `size` prop, plumbed through from
   * the parent) — needed to know where the "right edge" actually is. */
  chartSize?: number;
}

// A fully custom tooltip — recharts' default tooltip colors each line's
// text using that segment's OWN fill color, which reads fine for bold
// colors but goes nearly invisible for a light segment (e.g. a light gray
// "TEF" slice) against the default near-white tooltip background. Owning
// every color explicitly here fixes that regardless of segment color, and
// uses a colored dot (not colored text) for the segment indicator instead
// — the more common, more legible convention.
//
// It also picks its own open direction (rightward vs leftward) based on
// `coordinate` — see nearRightEdge below — instead of always opening
// rightward like recharts' default, which is what let it spill past the
// card's right edge for segments on the right half of the ring (with
// allowEscapeViewBox on, nothing else keeps it inside the card).
const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, coordinate, chartSize }) => {
  if (!active || !payload || payload.length === 0) return null;
  const segment = payload[0].payload;
  const nearRightEdge = !!coordinate && !!chartSize && coordinate.x > chartSize / 2;

  return (
    <div
      style={{ transform: nearRightEdge ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)' }}
      className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3.5 py-2.5 shadow-lg"
    >
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: segment.color }} />
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {segment.label}
        </span>
      </div>
      <p className="mt-1 text-sm font-extrabold text-neutral-900 dark:text-white whitespace-nowrap">
        {Math.round(segment.value).toLocaleString()} kcal
        <span className="ml-1 font-semibold text-neutral-400 dark:text-neutral-500">({segment.pct}%)</span>
      </p>
    </div>
  );
};

const SegmentedRingChart: React.FC<SegmentedRingChartProps> = ({
  segments,
  size = 160,
  centerLabel,
  centerSubLabel,
  ariaLabel = 'Breakdown chart',
}) => {
  // The Pie below always uses innerRadius="70%", so the hollow center is a
  // circle ~70% of `size` in diameter. The text block is explicitly sized
  // to sit inside that circle (with a small safety margin) rather than
  // spanning the full chart box — spanning the full box let long text
  // overlap the colored ring itself once numbers got wide (e.g. 5-digit
  // totals), since nothing constrained how far it could stretch.
  const centerBoxSize = Math.round(size * 0.6);

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      style={{ width: size, height: size }}
      className="relative flex-shrink-0"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={segments}
            dataKey="value"
            nameKey="label"
            innerRadius="70%"
            outerRadius="100%"
            paddingAngle={3}
            stroke="none"
          >
            {segments.map((entry) => (
              <Cell key={entry.label} fill={entry.color} />
            ))}
          </Pie>
          {/* allowEscapeViewBox: by default recharts clamps the tooltip to
              stay within its own plotting area \u2014 fine for a large chart,
              but this ring is only `size`px (e.g. 160px) square, so the
              default behavior squeezes/repositions the tooltip awkwardly
              instead of letting it float fully visible next to the
              cursor. Letting it escape the tiny viewBox on both axes is
              what actually fixes that, independent of any ancestor's
              overflow-hidden. */}
          <Tooltip
            content={<CustomTooltip chartSize={size} />}
            wrapperStyle={{ outline: 'none', zIndex: 50 }}
            allowEscapeViewBox={{ x: true, y: true }}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerSubLabel) && (
        <div
          style={{ width: centerBoxSize, height: centerBoxSize }}
          className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center overflow-hidden text-center"
        >
          {centerLabel && (
            <span
              style={{ fontSize: Math.max(11, Math.round(size * 0.13)) }}
              className="w-full truncate font-black leading-tight text-neutral-900 dark:text-white"
            >
              {centerLabel}
            </span>
          )}
          {centerSubLabel && (
            <span
              style={{ fontSize: Math.max(8, Math.round(size * 0.06)) }}
              className="mt-0.5 w-full truncate font-bold uppercase tracking-wider text-neutral-400"
            >
              {centerSubLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default SegmentedRingChart;
