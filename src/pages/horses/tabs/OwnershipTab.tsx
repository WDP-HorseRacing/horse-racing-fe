import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, Trash2, Users } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import { listOwnerAccounts, listOwnerships, saveOwnerships } from '../../../services/horse.service';
import { useStore } from '../../../store/store';
import { can } from '../../../auth/permissions';
import {
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  Pill,
  SectionTitle,
  Select,
  Skeleton,
} from '../../../components/ui';
import { formatDate } from '../../../lib/format';

interface Line {
  ownerId: string;
  percent: number;
  isRepresentative: boolean;
}

export default function OwnershipTab({ horseId }: { horseId: string }) {
  const currentUser = useStore((state) => state.currentUser);
  const editable = can(currentUser, 'ownership.edit');
  const { data, loading, reload } = useService(() => listOwnerships(horseId), [horseId]);
  const owners = useService(() => listOwnerAccounts(), []);
  const action = useAction();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    if (!open || !data) return;
    setLines(
      data.current.map((item) => ({
        ownerId: item.ownerId,
        percent: item.percent,
        isRepresentative: item.isRepresentative,
      })),
    );
  }, [open, data]);

  if (loading) return <Skeleton rows={3} />;
  if (!data) return <EmptyState title="Chưa có dữ liệu sở hữu" />;

  const total = lines.reduce((sum, line) => sum + (Number(line.percent) || 0), 0);
  const hasRepresentative = data.current.some((item) => item.isRepresentative);

  const submit = async () => {
    const done = await action.run(() => saveOwnerships(horseId, lines.filter((line) => line.ownerId)));
    if (done !== undefined) {
      setOpen(false);
      reload();
    }
  };

  return (
    <div className="space-y-5">
      {data.current.length > 0 && !hasRepresentative && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          Chưa có chủ đại diện — không duyệt được đăng ký thi đấu.
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle icon={<Users size={16} className="text-emerald-600" />}>Chủ sở hữu hiện tại</SectionTitle>
          {editable && (
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
              {data.current.length > 0 ? 'Chuyển nhượng / sửa tỉ lệ' : 'Gán chủ sở hữu'}
            </Button>
          )}
        </div>

        {data.current.length === 0 ? (
          <EmptyState title="Ngựa chưa có chủ sở hữu" hint="Quản lý câu lạc bộ có thể gán chủ sở hữu cho ngựa này." />
        ) : (
          <div className="space-y-2">
            {data.current.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold text-gray-900">
                    {item.ownerName}
                    {item.isRepresentative && <Pill tone="green">Chủ đại diện</Pill>}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {item.email ? `${item.email} · ${item.phone}` : 'Liên hệ chỉ hiển thị cho quản lý và chính chủ'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900 tabular-nums">{item.percent}%</p>
                  <p className="text-xs text-gray-400">từ {formatDate(item.startDate)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {data.history.length > 0 && (
        <Card>
          <SectionTitle>Lịch sử sở hữu</SectionTitle>
          <div className="space-y-2">
            {data.history.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 border-b border-gray-50 py-2.5 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.ownerName}</p>
                  <p className="text-xs text-gray-400">
                    {formatDate(item.startDate)} → {formatDate(item.endDate)}
                  </p>
                </div>
                <span className="text-sm text-gray-500 tabular-nums">{item.percent}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cập nhật quyền sở hữu"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Quay lại
            </Button>
            <Button onClick={submit} disabled={action.pending}>
              {action.pending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">
            Bản ghi sở hữu cũ không bị sửa. Hệ thống đóng bản ghi đang mở vào hôm nay rồi tạo bản ghi mới cho
            danh sách bên dưới.
          </p>

          {lines.map((line, index) => (
            <div key={index} className="flex flex-wrap items-end gap-3 rounded-xl bg-gray-50 p-3">
              <Field label="Chủ sở hữu" className="min-w-[160px] flex-1">
                <Select
                  value={line.ownerId}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, position) =>
                        position === index ? { ...item, ownerId: event.target.value } : item,
                      ),
                    )
                  }
                >
                  <option value="">Chọn người</option>
                  {owners.data?.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tỉ lệ %" className="w-24">
                <Input
                  type="number"
                  value={line.percent}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((item, position) =>
                        position === index ? { ...item, percent: Number(event.target.value) } : item,
                      ),
                    )
                  }
                />
              </Field>
              <label className="flex h-11 cursor-pointer items-center gap-2 text-sm text-gray-600">
                <input
                  type="radio"
                  name="rep"
                  checked={line.isRepresentative}
                  onChange={() =>
                    setLines((current) =>
                      current.map((item, position) => ({ ...item, isRepresentative: position === index })),
                    )
                  }
                  className="h-4 w-4 accent-emerald-600"
                />
                Đại diện
              </label>
              <button
                onClick={() => setLines((current) => current.filter((_, position) => position !== index))}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setLines((current) => [...current, { ownerId: '', percent: 0, isRepresentative: current.length === 0 }])
              }
            >
              <Plus size={14} /> Thêm dòng
            </Button>
            {lines.length > 0 && (
              <span className={`text-sm font-semibold ${total === 100 ? 'text-emerald-600' : 'text-red-600'}`}>
                Tổng: {total}%
              </span>
            )}
          </div>

          {action.error && <ErrorBox message={action.error} />}
        </div>
      </Modal>
    </div>
  );
}
