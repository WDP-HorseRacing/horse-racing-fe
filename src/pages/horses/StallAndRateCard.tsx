// Thẻ "Chuồng trại và phụ trách" trong trang chi tiết ngựa.
// Gộp hai thao tác của quản lý câu lạc bộ: xếp/chuyển ô chuồng và đặt phí nuôi dưỡng.
import { useState } from 'react';
import { AlertTriangle, MapPinned, Wallet } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import {
  assignStall,
  listFreeStalls,
  listGrooms,
  setHorseDailyRate,
  type HorseDetail,
} from '../../services/horse.service';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { Button, Card, ErrorBox, Field, InfoRow, Input, Modal, Select, Textarea } from '../../components/ui';
import { stallTypeLabel } from '../../lib/labels';
import { formatMoney } from '../../lib/format';

export function StallAndRateCard({ horse, onChanged }: { horse: HorseDetail; onChanged: () => void }) {
  const currentUser = useStore((state) => state.currentUser);
  const canAssign = can(currentUser, 'stall.assign') && horse.lifecycleStatus !== 'TRANSFERRED';
  const canSetRate = can(currentUser, 'boarding.rate');

  const stalls = useService(() => (canAssign ? listFreeStalls() : Promise.resolve([])), [canAssign]);
  const grooms = useService(() => (canAssign ? listGrooms() : Promise.resolve([])), [canAssign]);
  const action = useAction();

  const [stallOpen, setStallOpen] = useState(false);
  const [stallForm, setStallForm] = useState({ stallId: '', groomId: '', reason: '' });
  const [rateOpen, setRateOpen] = useState(false);
  const [rateForm, setRateForm] = useState({ useDefault: false, value: '', reason: '' });

  const openRate = () => {
    setRateForm({
      useDefault: !horse.dailyRateIsCustom,
      value: String(horse.dailyRate ?? ''),
      reason: '',
    });
    setRateOpen(true);
  };

  return (
    <Card className="md:col-span-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-500">Chuồng trại và phụ trách</h3>
        {canAssign && (
          <Button size="sm" variant="secondary" onClick={() => setStallOpen(true)}>
            <MapPinned size={14} /> {horse.stallCode ? 'Chuyển ô chuồng' : 'Xếp vào ô chuồng'}
          </Button>
        )}
      </div>

      <InfoRow label="Khu chuồng" value={horse.zoneName ?? 'Chưa xếp chuồng'} />
      <InfoRow label="Mã ô" value={horse.stallCode ?? '—'} />
      <InfoRow label="Nhân viên chăm sóc" value={horse.groomName ?? 'Chưa phân công'} />
      {horse.representativeName !== undefined && (
        <InfoRow label="Chủ đại diện" value={horse.representativeName ?? 'Chưa có chủ đại diện'} />
      )}
      {horse.dailyRate !== undefined && (
        <InfoRow
          label="Phí nuôi dưỡng"
          value={
            <span className="flex flex-wrap items-center justify-end gap-2">
              <span>{formatMoney(horse.dailyRate)}/ngày</span>
              {horse.dailyRateIsCustom !== undefined && (
                <span className="text-xs font-normal text-gray-400">
                  {horse.dailyRateIsCustom ? 'mức riêng' : 'mức mặc định của câu lạc bộ'}
                </span>
              )}
              {canSetRate && (
                <button
                  onClick={openRate}
                  className="rounded-lg p-1 text-gray-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                  title="Sửa phí nuôi dưỡng"
                >
                  <Wallet size={14} />
                </button>
              )}
            </span>
          }
        />
      )}

      {!horse.stallCode && horse.lifecycleStatus === 'ACTIVE' && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
          <MapPinned size={14} className="mt-0.5 shrink-0" />
          Ngựa chưa được xếp chuồng nên chưa thuộc khu nào — huấn luyện viên chưa lập giáo án được, và nhân viên chăm
          sóc chưa nhận được việc hằng ngày.
        </div>
      )}

      {horse.representativeName === null && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Chưa có chủ đại diện — không duyệt được đăng ký thi đấu.
        </div>
      )}

      {action.error && !action.field && (
        <div className="mt-4">
          <ErrorBox message={action.error} />
        </div>
      )}

      {/* Xếp hoặc chuyển ô chuồng */}
      <Modal
        open={stallOpen}
        onClose={() => setStallOpen(false)}
        title={horse.stallCode ? `Chuyển ô chuồng — ${horse.name}` : `Xếp ${horse.name} vào ô chuồng`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setStallOpen(false)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() =>
                  assignStall({
                    horseId: horse.id,
                    stallId: stallForm.stallId,
                    groomId: stallForm.groomId || undefined,
                    reason: stallForm.reason,
                  }),
                );
                if (done !== undefined) {
                  setStallOpen(false);
                  setStallForm({ stallId: '', groomId: '', reason: '' });
                  stalls.reload();
                  onChanged();
                }
              }}
              disabled={action.pending || !stallForm.stallId}
            >
              {action.pending ? 'Đang lưu…' : 'Xác nhận'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Ô chuồng" required error={action.field === 'stallId' ? action.error : undefined}>
            <Select value={stallForm.stallId} onChange={(event) => setStallForm({ ...stallForm, stallId: event.target.value })}>
              <option value="">Chọn ô còn trống</option>
              {stalls.data?.map((stall) => (
                <option key={stall.id} value={stall.id}>
                  {stall.zoneName} · {stall.code} ({stallTypeLabel[stall.type as keyof typeof stallTypeLabel]})
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Nhân viên chăm sóc"
            hint={horse.groomName ? 'Để trống nếu giữ nguyên người đang phụ trách' : 'Mỗi ngựa cần đúng một người phụ trách'}
          >
            <Select value={stallForm.groomId} onChange={(event) => setStallForm({ ...stallForm, groomId: event.target.value })}>
              <option value="">{horse.groomName ? `Giữ nguyên — ${horse.groomName}` : 'Chưa phân công'}</option>
              {grooms.data?.map((groom) => (
                <option key={groom.id} value={groom.id}>
                  {groom.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lý do">
            <Textarea value={stallForm.reason} onChange={(event) => setStallForm({ ...stallForm, reason: event.target.value })} />
          </Field>
          {horse.healthStatus === 'QUARANTINED' && (
            <p className="rounded-xl bg-purple-50 p-3 text-sm text-purple-800">
              Ngựa đang cách ly nên bắt buộc phải ở ô loại cách ly.
            </p>
          )}
        </div>
      </Modal>

      {/* Phí nuôi dưỡng */}
      <Modal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        title={`Phí nuôi dưỡng — ${horse.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRateOpen(false)}>
              Quay lại
            </Button>
            <Button
              onClick={async () => {
                const done = await action.run(() =>
                  setHorseDailyRate(
                    horse.id,
                    rateForm.useDefault ? undefined : Number(rateForm.value),
                    rateForm.reason,
                  ),
                );
                if (done !== undefined) {
                  setRateOpen(false);
                  onChanged();
                }
              }}
              disabled={action.pending}
            >
              {action.pending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">
            Chi phí nuôi dưỡng không sinh từng dòng mỗi ngày. Báo cáo tính khi đọc: số ngày trong kỳ × phí theo ngày
            của con ngựa.
          </p>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3">
            <input
              type="radio"
              checked={rateForm.useDefault}
              onChange={() => setRateForm({ ...rateForm, useDefault: true })}
              className="mt-1 h-4 w-4 accent-emerald-600"
            />
            <span>
              <span className="block text-sm font-medium text-gray-800">Dùng mức mặc định của câu lạc bộ</span>
              <span className="block text-xs text-gray-400">
                Hiện là {formatMoney(horse.clubDefaultDailyRate)}/ngày. Đổi mức mặc định ở Quản trị → Công cụ hệ thống.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3">
            <input
              type="radio"
              checked={!rateForm.useDefault}
              onChange={() => setRateForm({ ...rateForm, useDefault: false })}
              className="mt-1 h-4 w-4 accent-emerald-600"
            />
            <span className="flex-1">
              <span className="block text-sm font-medium text-gray-800">Đặt mức riêng cho con ngựa này</span>
              <span className="mt-2 block">
                <Input
                  type="number"
                  min={1}
                  step={100000}
                  disabled={rateForm.useDefault}
                  value={rateForm.value}
                  onChange={(event) => setRateForm({ ...rateForm, value: event.target.value, useDefault: false })}
                  placeholder="1500000"
                />
              </span>
            </span>
          </label>

          <Field label="Lý do" error={action.field === 'value' ? action.error : undefined}>
            <Textarea value={rateForm.reason} onChange={(event) => setRateForm({ ...rateForm, reason: event.target.value })} />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}
