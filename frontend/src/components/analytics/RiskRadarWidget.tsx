import React, { useState } from 'react';
import { Badge } from '../ui/Badge';

export interface PillarScore {
  id: string;
  name: string;
  score: number; // 0 - 100
  grade?: string;
  risk_level?: string;
  category?: string;
}

interface RiskRadarWidgetProps {
  primarySeries: {
    label: string;
    pillars: PillarScore[];
  };
  comparisonSeries?: {
    label: string;
    pillars: PillarScore[];
  };
  size?: number;
  className?: string;
  showLegend?: boolean;
}

export const RiskRadarWidget: React.FC<RiskRadarWidgetProps> = ({
  primarySeries,
  comparisonSeries,
  size = 360,
  className = '',
  showLegend = true,
}) => {
  const [activeVertex, setActiveVertex] = useState<{
    pillar: PillarScore;
    seriesLabel: string;
    x: number;
    y: number;
  } | null>(null);

  const pillars = primarySeries.pillars;
  const numAxes = pillars.length;
  if (numAxes < 3) return null;

  const center = size / 2;
  const radius = (size / 2) - 52; // margin for labels

  // Angle step for equidistant axes
  const angleStep = (Math.PI * 2) / numAxes;
  // Rotate so first vertex points straight up (- PI / 2)
  const getCoordinates = (value: number, index: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Concentric polygon grid levels: 25, 50, 75, 100
  const levels = [25, 50, 75, 100];

  const getPolygonPoints = (seriesPillars: PillarScore[]) => {
    return seriesPillars
      .map((p, idx) => {
        const { x, y } = getCoordinates(Math.max(10, Math.min(100, p.score)), idx);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const primaryPoints = getPolygonPoints(primarySeries.pillars);
  const comparisonPoints = comparisonSeries ? getPolygonPoints(comparisonSeries.pillars) : null;

  // Short labels for outer rim
  const getShortName = (name: string) => {
    if (name.includes('Privacy')) return 'Privacy & Retention';
    if (name.includes('Termination') || name.includes('Lock-In')) return 'Auto-Renewal';
    if (name.includes('Liability')) return 'Liability Cap';
    if (name.includes('IP') || name.includes('Indemnity')) return 'IP Defense';
    if (name.includes('SLA')) return 'SLA & Uptime';
    if (name.includes('Regulatory') || name.includes('Governance')) return 'AI Governance';
    return name;
  };

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        role="img"
        aria-label="6-Pillar Risk Radar Visualization"
      >
        {/* Concentric Grid Rings */}
        {levels.map((lvl) => {
          const points = pillars
            .map((_, idx) => {
              const { x, y } = getCoordinates(lvl, idx);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');

          return (
            <g key={lvl}>
              <polygon
                points={points}
                fill={lvl === 100 ? '#F8FAFC' : 'none'}
                stroke="#E2E8F0"
                strokeWidth={lvl === 100 ? '1.5' : '1'}
                strokeDasharray={lvl === 100 ? 'none' : '3 3'}
              />
              {/* Level percentage label on the top axis */}
              <text
                x={center}
                y={center - (lvl / 100) * radius - 3}
                textAnchor="middle"
                className="text-[9px] font-mono fill-slate-400 select-none"
              >
                {lvl}
              </text>
            </g>
          );
        })}

        {/* Radial Axis Spokes */}
        {pillars.map((p, idx) => {
          const edge = getCoordinates(100, idx);
          // Label coordinate slightly outside the rim
          const labelAngle = idx * angleStep - Math.PI / 2;
          const labelR = radius + 22;
          const lx = center + labelR * Math.cos(labelAngle);
          const ly = center + labelR * Math.sin(labelAngle);

          // Horizontal alignment based on cos(angle)
          let textAnchor: 'middle' | 'start' | 'end' = 'middle';
          if (Math.cos(labelAngle) > 0.3) textAnchor = 'start';
          else if (Math.cos(labelAngle) < -0.3) textAnchor = 'end';

          return (
            <g key={p.id}>
              <line
                x1={center}
                y1={center}
                x2={edge.x}
                y2={edge.y}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
              <text
                x={lx}
                y={ly}
                textAnchor={textAnchor}
                dominantBaseline="central"
                className="text-[10.5px] font-semibold fill-slate-700 tracking-tight"
              >
                {getShortName(p.name)}
              </text>
            </g>
          );
        })}

        {/* Comparison Series Polygon (if provided) */}
        {comparisonPoints && (
          <polygon
            points={comparisonPoints}
            fill="#D97706"
            fillOpacity="0.12"
            stroke="#D97706"
            strokeWidth="2"
            strokeDasharray="4 3"
            className="transition-all duration-300"
          />
        )}

        {/* Primary Series Polygon */}
        <polygon
          points={primaryPoints}
          fill="#1E293B"
          fillOpacity="0.14"
          stroke="#0F172A"
          strokeWidth="2"
          className="transition-all duration-300"
        />

        {/* Comparison Series Vertices */}
        {comparisonSeries &&
          comparisonSeries.pillars.map((p, idx) => {
            const { x, y } = getCoordinates(Math.max(10, Math.min(100, p.score)), idx);
            return (
              <circle
                key={`comp-${p.id}`}
                cx={x}
                cy={y}
                r="4"
                fill="#D97706"
                stroke="#FFFFFF"
                strokeWidth="1.5"
                className="cursor-pointer hover:r-6 transition-all"
                onMouseEnter={() =>
                  setActiveVertex({
                    pillar: p,
                    seriesLabel: comparisonSeries.label,
                    x,
                    y,
                  })
                }
                onMouseLeave={() => setActiveVertex(null)}
              />
            );
          })}

        {/* Primary Series Vertices */}
        {pillars.map((p, idx) => {
          const { x, y } = getCoordinates(Math.max(10, Math.min(100, p.score)), idx);
          return (
            <circle
              key={`pri-${p.id}`}
              cx={x}
              cy={y}
              r="4.5"
              fill="#0F172A"
              stroke="#FFFFFF"
              strokeWidth="2"
              className="cursor-pointer hover:r-6 transition-all"
              onMouseEnter={() =>
                setActiveVertex({
                  pillar: p,
                  seriesLabel: primarySeries.label,
                  x,
                  y,
                })
              }
              onMouseLeave={() => setActiveVertex(null)}
            />
          );
        })}
      </svg>

      {/* Interactive Tooltip Card */}
      {activeVertex && (
        <div
          className="absolute z-20 pointer-events-none p-2.5 rounded-md bg-white border border-slate-200 shadow-md text-xs space-y-1 animate-in fade-in transition-all"
          style={{
            left: `${Math.min(size - 130, Math.max(10, activeVertex.x - 65))}px`,
            top: `${Math.min(size - 60, Math.max(10, activeVertex.y - 60))}px`,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-900 truncate max-w-[120px]">
              {activeVertex.pillar.name}
            </span>
            <span className="font-mono text-slate-900 font-bold">
              {activeVertex.pillar.score}/100
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span>{activeVertex.seriesLabel}</span>
            {activeVertex.pillar.risk_level && (
              <>
                <span>•</span>
                <span className="font-medium text-slate-700">
                  {activeVertex.pillar.risk_level}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center justify-center gap-4 text-xs font-medium text-slate-600 mt-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-slate-900 border border-slate-900 inline-block" />
            <span className="truncate max-w-[160px] text-[11px] font-semibold text-slate-800">
              {primarySeries.label}
            </span>
          </div>
          {comparisonSeries && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-amber-500 border border-amber-600 inline-block border-dashed" />
              <span className="truncate max-w-[160px] text-[11px] font-semibold text-amber-800">
                {comparisonSeries.label}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
