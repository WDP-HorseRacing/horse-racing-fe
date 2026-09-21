import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import {
  createHorse,
  getHorse,
  listFreeStalls,
  listGrooms,
  listHorseOptions,
  listHorses,
  listOwnerAccounts,
  updateHorse,
} from '../../services/horse.service';
import {
  Button,
  Card,
  ErrorBox,
  Field,
  Input,
  PageHeader,
  Reveal,
  SectionTitle,
  Select,
  Skeleton,
} from '../../components/ui';
import { distanceHint, distanceLabel, sexLabel, stallTypeLabel } from '../../lib/labels';
import { toDateKey } from '../../lib/format';
import { now } from '../../lib/clock';
import type { DistancePreference, HorseSex } from '../../types/domain';

interface OwnerLine {
  ownerId: string;
  percent: number;
  isRepresentative: boolean;
}

export default function HorseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const detail = useService(() => (id ? getHorse(id) : Promise.resolve(undefined)), [id]);
  const stalls = useService(() => listFreeStalls(), []);
  const grooms = useService(() => listGrooms(), []);
  const owners = useService(() => listOwnerAccounts(), []);
  const horseOptions = useService(() => listHorseOptions(), []);
  // Cả hồ sơ đã xóa và ngựa tham chiếu, để kiểm trùng số chip ngay khi gõ.
  const allHorses = useService(() => listHorses({ includeDeleted: true, includeReference: true }), []);
  const action = useAction();

  const [form, setForm] = useState({
    name: '',
    sex: 'MALE' as HorseSex,
    breed: 'Thoroughbred',
    color: '',
    birthDate: '',
    chipNumber: '',
    distancePreference: '' as DistancePreference | '',
    sireId: '',
    damId: '',
    stallId: '',
    groomId: '',
  });
  const [ownerLines, setOwnerLines] = useState<OwnerLine[]>([]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!detail.data) return;
    setForm({
      name: detail.data.name,
      sex: detail.data.sex,
      breed: detail.data.breed ?? '',
      color: detail.data.color ?? '',
      birthDate: detail.data.birthDate ?? '',
      chipNumber: detail.data.chipNumber ?? '',
      distancePreference: detail.data.distancePreference ?? '',
      sireId: detail.data.sireId ?? '',
      damId: detail.data.damId ?? '',
      stallId: '',
      groomId: '',
    });
  }, [detail.data]);

  const identityLocked = isEdit && !detail.data?.canEditIdentity;
  const totalPercent = ownerLines.reduce((sum, line) => sum + (Number(line.percent) || 0), 0);

  /**
   * Kiểm tra ngay tại ô nhập, chạy song song với kiểm tra ở tầng dịch vụ.
   * Đây chỉ là lớp phản hồi sớm cho người dùng — tầng dịch vụ vẫn là nơi quyết định cuối cùng.
   */
  const errors = useMemo(() => {
    const found: Record<string, string> = {};
    const todayKey = toDateKey(now());

    if (!form.name.trim()) found.name = 'Vui lòng nhập tên ngựa';
    if (form.birthDate && form.birthDate > todayKey) found.birthDate = 'Ngày sinh không được ở tương lai';

    if (form.chipNumber.trim()) {
      if (!/^\d+$/.test(form.chipNumber.trim())) {
        found.chipNumber = 'Số chip chỉ gồm chữ số';
      } else {
        const clash = allHorses.data?.find(
          (item) => item.chipNumber === form.chipNumber.trim() && item.id !== id,
        );
        if (clash) found.chipNumber = `Số chip đã được dùng cho hồ sơ "${clash.name}"`;
      }
    }

    const parentOf = (horseId: string) => allHorses.data?.find((item) => item.id === horseId);
    if (form.sireId && form.damId && form.sireId === form.damId) {
      found.damId = 'Bố và mẹ phải là hai con ngựa khác nhau';
    }
    if (form.sireId && form.birthDate) {
      const sire = parentOf(form.sireId);
      if (sire?.birthDate && sire.birthDate >= form.birthDate) found.sireId = 'Ngựa bố phải sinh trước con';
    }
    if (form.damId && form.birthDate) {
      const dam = parentOf(form.damId);
      if (dam?.birthDate && dam.birthDate >= form.birthDate) found.damId = 'Ngựa mẹ phải sinh trước con';
    }

    if (!isEdit && ownerLines.length > 0) {
      const filled = ownerLines.filter((line) => line.ownerId);
      if (filled.length !== ownerLines.length) {
        found.owners = 'Còn dòng chưa chọn người sở hữu';
      } else if (new Set(filled.map((line) => line.ownerId)).size !== filled.length) {
        found.owners = 'Một người chỉ được xuất hiện một lần';
      } else if (totalPercent !== 100) {
        found.owners =
          totalPercent < 100
            ? `Tổng tỉ lệ sở hữu còn thiếu ${100 - totalPercent}%`
            : `Tổng tỉ lệ sở hữu đang vượt ${totalPercent - 100}%`;
      } else if (filled.filter((line) => line.isRepresentative).length !== 1) {
        found.owners = 'Phải chọn đúng một chủ đại diện';
      }
    }

    return found;
  }, [form, ownerLines, totalPercent, allHorses.data, isEdit, id]);

  /** Chỉ hiện lỗi của ô người dùng đã chạm vào, hoặc sau khi bấm Lưu. */
  const visibleError = (field: string) =>
    (action.field === field ? action.error : undefined) ??
    (touched[field] || submitted ? errors[field] : undefined);

  const markTouched = (field: string) => setTouched((current) => ({ ...current, [field]: true }));

  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const submit = async (keepOpen = false) => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    if (isEdit) {
      const saved = await action.run(() =>
        updateHorse(id!, {
          name: form.name,
          sex: form.sex,
          breed: form.breed,
          color: form.color,
          birthDate: form.birthDate,
          chipNumber: form.chipNumber,
          distancePreference: form.distancePreference || undefined,
          version: detail.data!.version,
        }),
      );
      if (saved) navigate(`/horses/${id}`);
      return;
    }

    const created = await action.run(() =>
      createHorse({
        name: form.name,
        sex: form.sex,
        breed: form.breed,
        color: form.color,
        birthDate: form.birthDate || undefined,
        chipNumber: form.chipNumber || undefined,
        distancePreference: form.distancePreference || undefined,
        sireId: form.sireId || undefined,
        damId: form.damId || undefined,
        stallId: form.stallId || undefined,
        groomId: form.groomId || undefined,
        owners: ownerLines.filter((line) => line.ownerId),
      }),
    );
    if (!created) return;
    if (keepOpen) {
      setForm({
        name: '',
        sex: 'MALE',
        breed: 'Thoroughbred',
        color: '',
        birthDate: '',
        chipNumber: '',
        distancePreference: '',
        sireId: '',
        damId: '',
        stallId: '',
        groomId: '',
      });
      setOwnerLines([]);
      setTouched({});
      setSubmitted(false);
      stalls.reload();
    } else {
      navigate(`/horses/${created.id}`);
    }
  };

  if (isEdit && detail.loading) return <Skeleton rows={6} />;


  const males = horseOptions.data?.filter((horse) => horse.sex !== 'FEMALE') ?? [];
  const females = horseOptions.data?.filter((horse) => horse.sex === 'FEMALE') ?? [];

  return (
    <Reveal className="space-y-6 pb-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-medium text-gray-400 transition hover:text-gray-600"
      >
        <ArrowLeft size={16} /> Quay lại
      </button>

      <div data-reveal>
        <PageHeader
          title={isEdit ? `Sửa hồ sơ ${detail.data?.name}` : 'Thêm ngựa mới'}
          description={
            identityLocked
              ? 'Bạn chỉ sửa được sở trường cự ly của ngựa trong khu phụ trách.'
              : 'Hồ sơ mới luôn bắt đầu ở trạng thái Đủ điều kiện và Đang hoạt động.'
          }
        />
      </div>

      {submitted && Object.keys(errors).length > 0 && (
        <ErrorBox
          message={`Còn ${Object.keys(errors).length} ô chưa hợp lệ: ${Object.values(errors).join(' · ')}`}
        />
      )}
      {action.error && !action.field && <ErrorBox message={action.error} />}

      <div data-reveal>
        <Card>
          <SectionTitle>Thông tin cơ bản</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên ngựa" required error={visibleError('name')}>
              <Input
                value={form.name}
                disabled={identityLocked}
                onChange={(event) => set({ name: event.target.value })}
                onBlur={() => markTouched('name')}
                placeholder="Ví dụ: Tia Chớp"
              />
            </Field>
            <Field label="Giới tính" required error={visibleError('sex')}>
              <Select
                value={form.sex}
                disabled={identityLocked}
                onChange={(event) => set({ sex: event.target.value as HorseSex })}
              >
                {Object.entries(sexLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Giống" error={visibleError('breed')}>
              <Input value={form.breed} disabled={identityLocked} onChange={(event) => set({ breed: event.target.value })} />
            </Field>
            <Field label="Màu lông" error={visibleError('color')}>
              <Input
                value={form.color}
                disabled={identityLocked}
                onChange={(event) => set({ color: event.target.value })}
                placeholder="Ví dụ: Nâu hạt dẻ"
              />
            </Field>
            <Field label="Ngày sinh" error={visibleError('birthDate')} hint="Không được chọn ngày ở tương lai">
              <Input
                type="date"
                max={toDateKey(now())}
                value={form.birthDate}
                disabled={identityLocked}
                onChange={(event) => set({ birthDate: event.target.value })}
                onBlur={() => markTouched('birthDate')}
              />
            </Field>
            <Field
              label="Số chip định danh"
              error={visibleError('chipNumber')}
              hint="Không được trùng với bất kỳ hồ sơ nào, kể cả hồ sơ đã xóa"
            >
              <Input
                value={form.chipNumber}
                inputMode="numeric"
                maxLength={20}
                disabled={identityLocked}
                onChange={(event) => set({ chipNumber: event.target.value })}
                onBlur={() => markTouched('chipNumber')}
                placeholder="704098100000012"
              />
            </Field>
            <Field label="Sở trường cự ly" className="sm:col-span-2">
              <Select
                value={form.distancePreference}
                onChange={(event) => set({ distancePreference: event.target.value as DistancePreference })}
              >
                <option value="">Chưa xác định</option>
                {Object.entries(distanceLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label} ({distanceHint[value as DistancePreference]})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>
      </div>

      {!isEdit && (
        <>
          <div data-reveal>
            <Card>
              <SectionTitle>Phả hệ (không bắt buộc)</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ngựa bố" error={visibleError('sireId')} hint="Chỉ chọn được ngựa đực hoặc đực đã thiến">
                  <Select value={form.sireId} onChange={(event) => set({ sireId: event.target.value })}
                onBlur={() => markTouched('sireId')}>
                    <option value="">Chưa khai báo</option>
                    {males.map((horse) => (
                      <option key={horse.id} value={horse.id}>
                        {horse.name} {horse.isReference ? '(tham chiếu)' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Ngựa mẹ" error={visibleError('damId')} hint="Chỉ chọn được ngựa cái">
                  <Select value={form.damId} onChange={(event) => set({ damId: event.target.value })}
                onBlur={() => markTouched('damId')}>
                    <option value="">Chưa khai báo</option>
                    {females.map((horse) => (
                      <option key={horse.id} value={horse.id}>
                        {horse.name} {horse.isReference ? '(tham chiếu)' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>
          </div>

          <div data-reveal>
            <Card>
              <SectionTitle>Ô chuồng và nhân viên chăm sóc (không bắt buộc)</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ô chuồng" error={visibleError('stallId')}>
                  <Select value={form.stallId} onChange={(event) => set({ stallId: event.target.value })}>
                    <option value="">Chưa xếp chuồng</option>
                    {stalls.data?.map((stall) => (
                      <option key={stall.id} value={stall.id}>
                        {stall.zoneName} · {stall.code} ({stallTypeLabel[stall.type as never]})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Nhân viên chăm sóc">
                  <Select value={form.groomId} onChange={(event) => set({ groomId: event.target.value })}>
                    <option value="">Chưa phân công</option>
                    {grooms.data?.map((groom) => (
                      <option key={groom.id} value={groom.id}>
                        {groom.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>
          </div>

          <div data-reveal>
            <Card>
              <SectionTitle>Chủ sở hữu (không bắt buộc)</SectionTitle>
              <div className="space-y-3">
                {ownerLines.map((line, index) => (
                  <div key={index} className="flex flex-wrap items-end gap-3 rounded-xl bg-gray-50 p-3">
                    <Field label="Chủ sở hữu" className="min-w-[180px] flex-1">
                      <Select
                        value={line.ownerId}
                        onChange={(event) =>
                          setOwnerLines((current) =>
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
                    <Field label="Tỉ lệ %" className="w-28">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={line.percent}
                        onChange={(event) =>
                          setOwnerLines((current) =>
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
                        name="representative"
                        checked={line.isRepresentative}
                        onChange={() =>
                          setOwnerLines((current) =>
                            current.map((item, position) => ({ ...item, isRepresentative: position === index })),
                          )
                        }
                        className="h-4 w-4 accent-emerald-600"
                      />
                      Chủ đại diện
                    </label>
                    <button
                      onClick={() => setOwnerLines((current) => current.filter((_, position) => position !== index))}
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setOwnerLines((current) => [
                        ...current,
                        { ownerId: '', percent: 0, isRepresentative: current.length === 0 },
                      ])
                    }
                  >
                    <Plus size={14} /> Thêm chủ sở hữu
                  </Button>
                  {ownerLines.length > 0 && (
                    <span
                      className={`text-sm font-semibold ${totalPercent === 100 ? 'text-emerald-600' : 'text-red-600'}`}
                    >
                      Tổng tỉ lệ: {totalPercent}%
                      {totalPercent !== 100 &&
                        (totalPercent < 100 ? ` — còn thiếu ${100 - totalPercent}%` : ` — vượt ${totalPercent - 100}%`)}
                    </span>
                  )}
                </div>
                {visibleError('owners') && (
                  <p className="text-sm font-medium text-red-600">{visibleError('owners')}</p>
                )}
              </div>
            </Card>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-3" data-reveal>
        <Button onClick={() => submit(false)} disabled={action.pending}>
          <Save size={16} /> {action.pending ? 'Đang lưu…' : 'Lưu'}
        </Button>
        {!isEdit && (
          <Button variant="secondary" onClick={() => submit(true)} disabled={action.pending}>
            Lưu và thêm tiếp
          </Button>
        )}
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Hủy
        </Button>
      </div>
    </Reveal>
  );
}
