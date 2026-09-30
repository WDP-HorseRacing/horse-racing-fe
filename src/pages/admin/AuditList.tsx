import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, EmptyState, Pill } from '../../components/ui';
import { formatDateTime } from '../../lib/format';
import { roleShortLabel } from '../../lib/labels';
import type { AuditLog, UserRole } from '../../types/domain';

function Diff({ label, value, tone }: { label: string; value: unknown; tone: 'before' | 'after' }) {
  if (value === undefined || value === null) {
    return (
      <div className={`rounded-xl p-3 ring-1 ${tone === 'before' ? 'bg-gray-50 ring-gray-100' : 'bg-white ring-gray-200'}`}>
        <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
        <p className="text-sm text-gray-400">— không có —</p>
      </div>
    );
  }
  const entries: [string, unknown][] =
    typeof value === 'object' ? Object.entries(value as Record<string, unknown>) : [['', value]];
  return (
    <div className={`rounded-xl p-3 ring-1 ${tone === 'before' ? 'bg-gray-50 ring-gray-100' : 'bg-white ring-gray-200'}`}>
      <p className="mb-1 text-xs font-medium text-gray-500">{label}</p>
      {entries.map(([key, entry]) => (
        <p key={key} className="text-sm text-gray-700">
          {key && <span className="text-gray-500">{key}: </span>}
          <span className="font-medium">{entry === undefined ? '—' : String(entry)}</span>
        </p>
      ))}
    </div>
  );
}

export function AuditList({ rows }: { rows: AuditLog[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return <EmptyState title="Chưa có thao tác nào được ghi lại" />;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <Card key={row.id} className="p-0">
          <button
            onClick={() => setOpenId(openId === row.id ? null : row.id)}
            className="flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left"
          >
            <span className="w-36 shrink-0 text-xs text-gray-500 tabular-nums">{formatDateTime(row.at)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">{row.action}</p>
              <p className="text-xs text-gray-500">
                {row.userName} · {row.role === 'SYSTEM' ? 'Hệ thống' : roleShortLabel[row.role as UserRole]} ·{' '}
                {row.entityType} {row.entityId}
              </p>
            </div>
            {row.reason && <Pill tone="gray">{row.reason.slice(0, 40)}</Pill>}
            <ChevronDown
              size={16}
              className={`shrink-0 text-gray-300 transition-transform ${openId === row.id ? 'rotate-180' : ''}`}
            />
          </button>
          {openId === row.id && (
            <div className="grid gap-3 border-t border-gray-100 px-5 py-4 sm:grid-cols-2">
              <Diff label="Giá trị trước" value={row.before} tone="before" />
              <Diff label="Giá trị sau" value={row.after} tone="after" />
              {row.reason && (
                <div className="sm:col-span-2 rounded-xl bg-white p-3 text-sm text-gray-800 ring-1 ring-gray-200">
                  <span className="text-xs font-medium text-gray-500">Lý do: </span>
                  {row.reason}
                </div>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
