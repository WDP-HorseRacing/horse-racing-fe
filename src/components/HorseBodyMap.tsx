// Bản đồ cơ thể ngựa. Dữ liệu chỉ lưu MÃ VÙNG và BÊN, không lưu tọa độ,
// nên sau này thay bằng mô hình 3D (cơ và khung xương) thì dữ liệu đã có vẫn dùng được.
import { useState } from 'react';
import type { BodyRegion, BodySide, Severity } from '../types/domain';
import { bodyRegionLabel, severityLabel, sideLabel } from '../lib/labels';

export interface MapMark {
  id: string;
  region: BodyRegion;
  side?: BodySide;
  severity: Severity;
  resolved: boolean;
}

interface Spot {
  region: BodyRegion;
  x: number;
  y: number;
  rx: number;
  ry: number;
  limb?: boolean;
}

/** Vị trí 15 vùng trên hình chiếu cạnh. Chỉ dùng để vẽ, không lưu xuống dữ liệu. */
const SPOTS: Spot[] = [
  { region: 'HEAD', x: 54, y: 56, rx: 20, ry: 16 },
  { region: 'NECK', x: 104, y: 74, rx: 24, ry: 15 },
  { region: 'SHOULDER', x: 146, y: 106, rx: 20, ry: 18 },
  { region: 'BACK', x: 202, y: 88, rx: 32, ry: 12 },
  { region: 'HIP', x: 268, y: 100, rx: 24, ry: 18 },
  { region: 'CHEST', x: 143, y: 140, rx: 16, ry: 14 },
  { region: 'ABDOMEN', x: 205, y: 142, rx: 32, ry: 14 },
  { region: 'FORE_THIGH', x: 148, y: 172, rx: 11, ry: 15, limb: true },
  { region: 'FORE_CANNON', x: 148, y: 202, rx: 9, ry: 14, limb: true },
  { region: 'FORE_FETLOCK', x: 148, y: 224, rx: 8, ry: 8, limb: true },
  { region: 'FORE_HOOF', x: 148, y: 242, rx: 10, ry: 8, limb: true },
  { region: 'HIND_THIGH', x: 270, y: 172, rx: 12, ry: 16, limb: true },
  { region: 'HIND_CANNON', x: 272, y: 202, rx: 9, ry: 14, limb: true },
  { region: 'HIND_FETLOCK', x: 272, y: 224, rx: 8, ry: 8, limb: true },
  { region: 'HIND_HOOF', x: 272, y: 242, rx: 10, ry: 8, limb: true },
];

const severityColor: Record<Severity, string> = {
  MILD: '#d97706',
  MODERATE: '#ea580c',
  SEVERE: '#dc2626',
};

export function isLimbRegion(region: BodyRegion): boolean {
  return SPOTS.find((spot) => spot.region === region)?.limb ?? false;
}

export const BODY_REGIONS = SPOTS.map((spot) => spot.region);

export function HorseBodyMap({
  marks,
  selected,
  onSelect,
  side,
  readOnly,
}: {
  marks: MapMark[];
  selected?: BodyRegion;
  onSelect?: (region: BodyRegion) => void;
  side?: BodySide;
  readOnly?: boolean;
}) {
  const [layer, setLayer] = useState<'MUSCLE' | 'BONE'>('MUSCLE');
  const [hover, setHover] = useState<BodyRegion | null>(null);

  const markOf = (region: BodyRegion) =>
    marks.find((mark) => mark.region === region && (!mark.side || !side || mark.side === side));

  return (
    <div>
      <div className="mb-3 flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 text-xs font-semibold">
        {(['MUSCLE', 'BONE'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setLayer(value)}
            className={`flex-1 rounded-lg px-3 py-1.5 transition ${
              layer === value ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {value === 'MUSCLE' ? 'Lớp cơ' : 'Lớp xương'}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gradient-to-b from-gray-50 to-white p-2">
        <svg viewBox="0 0 340 270" className="w-full" style={{ maxHeight: 320 }}>
          {/* Thân ngựa */}
          <g
            fill={layer === 'MUSCLE' ? '#e8f0e8' : '#eef2f7'}
            stroke={layer === 'MUSCLE' ? '#b0c8b0' : '#94a3b8'}
            strokeWidth={1.5}
          >
            {/* mình */}
            <path d="M126 78 Q170 62 240 74 Q280 80 292 104 Q298 132 286 152 Q250 166 200 164 Q160 162 138 150 Q124 132 122 104 Z" />
            {/* cổ */}
            <path d="M126 78 Q112 68 92 58 Q74 50 62 44 L52 66 Q76 78 98 92 Q112 100 122 104 Z" />
            {/* đầu */}
            <path d="M62 44 Q52 30 44 32 L40 44 Q26 52 22 66 Q20 76 30 80 L52 76 Z" />
            {/* đuôi */}
            <path d="M292 104 Q312 108 318 140 Q320 166 306 182 Q304 160 296 140 Q292 122 288 112 Z" />
            {/* chân trước */}
            <path d="M140 152 L158 152 L156 190 L152 236 L142 236 L140 190 Z" />
            {/* chân sau */}
            <path d="M262 156 L282 152 L282 190 L278 236 L266 236 L264 190 Z" />
            {/* móng */}
            <rect x="138" y="236" width="20" height="10" rx="3" />
            <rect x="262" y="236" width="22" height="10" rx="3" />
          </g>

          {layer === 'BONE' && (
            <g stroke="#cbd5e1" strokeWidth={2} fill="none" strokeLinecap="round">
              <path d="M52 62 L92 72 L126 92" />
              <path d="M132 96 L200 92 L262 96" />
              <path d="M148 110 L148 152" />
              <path d="M272 112 L272 152" />
              <path d="M148 152 L148 236" />
              <path d="M272 152 L272 236" />
              <path d="M150 118 L200 140 L258 128" />
            </g>
          )}

          {/* Vùng bấm được */}
          {SPOTS.map((spot) => {
            const mark = markOf(spot.region);
            const isSelected = selected === spot.region;
            const isHover = hover === spot.region;
            const color = mark ? (mark.resolved ? '#9ca3af' : severityColor[mark.severity]) : undefined;
            return (
              <g key={spot.region}>
                {mark && !mark.resolved && (
                  <ellipse
                    cx={spot.x}
                    cy={spot.y}
                    rx={spot.rx + 6}
                    ry={spot.ry + 6}
                    fill={color}
                    opacity={0.25}
                    className="animate-pulse"
                  />
                )}
                <ellipse
                  cx={spot.x}
                  cy={spot.y}
                  rx={spot.rx}
                  ry={spot.ry}
                  fill={color ?? (isHover || isSelected ? '#05966933' : 'transparent')}
                  stroke={isSelected ? '#059669' : color ?? (isHover ? '#059669' : 'transparent')}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  className={readOnly ? '' : 'cursor-pointer'}
                  onClick={readOnly ? undefined : () => onSelect?.(spot.region)}
                  onMouseEnter={() => setHover(spot.region)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}

          {hover && (
            <g>
              <rect x={6} y={6} rx={6} width={172} height={22} fill="#1a2e1a" opacity={0.85} />
              <text x={14} y={21} className="fill-white text-[11px] font-semibold">
                {bodyRegionLabel[hover]}
                {side && isLimbRegion(hover) ? ` ${sideLabel[side]}` : ''}
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        {(['MILD', 'MODERATE', 'SEVERE'] as Severity[]).map((severity) => (
          <span key={severity} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: severityColor[severity] }} />
            {severityLabel[severity]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
          Đã hồi phục
        </span>
      </div>
    </div>
  );
}
