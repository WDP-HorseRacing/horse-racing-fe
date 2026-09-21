import { useState } from 'react';
import { Check, Flag, Plus, Trophy, X } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import {
  createRace,
  createRegistration,
  decideRegistration,
  getClubReport,
  getOwnerReport,
  listRaceCandidates,
  listRaces,
  listRegistrations,
  listResults,
  saveResult,
} from '../../services/race.service';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  PageHeader,
  Pill,
  SectionTitle,
  Select,
  Skeleton,
} from '../../components/ui';
import { RegistrationPill } from '../../components/ui/status';
import { distanceLabel, raceStatusLabel, surfaceLabel } from '../../lib/labels';
import { formatDate, formatMoney, toDateKey } from '../../lib/format';
import { now } from '../../lib/clock';
import type { TrackSurface } from '../../types/domain';

/* ===== F5.1 + F5.2 — Giải đua và đăng ký ===== */

export function RaceList() {
  const currentUser = useStore((state) => state.currentUser);
  const canManage = can(currentUser, 'race.manage');
  const canRegister = can(currentUser, 'race.register');
  const races = useService(() => listRaces(), []);
  const registrations = useService(() => listRegistrations(), []);
  const action = useAction();

  const [registerFor, setRegisterFor] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    date: '',
    venue: '',
    distanceM: 1600,
    surface: 'TURF' as TrackSurface,
    fee: 10_000_000,
    purse: 500_000_000,
    minAge: 3,
    registrationDeadline: '',
  });

  const candidates = useService(
    () => (registerFor ? listRaceCandidates(registerFor) : Promise.resolve([])),
    [registerFor],
  );

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Giải đua"
        description="Chỉ ngựa đủ điều kiện đua mới chọn được. Đăng ký phải qua chủ đại diện duyệt mới thành công."
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Thêm giải đua
            </Button>
          ) : undefined
        }
      />

      {action.error && <ErrorBox message={action.error} />}
      {races.loading && <Skeleton rows={3} />}

      <div className="space-y-4">
        {races.data?.map((race) => {
          const mine = (registrations.data ?? []).filter((item) => item.raceId === race.id);
          return (
            <Card key={race.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-bold text-gray-900">{race.name}</span>
                    <Pill tone={race.status === 'OPEN' ? 'green' : race.status === 'FINISHED' ? 'gray' : 'amber'}>
                      {raceStatusLabel[race.status]}
                    </Pill>
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatDate(race.date)} · {race.venue} · {race.distanceM} m · mặt sân{' '}
                    {surfaceLabel[race.surface].toLowerCase()}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Hạn đăng ký {formatDate(race.registrationDeadline)} · phí {formatMoney(race.fee)} · tổng thưởng{' '}
                    {formatMoney(race.purse)}
                    {race.minAge ? ` · tuổi tối thiểu ${race.minAge}` : ''}
                  </p>
                </div>
                {canRegister && race.status === 'OPEN' && !race.closed && (
                  <Button onClick={() => setRegisterFor(race.id)}>
                    <Flag size={15} /> Đăng ký ngựa
                  </Button>
                )}
              </div>

              {mine.length > 0 && (
                <div className="mt-4 space-y-1 border-t border-gray-50 pt-4">
                  {mine.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <Avatar src={item.horseAvatar} name={item.horseName} size={28} />
                        <span className="text-sm font-medium text-gray-700">{item.horseName}</span>
                        {item.representativeName && (
                          <span className="text-xs text-gray-400">chủ đại diện: {item.representativeName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.cancelReason && <span className="text-xs text-red-500">{item.cancelReason}</span>}
                        <RegistrationPill status={item.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Chọn ngựa đăng ký */}
      <Modal
        open={registerFor !== null}
        onClose={() => setRegisterFor(null)}
        title="Chọn ngựa đăng ký thi đấu"
        width="max-w-2xl"
        footer={
          <Button variant="secondary" onClick={() => setRegisterFor(null)}>
            Đóng
          </Button>
        }
      >
        <div className="space-y-2">
          {candidates.loading && <Skeleton rows={4} />}
          {candidates.data?.map((candidate) => (
            <div
              key={candidate.horseId}
              className={`flex flex-wrap items-center gap-3 rounded-xl p-3 ${
                candidate.allowed ? 'bg-gray-50' : 'bg-red-50/50'
              }`}
            >
              <Avatar src={candidate.horseAvatar} name={candidate.horseName} size={36} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-800">
                  {candidate.horseName}
                  {candidate.matchesPreference ? (
                    <Pill tone="green">Hợp sở trường</Pill>
                  ) : candidate.distancePreference ? (
                    <Pill tone="gray">
                      Sở trường {(distanceLabel[candidate.distancePreference as keyof typeof distanceLabel] ?? '').toLowerCase()}
                    </Pill>
                  ) : null}
                </p>
                {!candidate.allowed && <p className="text-xs text-red-600">{candidate.reason}</p>}
              </div>
              {candidate.alreadyRegistered ? (
                <Pill tone="amber">Đã có đăng ký</Pill>
              ) : candidate.allowed ? (
                <Button
                  size="sm"
                  onClick={async () => {
                    const done = await action.run(() => createRegistration(registerFor!, candidate.horseId));
                    if (done) {
                      candidates.reload();
                      registrations.reload();
                    }
                  }}
                  disabled={action.pending}
                >
                  Gửi duyệt
                </Button>
              ) : (
                <X size={18} className="text-red-400" />
              )}
            </div>
          ))}
        </div>
      </Modal>

      {/* Thêm giải đua */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Thêm giải đua"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() => createRace(form));
                if (done !== undefined) {
                  setCreateOpen(false);
                  races.reload();
                }
              }}
              disabled={action.pending}
            >
              Lưu
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên giải" required className="sm:col-span-2" error={action.field === 'name' ? action.error : undefined}>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Ngày đua" required error={action.field === 'date' ? action.error : undefined}>
            <Input
              type="date"
              min={toDateKey(now())}
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </Field>
          <Field label="Hạn đăng ký" required error={action.field === 'registrationDeadline' ? action.error : undefined}>
            <Input
              type="date"
              min={toDateKey(now())}
              max={form.date || undefined}
              value={form.registrationDeadline}
              onChange={(event) => setForm({ ...form, registrationDeadline: event.target.value })}
            />
          </Field>
          <Field label="Địa điểm" required>
            <Input value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} />
          </Field>
          <Field label="Cự ly (m)" required hint="800–4000 m">
            <Input
              type="number"
              min={800}
              max={4000}
              value={form.distanceM}
              onChange={(event) => setForm({ ...form, distanceM: Number(event.target.value) })}
            />
          </Field>
          <Field label="Mặt sân" required>
            <Select value={form.surface} onChange={(event) => setForm({ ...form, surface: event.target.value as TrackSurface })}>
              {Object.entries(surfaceLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tuổi tối thiểu">
            <Input
              type="number"
              value={form.minAge}
              onChange={(event) => setForm({ ...form, minAge: Number(event.target.value) })}
            />
          </Field>
          <Field label="Phí đăng ký (đ)" required>
            <Input type="number" value={form.fee} onChange={(event) => setForm({ ...form, fee: Number(event.target.value) })} />
          </Field>
          <Field label="Tổng thưởng (đ)" required>
            <Input type="number" value={form.purse} onChange={(event) => setForm({ ...form, purse: Number(event.target.value) })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ===== Chủ ngựa duyệt đăng ký ===== */

export function RaceApprovals() {
  const { data, loading, reload } = useService(() => listRegistrations(), []);
  const action = useAction();
  const pending = (data ?? []).filter((item) => item.canDecide);
  const others = (data ?? []).filter((item) => !item.canDecide);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Duyệt đăng ký thi đấu"
        description="Huấn luyện viên gửi đăng ký, chủ đại diện quyết định cuối cùng."
      />
      {action.error && <ErrorBox message={action.error} />}
      {loading && <Skeleton rows={3} />}

      {pending.length === 0 && others.length === 0 && (
        <EmptyState title="Chưa có đăng ký nào" hint="Khi huấn luyện viên gửi đăng ký cho ngựa của bạn, nó sẽ hiện ở đây." />
      )}

      {pending.map((item) => (
        <Card key={item.id} tone="warning">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar src={item.horseAvatar} name={item.horseName} size={48} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900">
                {item.horseName} · {item.raceName}
              </p>
              <p className="mt-0.5 text-sm text-gray-500">
                {formatDate(item.raceDate)} · {item.distanceM} m · đề xuất bởi {item.createdByName}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  const done = await action.run(() => decideRegistration(item.id, true));
                  if (done !== undefined) reload();
                }}
              >
                <Check size={15} /> Duyệt
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  const note = window.prompt('Lý do từ chối:');
                  if (!note) return;
                  const done = await action.run(() => decideRegistration(item.id, false, note));
                  if (done !== undefined) reload();
                }}
              >
                Từ chối
              </Button>
            </div>
          </div>
        </Card>
      ))}

      {others.length > 0 && (
        <Card>
          <SectionTitle>Các đăng ký khác</SectionTitle>
          <div className="space-y-1">
            {others.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 py-3 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {item.horseName} · {item.raceName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(item.raceDate)}
                    {item.cancelReason ? ` · ${item.cancelReason}` : ''}
                  </p>
                </div>
                <RegistrationPill status={item.status} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ===== F5.3 — Kết quả ===== */

export function RaceResults() {
  const currentUser = useStore((state) => state.currentUser);
  const canManage = can(currentUser, 'race.manage');
  const results = useService(() => listResults(), []);
  const races = useService(() => listRaces(), []);
  const registrations = useService(() => listRegistrations(), []);
  const action = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ raceId: '', horseId: '', rank: 1, timeSeconds: 0, prize: 0 });

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Kết quả thi đấu"
        description="Kết quả nhập sau ngày đua, hiện luôn ở tab Thi đấu của từng con ngựa."
        actions={
          canManage ? (
            <Button onClick={() => setOpen(true)}>
              <Trophy size={16} /> Nhập kết quả
            </Button>
          ) : undefined
        }
      />
      {action.error && <ErrorBox message={action.error} />}
      {results.loading && <Skeleton rows={3} />}
      {!results.loading && (results.data?.length ?? 0) === 0 && <EmptyState title="Chưa có kết quả nào" />}

      <div className="space-y-2">
        {results.data?.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-center gap-4">
              <Pill tone={item.rank <= 3 ? 'green' : 'gray'}>Hạng {item.rank}</Pill>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">
                  {item.horseName} · {item.raceName}
                </p>
                <p className="text-xs text-gray-400">{formatDate(item.raceDate)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900 tabular-nums">{item.timeSeconds.toFixed(2)} s</p>
                <p className="text-xs text-emerald-600">{item.prize > 0 ? formatMoney(item.prize) : 'Không thưởng'}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nhập kết quả thi đấu"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() => saveResult(form));
                if (done !== undefined) {
                  setOpen(false);
                  results.reload();
                }
              }}
              disabled={action.pending}
            >
              Lưu kết quả
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Giải đua" required>
            <Select value={form.raceId} onChange={(event) => setForm({ ...form, raceId: event.target.value, horseId: '' })}>
              <option value="">Chọn giải</option>
              {races.data?.map((race) => (
                <option key={race.id} value={race.id}>
                  {race.name} — {formatDate(race.date)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ngựa" required>
            <Select value={form.horseId} onChange={(event) => setForm({ ...form, horseId: event.target.value })}>
              <option value="">Chọn ngựa đã đăng ký</option>
              {(registrations.data ?? [])
                .filter((item) => item.raceId === form.raceId && item.status === 'REGISTERED')
                .map((item) => (
                  <option key={item.horseId} value={item.horseId}>
                    {item.horseName}
                  </option>
                ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Thứ hạng" required error={action.field === 'rank' ? action.error : undefined}>
              <Input type="number" value={form.rank} onChange={(event) => setForm({ ...form, rank: Number(event.target.value) })} />
            </Field>
            <Field label="Thời gian (giây)" required>
              <Input
                type="number"
                step="0.01"
                value={form.timeSeconds}
                onChange={(event) => setForm({ ...form, timeSeconds: Number(event.target.value) })}
              />
            </Field>
            <Field label="Tiền thưởng (đ)">
              <Input type="number" value={form.prize} onChange={(event) => setForm({ ...form, prize: Number(event.target.value) })} />
            </Field>
          </div>
          {action.error && !action.field && <ErrorBox message={action.error} />}
        </div>
      </Modal>
    </div>
  );
}

/* ===== F5.4 — Báo cáo ===== */

export function Reports() {
  const currentUser = useStore((state) => state.currentUser);
  const isOwner = currentUser?.role === 'HORSE_OWNER';
  const owner = useService(() => getOwnerReport(), []);
  const club = useService(() => (can(currentUser, 'report.club') ? getClubReport() : Promise.resolve(null)), []);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Báo cáo"
        description={
          isOwner
            ? 'Chi phí và tiền thưởng của ngựa bạn sở hữu, nhân theo tỉ lệ sở hữu và chỉ tính trong thời gian bạn sở hữu.'
            : 'Chi phí vận hành theo khu, doanh thu giải đấu và chi phí y tế toàn câu lạc bộ.'
        }
      />

      {owner.loading && <Skeleton rows={4} />}

      {owner.data?.map((horse) => (
        <Card key={horse.horseId}>
          <div className="mb-4 flex items-center gap-3">
            <Avatar src={horse.horseAvatar} name={horse.horseName} size={40} />
            <div>
              <p className="font-semibold text-gray-900">{horse.horseName}</p>
              {isOwner && <p className="text-xs text-gray-400">Tỉ lệ sở hữu {horse.percent}%</p>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-3 py-2 text-xs font-semibold text-gray-400">Kỳ</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400">Nuôi dưỡng</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400">Y tế</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400">Phí giải</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400">Khác</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400">Tiền thưởng</th>
                  {isOwner && <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400">Phần của tôi</th>}
                </tr>
              </thead>
              <tbody>
                {horse.rows.map((row) => (
                  <tr key={row.label} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-2.5 font-medium text-gray-700">{row.label}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{formatMoney(row.boarding)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{formatMoney(row.medical)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{formatMoney(row.raceFee)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{formatMoney(row.other)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-emerald-700 tabular-nums">
                      {formatMoney(row.prize)}
                    </td>
                    {isOwner && (
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums">
                        {formatMoney(row.myShare)}
                        {row.myPrize > 0 && (
                          <span className="block text-xs font-normal text-emerald-600">+{formatMoney(row.myPrize)}</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {club.data && (
        <>
          <Card>
            <SectionTitle>Chi phí vận hành theo khu</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-3">
              {club.data.operations.map((zone) => (
                <div key={zone.zoneName} className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-800">{zone.zoneName}</p>
                  <div className="mt-2 space-y-1">
                    {zone.rows.map((row) => (
                      <div key={row.label} className="flex justify-between text-sm">
                        <span className="text-gray-400">{row.label}</span>
                        <span className="font-medium text-gray-700 tabular-nums">{formatMoney(row.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>Doanh thu giải đấu</SectionTitle>
            {club.data.raceRevenue.length === 0 ? (
              <p className="text-sm font-light text-gray-400">Chưa có giải nào đã diễn ra.</p>
            ) : (
              <div className="space-y-1">
                {club.data.raceRevenue.map((race) => (
                  <div key={race.name} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-50 py-2.5 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{race.name}</p>
                      <p className="text-xs text-gray-400">{formatDate(race.date)}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-gray-600 tabular-nums">Phí đăng ký {formatMoney(race.fees)}</p>
                      <p className="text-emerald-600 tabular-nums">Tiền thưởng nhận về {formatMoney(race.prizes)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>Chi phí y tế toàn câu lạc bộ</SectionTitle>
            <p className="text-3xl font-bold text-gray-900 tabular-nums">{formatMoney(club.data.medicalTotal)}</p>
          </Card>
        </>
      )}
    </div>
  );
}
