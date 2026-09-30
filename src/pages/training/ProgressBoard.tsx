// Bảng tiến độ (F2.10): mỗi ngựa đang hoạt động — lớp đang học, tỉ lệ có mặt, điểm, cảnh báo, chạy thử, được tập.
// Bấm một hàng để mở tab Huấn luyện trong hồ sơ ngựa (biểu đồ thể lực).
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, HeartOff } from 'lucide-react';
import {
  Avatar,
  Card,
  ChipFilter,
  DataTable,
  ErrorBox,
  FilterSelect,
  Meter,
  PageHeader,
  Pill,
  SearchInput,
  Skeleton,
  ToggleChip,
  Toolbar,
  cn,
  type Column,
} from '../../components/ui';
import { EligibilityBadge, LockPill } from '../../components/ui/status';
import { useService } from '../../hooks/useService';
import { useStore } from '../../store/store';
import { getProgressBoard, type ProgressRow } from '../../services/session.service';
import { links } from '../../lib/links';
import { formatDateShort, formatPercent } from '../../lib/format';
import { trialText } from './components/session-helpers';

type Quick = '' | 'ALERT' | 'BLOCKED' | 'LOW' | 'NO_HR';

/** Thẻ khu bề rộng không đều (bento) — không xếp thành các cột bằng nhau. */
const ZONE_SPANS = ['md:col-span-5', 'md:col-span-4', 'md:col-span-3', 'md:col-span-7', 'md:col-span-5'];

