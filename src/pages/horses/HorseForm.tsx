// F1.2 / F1.4 — tạo và sửa hồ sơ ngựa. CM sửa mọi trường định danh; HT chỉ sửa sở trường cự ly.
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, CircleDashed, Info, Lock, X } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import {
  createHorse,
  getHorse,
  listOwnerAccounts,
  listParentOptions,
  listZoneOptions,
  updateHorse,
  type HorseInput,
} from '../../services/horse.service';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import {
  Avatar,
  Button,
  Card,
  ErrorBox,
  Field,
  Input,
  Notice,
  NotFound,
  PageHeader,
  SectionTitle,
  Select,
  Skeleton,
  cn,
  useToast,
} from '../../components/ui';
import { distanceHint, distanceLabel, lifecycleLabel, sexLabel } from '../../lib/labels';
import { formatDate, toDateKey } from '../../lib/format';
import { now } from '../../lib/clock';
import { links } from '../../lib/links';
import type { DistancePreference, HorseSex } from '../../types/domain';
import AvatarPicker from './components/AvatarPicker';

interface FormState {
  name: string;
  sex: HorseSex | '';
  breed: string;
  color: string;
  birthDate: string;
  chipNumber: string;
  distancePreference: DistancePreference | '';
  sireId: string;
  damId: string;
  ownerId: string;
  avatar?: string;
  zoneId: string;
}

const EMPTY: FormState = {
  name: '',
  sex: '',
  breed: 'Thoroughbred',
  color: '',
  birthDate: '',
  chipNumber: '',
  distancePreference: '',
  sireId: '',
  damId: '',
  ownerId: '',
  avatar: undefined,
  zoneId: '',
};

