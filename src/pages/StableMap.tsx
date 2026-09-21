import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, MapPinned, MoveRight, PlusCircle } from 'lucide-react';
import { useAction, useService } from '../hooks/useService';
import {
  assignStall,
  getStableMap,
  listFreeStalls,
  listGrooms,
  listUnstabledHorses,
  type StallCell,
} from '../services/horse.service';
import { useStore } from '../store/store';
import { can } from '../auth/permissions';
import {
  Button,
  Card,
  ErrorBox,
  Field,
  Modal,
  PageHeader,
  Pill,
  SectionTitle,
  Select,
  Skeleton,
  Textarea,
} from '../components/ui';
import { HealthPill, stallBorder } from '../components/ui/status';
import { healthLabel, stallTypeLabel } from '../lib/labels';

export default function StableMap() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const editable = can(currentUser, 'stall.assign');
  const isOwner = currentUser?.role === 'HORSE_OWNER';

  const { data, loading, reload } = useService(() => getStableMap(), []);
  const stalls = useService(() => listFreeStalls(), []);
  const unstabled = useService(() => listUnstabledHorses(), []);
  const grooms = useService(() => listGrooms(), []);
  const action = useAction();

  const [selected, setSelected] = useState<StallCell | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeForm, setPlaceForm] = useState({ horseId: '', groomId: '', reason: '' });
  const [form, setForm] = useState({ stallId: '', groomId: '', reason: '' });

  if (isOwner) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader title="Vị trí chuồng" description="Bạn xem được tên khu và mã ô của ngựa mình sở hữu." />
        <Card>
          <p className="text-sm text-gray-500">
            Mở trang chi tiết từng con ngựa ở mục <strong>Ngựa của tôi</strong> để xem khu chuồng và mã ô.
          </p>
        </Card>
      </div>
    );
  }

  if (loading) return <Skeleton rows={5} />;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Sơ đồ chuồng"
        description="Màu viền ô theo trạng thái sức khỏe của ngựa. Mỗi ô chứa một ngựa, mỗi ngựa có đúng một nhân viên chăm sóc."
      />

      {action.error && <ErrorBox message={action.error} />}

      <Card>
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          {(Object.keys(healthLabel) as (keyof typeof healthLabel)[]).map((status) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded border ${stallBorder[status]}`} />
              {healthLabel[status]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <Lock size={12} className="text-red-500" /> Đang có khóa huấn luyện
          </span>
        </div>
      </Card>

      {data?.map((zone) => (
        <Card key={zone.zoneId}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <SectionTitle icon={<MapPinned size={16} className="text-emerald-600" />}>{zone.zoneName}</SectionTitle>
              <p className="-mt-3 text-xs text-gray-400">
                Huấn luyện viên phụ trách: {zone.headTrainerName ?? 'không có — chỉ xem'}
              </p>
            </div>
            <Pill tone={zone.occupied >= zone.capacity ? 'amber' : 'gray'}>
              Sức chứa {zone.occupied}/{zone.capacity}
            </Pill>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {zone.cells.map((cell) => (
              <button
                key={cell.stallId}
                onClick={() => setSelected(cell)}
                className={`rounded-xl border p-3 text-left transition hover:brightness-95 ${
                  cell.healthStatus ? stallBorder[cell.healthStatus] : 'border-dashed border-gray-200 bg-gray-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-400">{cell.code}</span>
                  {cell.locked && <Lock size={12} className="text-red-500" />}
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-gray-800">{cell.horseName ?? 'Trống'}</p>
                <p className="mt-0.5 truncate text-[11px] text-gray-500">{stallTypeLabel[cell.type]}</p>
              </button>
            ))}
          </div>
        </Card>
      ))}

      {/* Xem nhanh ô chuồng */}
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={`Ô chuồng ${selected?.code ?? ''}`}
        footer={
          selected?.horseId ? (
            <>
              <Button variant="secondary" onClick={() => navigate(`/horses/${selected.horseId}`)}>
                Mở hồ sơ ngựa
              </Button>
              {editable && (
                <Button
                  onClick={() => {
                    setForm({ stallId: '', groomId: '', reason: '' });
                    setMoveOpen(true);
                  }}
                >
                  <MoveRight size={15} /> Chuyển chuồng / đổi nhân viên
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Đóng
              </Button>
              {editable && (
                <Button
                  onClick={() => {
                    setPlaceForm({ horseId: '', groomId: '', reason: '' });
                    setPlaceOpen(true);
                  }}
                >
                  <PlusCircle size={15} /> Xếp ngựa vào ô này
                </Button>
              )}
            </>
          )
        }
      >
        {selected?.horseId ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-gray-900">{selected.horseName}</span>
              {selected.healthStatus && <HealthPill status={selected.healthStatus} />}
            </div>
            <p className="text-sm text-gray-500">Loại ô: {stallTypeLabel[selected.type]}</p>
            <p className="text-sm text-gray-500">Nhân viên chăm sóc: {selected.groomName ?? 'chưa phân công'}</p>
            {selected.locked && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Ngựa đang có khóa huấn luyện.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Ô chuồng đang trống ({stallTypeLabel[selected?.type ?? 'STANDARD']}).</p>
            {editable && (unstabled.data?.length ?? 0) === 0 && (
              <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">
                Hiện không có con ngựa nào chưa được xếp chuồng. Muốn đổi chỗ thì mở ô đang có ngựa rồi chọn
                &ldquo;Chuyển chuồng&rdquo;.
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Xếp ngựa chưa có chuồng vào ô trống */}
      <Modal
        open={placeOpen}
        onClose={() => setPlaceOpen(false)}
        title={`Xếp ngựa vào ô ${selected?.code ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPlaceOpen(false)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() =>
                  assignStall({
                    horseId: placeForm.horseId,
                    stallId: selected!.stallId,
                    groomId: placeForm.groomId || undefined,
                    reason: placeForm.reason,
                  }),
                );
                if (done !== undefined) {
                  setPlaceOpen(false);
                  setSelected(null);
                  reload();
                  stalls.reload();
                  unstabled.reload();
                }
              }}
              disabled={action.pending || !placeForm.horseId}
            >
              {action.pending ? 'Đang lưu…' : 'Xếp vào ô này'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="Ngựa"
            required
            hint="Chỉ liệt kê ngựa của câu lạc bộ chưa được xếp vào ô nào"
            error={action.field === 'stallId' ? action.error : undefined}
          >
            <Select value={placeForm.horseId} onChange={(event) => setPlaceForm({ ...placeForm, horseId: event.target.value })}>
              <option value="">Chọn ngựa</option>
              {unstabled.data?.map((horse) => (
                <option key={horse.id} value={horse.id}>
                  {horse.name} — {healthLabel[horse.healthStatus]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nhân viên chăm sóc" hint="Mỗi ngựa có đúng một người phụ trách">
            <Select value={placeForm.groomId} onChange={(event) => setPlaceForm({ ...placeForm, groomId: event.target.value })}>
              <option value="">Chưa phân công</option>
              {grooms.data?.map((groom) => (
                <option key={groom.id} value={groom.id}>
                  {groom.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lý do">
            <Textarea value={placeForm.reason} onChange={(event) => setPlaceForm({ ...placeForm, reason: event.target.value })} />
          </Field>
          {selected?.type === 'ISOLATION' && (
            <p className="rounded-xl bg-purple-50 p-3 text-sm text-purple-800">
              Đây là ô cách ly. Ngựa đang cách ly bắt buộc ở ô loại này; ngựa khác vẫn xếp được nhưng nên giữ ô trống
              cho trường hợp cần cách ly khẩn.
            </p>
          )}
          {action.error && !action.field && <ErrorBox message={action.error} />}
        </div>
      </Modal>

      {/* Chuyển chuồng */}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title={`Chuyển chuồng — ${selected?.horseName ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveOpen(false)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() =>
                  assignStall({
                    horseId: selected!.horseId!,
                    stallId: form.stallId,
                    groomId: form.groomId || undefined,
                    reason: form.reason,
                  }),
                );
                if (done !== undefined) {
                  setMoveOpen(false);
                  setSelected(null);
                  reload();
                  stalls.reload();
                }
              }}
              disabled={action.pending || !form.stallId}
            >
              {action.pending ? 'Đang lưu…' : 'Xác nhận chuyển'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Ô chuồng đích" required error={action.field === 'stallId' ? action.error : undefined}>
            <Select value={form.stallId} onChange={(event) => setForm({ ...form, stallId: event.target.value })}>
              <option value="">Chọn ô còn trống</option>
              {stalls.data?.map((stall) => (
                <option key={stall.id} value={stall.id}>
                  {stall.zoneName} · {stall.code} ({stallTypeLabel[stall.type as never]})
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Nhân viên chăm sóc"
            hint="Để trống nếu giữ nguyên người đang phụ trách"
          >
            <Select value={form.groomId} onChange={(event) => setForm({ ...form, groomId: event.target.value })}>
              <option value="">Giữ nguyên</option>
              {grooms.data?.map((groom) => (
                <option key={groom.id} value={groom.id}>
                  {groom.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lý do">
            <Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
          </Field>
          <ul className="space-y-1.5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            <li>Đổi nhân viên chăm sóc: buổi tập tương lai và việc chưa làm trong ngày chuyển sang người mới.</li>
            <li>Đổi khu: giáo án đang áp dụng và sắp tới được gắn cờ &ldquo;cần xem lại&rdquo; cho huấn luyện viên khu mới.</li>
            <li>Ngựa đang cách ly bắt buộc phải ở ô loại cách ly.</li>
          </ul>
          {action.error && !action.field && <ErrorBox message={action.error} />}
        </div>
      </Modal>
    </div>
  );
}