export default function ProgressBoard() {
  const navigate = useNavigate();
  const user = useStore((state) => state.currentUser);
  const { data, loading, error } = useService(() => getProgressBoard(), []);
  const [search, setSearch] = useState('');
  const [zone, setZone] = useState('');
  const [quick, setQuick] = useState<Quick>('');
  const [noClassOnly, setNoClassOnly] = useState(false);
  const showHr = user?.role !== 'HORSE_OWNER';

  const all = useMemo(() => data?.rows ?? [], [data]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((row) => {
      if (term && !row.horseName.toLowerCase().includes(term)) return false;
      if (zone && row.zoneId !== zone) return false;
      if (noClassOnly && row.classes.length > 0) return false;
      if (quick === 'ALERT') return row.redAlerts7 > 0;
      if (quick === 'BLOCKED') return !row.trainable.allowed;
      if (quick === 'LOW') return row.attendance.rate !== null && row.attendance.rate < 0.8;
      if (quick === 'NO_HR') return row.maxHeartRate === undefined;
      return true;
    });
  }, [all, search, zone, quick, noClassOnly]);

  const totals = useMemo(() => {
    const present = all.reduce((sum, row) => sum + row.attendance.present, 0);
    const total = all.reduce((sum, row) => sum + row.attendance.total, 0);
    const scored = all.filter((row) => row.avgScore14 !== null);
    return {
      horses: all.length,
      rate: total ? present / total : null,
      avg: scored.length ? scored.reduce((sum, row) => sum + (row.avgScore14 ?? 0), 0) / scored.length : null,
      alert: all.filter((row) => row.redAlerts7 > 0).length,
      blocked: all.filter((row) => !row.trainable.allowed).length,
      noHr: all.filter((row) => row.maxHeartRate === undefined).length,
      low: all.filter((row) => row.attendance.rate !== null && row.attendance.rate < 0.8).length,
    };
  }, [all]);

  const columns: Column<ProgressRow>[] = [
    {
      key: 'horse',
      header: 'Ngựa',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar src={row.avatar} name={row.horseName} size={38} />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{row.horseName}</p>
            <p className="text-xs text-gray-500">{row.zoneName ?? 'Chưa xếp khu'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'class',
      header: 'Lớp đang học',
      render: (row) =>
        row.classes.length > 0 ? (
          <div className="space-y-0.5">
            {row.classes.map((cls) => (
              <p key={cls.id} className="text-sm font-medium text-gray-800">
                {cls.name}
              </p>
            ))}
            {row.nextSession && (
              <p className="text-xs text-gray-500 tabular-nums">
                Buổi tới {formatDateShort(row.nextSession.date)} · {row.nextSession.slotLabel.split('–')[0]}
              </p>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-400">Chưa học lớp nào</span>
        ),
    },
    {
      key: 'attendance',
      header: 'Có mặt 28 ngày',
      className: 'min-w-36',
      render: (row) =>
        row.attendance.rate === null ? (
          <span className="text-sm text-gray-400">Chưa có buổi</span>
        ) : (
          <div>
            <p className="text-sm font-semibold tabular-nums text-gray-800">
              {formatPercent(row.attendance.rate)}
              <span className="ml-1 font-normal text-gray-500">
                {row.attendance.present}/{row.attendance.total}
              </span>
            </p>
            <Meter
              value={row.attendance.present}
              max={row.attendance.total}
              tone={row.attendance.rate >= 0.8 ? 'green' : 'amber'}
              className="mt-1.5"
            />
          </div>
        ),
    },
    {
      key: 'score',
      header: 'Điểm TB 14 ngày',
      render: (row) =>
        row.avgScore14 === null ? (
          <span className="text-sm text-gray-400">—</span>
        ) : (
          <span className={cn('text-base font-semibold tabular-nums', row.avgScore14 < 5 ? 'text-amber-700' : 'text-gray-900')}>
            {row.avgScore14.toLocaleString('vi-VN')}
            <span className="ml-1 text-xs font-normal text-gray-500">{row.scored14} buổi</span>
          </span>
        ),
    },
    {
      key: 'alerts',
      header: 'Cảnh báo 7 ngày',
      render: (row) =>
        row.alerts7 === 0 ? (
          <span className="text-sm text-gray-400">—</span>
        ) : row.redAlerts7 > 0 ? (
          <Pill tone="red">
            <AlertOctagon size={11} /> {row.alerts7} · {row.redAlerts7} đỏ
          </Pill>
        ) : (
          <span className="text-sm text-gray-700 tabular-nums">{row.alerts7}</span>
        ),
    },
    {
      key: 'trial',
      header: 'Chạy thử gần nhất',
      render: (row) =>
        row.lastTrial ? (
          <div>
            <p className="text-sm font-medium tabular-nums text-gray-800">
              {trialText(row.lastTrial.seconds, row.lastTrial.notCompleted)}
            </p>
            <p className="text-xs text-gray-500 tabular-nums">
              {row.lastTrial.distanceM} m · {formatDateShort(row.lastTrial.date)}
            </p>
          </div>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        ),
    },
    {
      key: 'trainable',
      header: 'Được tập',
      className: 'max-w-56',
      render: (row) => (
        <div className="space-y-1">
          {!row.trainable.allowed && (
            <EligibilityBadge allowed={false} reason={row.trainable.reason} label="Không được tập" compact />
          )}
          {row.locked && <LockPill />}
        </div>
      ),
    },
    ...(showHr
      ? [
          {
            key: 'hr',
            header: 'Nhịp tim tối đa',
            render: (row: ProgressRow) =>
              row.maxHeartRate !== undefined ? (
                <span className="text-sm font-semibold tabular-nums text-gray-800">{row.maxHeartRate}</span>
              ) : (
                <span className="text-sm text-amber-700">Chưa đặt</span>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tiến độ huấn luyện"
        description={
          user?.role === 'HORSE_OWNER'
            ? 'Tình hình tập luyện của các ngựa bạn sở hữu. Bấm một ngựa để xem biểu đồ và nhận xét của HT.'
            : 'Ngựa đang hoạt động, tính theo các buổi đã chạy của mọi lớp. Bấm một hàng để xem biểu đồ thể lực.'
        }
      />

      {error && <ErrorBox message={error} />}
      {loading && !data && <Skeleton rows={5} />}

      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ChipFilter<Quick>
              value={quick === 'NO_HR' ? '' : quick}
              onChange={setQuick}
              options={[
                { value: '', label: 'Tất cả', count: totals.horses },
                { value: 'BLOCKED', label: 'Không được tập', count: totals.blocked, dot: 'danger' },
                { value: 'ALERT', label: 'Có cảnh báo đỏ', count: totals.alert, dot: 'danger' },
                { value: 'LOW', label: 'Có mặt dưới 80%', count: totals.low, dot: 'warn' },
              ]}
            />
            <p className="text-sm text-gray-500 tabular-nums">
              Có mặt 28 ngày{' '}
              <span className="font-medium text-gray-900">{totals.rate === null ? '—' : formatPercent(totals.rate)}</span>
              {' · '}điểm TB 14 ngày{' '}
              <span className="font-medium text-gray-900">{totals.avg === null ? '—' : totals.avg.toFixed(1)}</span>
            </p>
          </div>

          {data.zones.length > 1 && (
            <div className="grid gap-4 md:grid-cols-12">
              {data.zones.map((item, index) => (
                <Card key={item.zoneId} className={cn('p-4 sm:p-5', ZONE_SPANS[index % ZONE_SPANS.length])}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{item.zoneName}</p>
                      <p className="text-xs text-gray-500">{item.trainerName ? `HT ${item.trainerName}` : 'Chưa có HT'}</p>
                    </div>
                    <span className="text-sm text-gray-500 tabular-nums">{item.horseCount} ngựa</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Có mặt</p>
                      <p className="font-semibold tabular-nums text-gray-800">
                        {item.attendanceRate === null ? '—' : formatPercent(item.attendanceRate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Điểm TB</p>
                      <p className="font-semibold tabular-nums text-gray-800">{item.avgScore ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Cảnh báo 7 ngày</p>
                      <p className="font-semibold tabular-nums text-gray-800">
                        {item.alerts7}
                      </p>
                    </div>
                  </div>
                  {item.blocked > 0 && <p className="mt-2 text-xs text-red-700">{item.blocked} ngựa không được tập</p>}
                </Card>
              ))}
            </div>
          )}

          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên ngựa…" className="flex-1" />
            {data.zones.length > 1 && (
              <FilterSelect value={zone} onChange={setZone} label="Khu">
                <option value="">Mọi khu</option>
                {data.zones.map((item) => (
                  <option key={item.zoneId} value={item.zoneId}>
                    {item.zoneName}
                  </option>
                ))}
              </FilterSelect>
            )}
            <ToggleChip checked={noClassOnly} onChange={setNoClassOnly}>
              Chưa học lớp nào
            </ToggleChip>
            {showHr && totals.noHr > 0 && (
              <ToggleChip checked={quick === 'NO_HR'} onChange={(value) => setQuick(value ? 'NO_HR' : '')}>
                <HeartOff size={13} /> Chưa đặt nhịp tim ({totals.noHr})
              </ToggleChip>
            )}
          </Toolbar>

          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(row) => row.horseId}
            onRowClick={(row) => navigate(links.horse(row.horseId, 'training'))}
            pageSize={15}
            emptyTitle={all.length === 0 ? 'Chưa có ngựa nào đang hoạt động' : 'Không có ngựa khớp bộ lọc'}
          />
        </>
      )}
    </div>
  );
}