function CheckLine({ ok, children, optional }: { ok: boolean | undefined; children: ReactNode; optional?: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span
        className={cn(
          'mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full',
          ok === undefined ? 'text-gray-300' : ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600',
        )}
      >
        {ok === undefined ? <CircleDashed size={14} /> : ok ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
      </span>
      <span className={cn(ok === false ? 'text-red-600' : 'text-gray-600', optional && ok === undefined && 'text-gray-400')}>{children}</span>
    </li>
  );
}

export default function HorseForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const user = useStore((state) => state.currentUser);
  const action = useAction();

  const detail = useService(() => (id ? getHorse(id) : Promise.resolve(undefined)), [id]);
  const horse = detail.data;
  const isManager = editing ? !!horse?.canEditIdentity : can(user, 'horse.create');
  const preferenceOnly = editing && !isManager && !!horse?.canEditPreference;

  const sires = useService(() => (isManager ? listParentOptions('sire', id) : Promise.resolve([])), [isManager, id]);
  const dams = useService(() => (isManager ? listParentOptions('dam', id) : Promise.resolve([])), [isManager, id]);
  const owners = useService(() => (isManager ? listOwnerAccounts() : Promise.resolve([])), [isManager]);
  const zones = useService(() => (isManager && !editing ? listZoneOptions() : Promise.resolve([])), [isManager, editing]);

  const [form, setForm] = useState<FormState>(EMPTY);
  // Nạp hồ sơ vào biểu mẫu một lần cho mỗi phiên bản hồ sơ (điều chỉnh state ngay khi render).
  const [loadedKey, setLoadedKey] = useState<string>();
  const horseKey = horse ? `${horse.id}:${horse.version}` : undefined;
  if (horse && horseKey !== loadedKey) {
    setLoadedKey(horseKey);
    setForm({
      name: horse.name,
      sex: horse.sex,
      breed: horse.breed ?? '',
      color: horse.color ?? '',
      birthDate: horse.birthDate ?? '',
      chipNumber: horse.chipNumber ?? '',
      distancePreference: horse.distancePreference ?? '',
      sireId: horse.sireId ?? '',
      damId: horse.damId ?? '',
      ownerId: horse.owner?.id ?? '',
      avatar: horse.avatar,
      zoneId: '',
    });
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (action.field === key) action.clearError();
  };
  const err = (key: string) => (action.field === key ? action.error : undefined);

  // Kiểm tra nhanh phía giao diện — service vẫn kiểm lại đầy đủ.
  const checks = useMemo(() => {
    const today = toDateKey(now());
    const sire = sires.data?.find((item) => item.id === form.sireId);
    const dam = dams.data?.find((item) => item.id === form.damId);
    const parentBirthOk =
      !form.birthDate ||
      [sire, dam].every((parent) => !parent?.birthDate || parent.birthDate < form.birthDate);
    const zone = zones.data?.find((item) => item.id === form.zoneId);
    return {
      name: form.name.trim().length > 0,
      sex: !!form.sex,
      birth: form.birthDate ? form.birthDate <= today : undefined,
      chip: form.chipNumber ? /^[0-9A-Za-z-]{6,20}$/.test(form.chipNumber.trim()) : undefined,
      parents:
        form.sireId || form.damId ? parentBirthOk && (!form.sireId || form.sireId !== form.damId) : undefined,
      zone: form.zoneId ? !!zone?.available : undefined,
      zoneName: zone?.name,
      zoneFree: zone?.free,
    };
  }, [form, sires.data, dams.data, zones.data]);

  if (editing && detail.loading) return <Skeleton rows={6} />;
  if (editing && (detail.error || !horse)) return <NotFound message={detail.error} />;
  if (!editing && !can(user, 'horse.create')) return <NotFound message="Chỉ Quản lý câu lạc bộ được tạo hồ sơ ngựa." />;
  if (editing && horse && (horse.readOnly || (!isManager && !preferenceOnly))) {
    return (
      <div className="space-y-6">
        <PageHeader title={`Sửa hồ sơ ${horse.name}`} />
        <Notice tone="warning" icon={<Lock size={16} />}>
          {horse.readOnly
            ? 'Hồ sơ đã chuyển nhượng hoặc đã xóa nên chỉ xem được.'
            : 'Bạn không có quyền sửa hồ sơ con ngựa này (ngoài phạm vi khu bạn phụ trách).'}{' '}
          <Link to={links.horse(horse.id)} className="font-semibold underline">
            Quay lại hồ sơ
          </Link>
        </Notice>
      </div>
    );
  }

  const disabledIdentity = preferenceOnly;
  const submit = async () => {
    if (!editing) {
      const input: HorseInput = { ...form, sex: form.sex || undefined };
      const created = await action.run(() => createHorse(input));
      if (created) {
        toast.push(`Đã tạo hồ sơ ${form.name.trim()}`, 'success');
        navigate(links.horse(created.id));
      }
      return;
    }
    if (!horse) return;
    const input: HorseInput & { version: number } = preferenceOnly
      ? { distancePreference: form.distancePreference, version: horse.version }
      : {
          name: form.name,
          sex: form.sex || undefined,
          breed: form.breed,
          color: form.color,
          birthDate: form.birthDate,
          chipNumber: form.chipNumber,
          distancePreference: form.distancePreference,
          sireId: form.sireId,
          damId: form.damId,
          ownerId: form.ownerId,
          avatar: form.avatar ?? '',
          version: horse.version,
        };
    const saved = await action.run(() => updateHorse(horse.id, input));
    if (saved) {
      toast.push('Đã lưu hồ sơ', 'success');
      navigate(links.horse(horse.id));
    }
  };

  const ownerMissing = horse?.owner && !(owners.data ?? []).some((item) => item.id === horse.owner?.id);
  const lockedNote = disabledIdentity ? 'Chỉ Quản lý câu lạc bộ sửa được' : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <button
            type="button"
            onClick={() => navigate(editing && horse ? links.horse(horse.id) : links.horses)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-emerald-700"
          >
            <ArrowLeft size={15} /> {editing ? 'Về hồ sơ' : 'Danh sách ngựa'}
          </button>
        }
        title={editing ? `Sửa hồ sơ ${horse?.name ?? ''}` : 'Thêm ngựa mới'}
        description={
          preferenceOnly
            ? 'Huấn luyện viên trưởng chỉ cập nhật sở trường cự ly cho ngựa trong khu mình phụ trách.'
            : editing
              ? 'Cập nhật thông tin định danh, phả hệ và chủ sở hữu. Đổi khu làm ở sơ đồ chuồng.'
              : 'Bắt buộc tên và giới tính. Các trường khác có thể bổ sung sau.'
        }
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {preferenceOnly && (
            <Notice tone="info" icon={<Info size={16} />}>
              Các trường định danh, phả hệ và chủ sở hữu đang khóa với vai trò của bạn — chỉ Quản lý câu lạc bộ sửa được.
            </Notice>
          )}

          <Card>
            <SectionTitle>Ảnh và định danh</SectionTitle>
            <div className="space-y-5">
              {isManager && (
                <AvatarPicker value={form.avatar} name={form.name} onChange={(value) => set('avatar', value)} />
              )}
              <div className="grid gap-4 sm:grid-cols-6">
                <Field label="Tên ngựa" required error={err('name')} className="sm:col-span-4" hint={lockedNote}>
                  <Input value={form.name} disabled={disabledIdentity} maxLength={60} onChange={(event) => set('name', event.target.value)} placeholder="Ví dụ: Tia Chớp" />
                </Field>
                <Field label="Giới tính" required error={err('sex')} className="sm:col-span-2">
                  <Select value={form.sex} disabled={disabledIdentity} onChange={(event) => set('sex', event.target.value as HorseSex)}>
                    <option value="">— Chọn —</option>
                    {(Object.keys(sexLabel) as HorseSex[]).map((item) => (
                      <option key={item} value={item}>
                        {sexLabel[item]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Giống" className="sm:col-span-2">
                  <Input value={form.breed} disabled={disabledIdentity} onChange={(event) => set('breed', event.target.value)} />
                </Field>
                <Field label="Màu lông" className="sm:col-span-2">
                  <Input value={form.color} disabled={disabledIdentity} onChange={(event) => set('color', event.target.value)} placeholder="Nâu hạt dẻ" />
                </Field>
                <Field label="Ngày sinh" error={err('birthDate')} className="sm:col-span-2">
                  <Input type="date" value={form.birthDate} max={toDateKey(now())} disabled={disabledIdentity} onChange={(event) => set('birthDate', event.target.value)} />
                </Field>
                <Field
                  label="Số chip"
                  error={err('chipNumber')}
                  className="sm:col-span-3"
                  hint="Duy nhất trong toàn bộ hồ sơ, kể cả hồ sơ đã xóa hoặc đã chuyển nhượng"
                >
                  <Input value={form.chipNumber} disabled={disabledIdentity} className="font-mono" onChange={(event) => set('chipNumber', event.target.value)} placeholder="704098100000014" />
                </Field>
              </div>
            </div>
          </Card>

          <Card className={cn(preferenceOnly && 'ring-2 ring-emerald-400/60')}>
            <SectionTitle>Sở trường cự ly</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-4">
              {([['', 'Chưa xác định', 'Để trống'], ...(Object.keys(distanceLabel) as DistancePreference[]).map((key) => [key, distanceLabel[key], distanceHint[key]])] as [string, string, string][]).map(
                ([value, label, hint]) => (
                  <button
                    key={value || 'none'}
                    type="button"
                    onClick={() => set('distancePreference', value as DistancePreference | '')}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-left transition',
                      form.distancePreference === value
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/15'
                        : 'border-gray-200 bg-white hover:border-emerald-300',
                    )}
                  >
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">{hint}</p>
                  </button>
                ),
              )}
            </div>
            {err('distancePreference') && <p className="mt-2 text-xs font-medium text-red-600">{err('distancePreference')}</p>}
          </Card>

          {!preferenceOnly && (
            <Card>
              <SectionTitle>Phả hệ</SectionTitle>
              <p className="-mt-2 mb-4 text-sm font-light text-gray-500">
                Chỉ chọn ngựa có hồ sơ tại câu lạc bộ (kể cả đã giải nghệ, đã chuyển nhượng). Ngày sinh của cha mẹ phải trước ngày sinh của ngựa.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Cha" error={err('sireId')} hint="Ngựa đực hoặc đực đã thiến">
                  <Select value={form.sireId} onChange={(event) => set('sireId', event.target.value)}>
                    <option value="">— Không khai báo —</option>
                    {(sires.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.birthDate ? ` · ${new Date(item.birthDate).getFullYear()}` : ''}
                        {item.lifecycleStatus !== 'ACTIVE' ? ` · ${lifecycleLabel[item.lifecycleStatus]}` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Mẹ" error={err('damId')} hint="Ngựa cái">
                  <Select value={form.damId} onChange={(event) => set('damId', event.target.value)}>
                    <option value="">— Không khai báo —</option>
                    {(dams.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.birthDate ? ` · ${new Date(item.birthDate).getFullYear()}` : ''}
                        {item.lifecycleStatus !== 'ACTIVE' ? ` · ${lifecycleLabel[item.lifecycleStatus]}` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>
          )}

          {!preferenceOnly && (
            <Card>
              <SectionTitle>{editing ? 'Chủ sở hữu' : 'Chủ sở hữu và khu chuồng'}</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Chủ sở hữu" error={err('ownerId')} hint="Một chủ duy nhất, tài khoản Chủ ngựa đang hoạt động">
                  <Select value={form.ownerId} onChange={(event) => set('ownerId', event.target.value)}>
                    <option value="">— Để trống —</option>
                    {ownerMissing && horse?.owner && (
                      <option value={horse.owner.id}>
                        {horse.owner.name} (tài khoản {horse.owner.active ? 'không còn vai trò Chủ ngựa' : 'đang bị khóa'})
                      </option>
                    )}
                    {(owners.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.email}
                      </option>
                    ))}
                  </Select>
                </Field>
                {!editing && (
                  <Field
                    label="Khu chuồng"
                    error={err('zoneId')}
                    hint="Có thể để trống — ngựa vào danh sách Chờ xếp khu. Ô và Groom do HT của khu xếp sau."
                  >
                    <Select value={form.zoneId} onChange={(event) => set('zoneId', event.target.value)}>
                      <option value="">— Chưa xếp khu —</option>
                      {(zones.data ?? []).map((item) => (
                        <option key={item.id} value={item.id} disabled={!item.available}>
                          {item.name} · chỗ trống {Math.max(0, item.free)}
                          {item.reason ? ` — ${item.reason.toLowerCase()}` : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>
            </Card>
          )}
        </div>

        <aside className="lg:col-span-4">
          <div className="space-y-4 lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-2xl bg-linear-to-br from-emerald-800 to-emerald-950 p-5 text-white shadow-grass-lift">
              <div className="flex items-center gap-4">
                <Avatar src={form.avatar} name={form.name || '?'} size={72} className="rounded-2xl ring-2 ring-white/20" />
                <div className="min-w-0">
                  <div className="truncate text-xl font-bold">{form.name.trim() || 'Ngựa chưa đặt tên'}</div>
                  <p className="font-mono text-xs text-emerald-200/80">{form.chipNumber || 'chưa có chip'}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-lg bg-white/10 px-2 py-0.5">{form.sex ? sexLabel[form.sex] : 'Chưa chọn giới tính'}</span>
                {form.breed && <span className="rounded-lg bg-white/10 px-2 py-0.5">{form.breed}</span>}
                {form.birthDate && <span className="rounded-lg bg-white/10 px-2 py-0.5">Sinh {formatDate(form.birthDate)}</span>}
                {form.distancePreference && (
                  <span className="rounded-lg bg-emerald-400/20 px-2 py-0.5 text-emerald-100">{distanceLabel[form.distancePreference]}</span>
                )}
              </div>
              {!editing && (
                <p className="mt-4 border-t border-white/10 pt-3 text-sm text-emerald-100/90">
                  {checks.zoneName ? `Sẽ vào ${checks.zoneName} — chờ HT xếp ô và Groom` : 'Sẽ vào danh sách Chờ xếp khu'}
                </p>
              )}
            </div>

            <Card variant="flat">
              <p className="mb-3 text-sm font-semibold text-gray-800">Tóm tắt kiểm tra</p>
              <ul className="space-y-2">
                {preferenceOnly ? (
                  <CheckLine ok={true}>Chỉ trường sở trường cự ly được gửi đi</CheckLine>
                ) : (
                  <>
                    <CheckLine ok={checks.name}>Có tên ngựa</CheckLine>
                    <CheckLine ok={checks.sex}>Đã chọn giới tính</CheckLine>
                    <CheckLine ok={checks.birth} optional>
                      {checks.birth === false ? 'Ngày sinh đang ở tương lai' : 'Ngày sinh không ở tương lai'}
                    </CheckLine>
                    <CheckLine ok={checks.chip} optional>
                      {checks.chip === false ? 'Số chip gồm 6–20 ký tự chữ hoặc số' : 'Số chip đúng định dạng (trùng lặp kiểm khi lưu)'}
                    </CheckLine>
                    <CheckLine ok={checks.parents} optional>
                      {checks.parents === false ? 'Cha mẹ phải khác nhau và sinh trước ngựa' : 'Cha mẹ hợp lệ'}
                    </CheckLine>
                    {!editing && (
                      <CheckLine ok={checks.zone} optional>
                        {checks.zoneName ? `${checks.zoneName} còn ${Math.max(0, checks.zoneFree ?? 0)} chỗ trống` : 'Chưa chọn khu (không bắt buộc)'}
                      </CheckLine>
                    )}
                  </>
                )}
              </ul>
            </Card>

            {action.error && !action.field && <ErrorBox message={action.error} />}
            {action.error && action.field && (
              <Notice tone="danger">
                {action.error}
              </Notice>
            )}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={submit} disabled={action.pending || (!preferenceOnly && (!checks.name || !checks.sex))}>
                {action.pending ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo hồ sơ'}
              </Button>
              <Button variant="secondary" onClick={() => navigate(editing && horse ? links.horse(horse.id) : links.horses)}>
                Hủy
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
