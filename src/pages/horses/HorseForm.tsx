// F1.2 / F1.4 — tạo và sửa hồ sơ ngựa. CM sửa định danh, phả hệ, chủ, ảnh; HT chỉ sửa sở trường cự ly.
// Quyền theo từng con ngựa lấy từ /horses/:id/permissions; backend kiểm lại khi lưu.
// Kiểm tra ngay tại ô: lỗi chỉ hiện khi rời ô hoặc bấm lưu, nằm dưới đúng ô gây lỗi; không ghi luật nghiệp vụ
// thành chú thích. Ô chọn cha mẹ chỉ liệt kê ngựa hợp lệ thay vì để chọn sai rồi báo lỗi.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Info, Lock, MapPinned, RefreshCw } from 'lucide-react';
import { useAction, useService } from '../../hooks/useService';
import { createHorse, getHorse, getPermissions, getPhotoUrl, listAllHorses, listHorses, updateHorse } from '../../api/horses';
import { listBarns } from '../../api/stable';
import { listAllUsers } from '../../api/users';
import { uploadHorsePhoto } from '../../api/media';
import type { CreateHorseInput, Gender, HorseListItem, RaceAptitude, UpdateHorseInput } from '../../api/types';
import { useStore } from '../../store/store';
import { can } from '../../auth/permissions';
import { useCrumbs } from '../../components/Breadcrumb';
import {
  Button,
  Card,
  CharCount,
  ErrorBox,
  Field,
  Input,
  Notice,
  NotFound,
  PageHeader,
  Pill,
  SectionTitle,
  Select,
  Skeleton,
  cn,
  invalidClass,
  scrollToFirstError,
  useToast,
} from '../../components/ui';
import { distanceHint, distanceLabel, lifecycleLabel, sexLabel } from '../../lib/labels';
import { fieldFromMessage } from '../../lib/errors';
import { formatDate, toDateKey } from '../../lib/format';
import { now } from '../../lib/clock';
import { links } from '../../lib/links';
import { BREEDS, COLORS, breedLabel, breedText, canonical, colorLabel, colorText, isPreset, optionText, type HorseOption } from '../../lib/horse-options';
import { PhotoDropzone } from './components/PhotoDropzone';
import { PedigreeMini } from './components/PedigreeMini';
import { DatePicker } from '../../components/ui/DatePicker';
import { TurfPlaceholder } from '../../components/TurfPlaceholder';
import { barnBlocker } from '../stable/components/barn';

interface FormState {
  name: string;
  gender: Gender | '';
  breed: string;
  color: string;
  dateOfBirth: string;
  microchipId: string;
  raceAptitude: RaceAptitude | '';
  sireId: string;
  damId: string;
  ownerId: string;
  barnId: string;
}
type FieldKey = keyof FormState | 'mediaId';

const EMPTY: FormState = {
  name: '',
  gender: '',
  breed: 'Thoroughbred',
  color: '',
  dateOfBirth: '',
  microchipId: '',
  raceAptitude: '',
  sireId: '',
  damId: '',
  ownerId: '',
  barnId: '',
};

const NAME_MAX = 160;
const OTHER = '__other__';

const parentLabel = (item: HorseListItem) =>
  `${item.name}${item.dateOfBirth ? ` · ${item.dateOfBirth.slice(0, 4)}` : ''}${item.lifecycleStatus !== 'ACTIVE' ? ` · ${lifecycleLabel[item.lifecycleStatus]}` : ''}`;

/** Cha/mẹ hợp lệ theo ngày sinh: sinh trước ngựa con (khi cả hai có ngày sinh). */
const bornBefore = (parent: HorseListItem, childBirth: string) => !childBirth || !parent.dateOfBirth || parent.dateOfBirth < childBirth;

function ageText(dateOfBirth: string) {
  const born = new Date(`${dateOfBirth}T00:00:00`);
  const today = now();
  let age = today.getFullYear() - born.getFullYear();
  if (today.getMonth() < born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())) age -= 1;
  return age <= 0 ? 'Dưới 1 tuổi' : `${age} tuổi`;
}

/** Ô chọn từ danh mục, có lựa chọn "Khác" để tự nhập giá trị ngoài danh mục. */
function PresetSelect({
  options,
  value,
  onChange,
  maxLength,
  placeholder,
  emptyLabel,
}: {
  options: HorseOption[];
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder: string;
  emptyLabel: string;
}) {
  const preset = isPreset(options, value);
  // Đang tự nhập: giá trị có chữ nhưng ngoài danh mục, hoặc vừa chọn "Khác".
  const [custom, setCustom] = useState(() => !!value && !preset);
  // Chỉ tự đặt con trỏ khi người dùng vừa chọn "Khác", không phải lúc mở trang sửa.
  const [justPicked, setJustPicked] = useState(false);
  const other = custom || (!!value && !preset);

  return (
    <div className="space-y-2">
      <Select
        value={other ? OTHER : preset ? canonical(options, value) : ''}
        onChange={(event) => {
          const next = event.target.value;
          if (next === OTHER) {
            setCustom(true);
            setJustPicked(true);
            onChange('');
          } else {
            setCustom(false);
            onChange(next);
          }
        }}
      >
        <option value="">{emptyLabel}</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {optionText(item)}
          </option>
        ))}
        <option value={OTHER}>Khác (tự nhập)…</option>
      </Select>
      {other && <Input autoFocus={justPicked} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}
    </div>
  );
}

/** Một dòng trong danh sách "Sẽ thay đổi". */
function ChangeLine({ label, from, to }: { label: string; from?: ReactNode; to?: ReactNode }) {
  return (
    <li className="py-2 text-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
        <span className="text-gray-400 line-through decoration-gray-300">{from || 'Trống'}</span>
        <ArrowRight size={12} className="shrink-0 text-gray-300" />
        <span className="font-medium text-gray-900">{to || 'Trống'}</span>
      </p>
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
  const formRef = useRef<HTMLDivElement>(null);

  const detail = useService(
    async () => (id ? { horse: await getHorse(id), permissions: await getPermissions(id) } : undefined),
    [id],
  );
  const horse = detail.data?.horse;
  const permissions = detail.data?.permissions;
  const isManager = editing ? !!permissions?.canEditProfile : can(user, 'horse.create');
  const aptitudeOnly = editing && !isManager && !!permissions?.canEditRaceAptitude;

  useCrumbs(editing ? (horse ? [{ label: horse.name, to: links.horse(horse.id) }, { label: 'Chỉnh sửa' }] : null) : [{ label: 'Thêm ngựa mới' }]);

  const parents = useService(
    async () => {
      if (!isManager) return { sires: [], dams: [] };
      const [males, geldings, dams] = await Promise.all([
        listAllHorses({ gender: 'MALE' }),
        listAllHorses({ gender: 'GELDING' }),
        listAllHorses({ gender: 'FEMALE' }),
      ]);
      const sortByName = (a: HorseListItem, b: HorseListItem) => a.name.localeCompare(b.name, 'vi');
      return {
        sires: [...males, ...geldings].filter((item) => item.id !== id).sort(sortByName),
        dams: dams.filter((item) => item.id !== id).sort(sortByName),
      };
    },
    [isManager, id],
  );
  const owners = useService(() => (isManager ? listAllUsers({ role: 'HORSE_OWNER', status: 'ACTIVE' }) : Promise.resolve([])), [isManager]);
  const barns = useService(() => (isManager && !editing ? listBarns() : Promise.resolve([])), [isManager, editing]);
  const photo = useService(() => (horse?.mediaId ? getPhotoUrl(horse.id).then((result) => result.url) : Promise.resolve(undefined)), [horse?.id, horse?.mediaId]);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [photoFile, setPhotoFile] = useState<File>();
  const [photoPreview, setPhotoPreview] = useState<string>();
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [chipCheck, setChipCheck] = useState<{ value: string; holder?: string } | null>(null);

  // Lỗi backend thuộc về một ô (trùng chip, cha mẹ sai…): hiện dưới ô đó, mất khi người dùng sửa ô.
  const rawField = action.field ?? fieldFromMessage(action.error);
  const serverField = rawField && rawField !== 'confirmAbnormal' ? (rawField as FieldKey) : undefined;

  // Ảnh xem trước là object URL: thu hồi khi đổi ảnh hoặc rời trang.
  useEffect(() => {
    if (!photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  // Lưu thất bại vì một ô: cuộn tới ô đó.
  useEffect(() => {
    if (serverField) scrollToFirstError(formRef.current ?? document);
  }, [serverField, action.error]);

  // Nạp hồ sơ vào biểu mẫu một lần cho mỗi phiên bản hồ sơ (điều chỉnh state ngay khi render).
  const [loadedKey, setLoadedKey] = useState<string>();
  const horseKey = horse ? `${horse.id}:${horse.version}` : undefined;
  if (horse && horseKey !== loadedKey) {
    setLoadedKey(horseKey);
    setForm({
      name: horse.name,
      gender: horse.gender ?? '',
      breed: horse.breed ?? '',
      color: horse.color ?? '',
      dateOfBirth: horse.dateOfBirth ?? '',
      microchipId: horse.microchipId ?? '',
      raceAptitude: horse.raceAptitude ?? '',
      sireId: horse.sireId ?? '',
      damId: horse.damId ?? '',
      ownerId: horse.ownerId ?? '',
      barnId: '',
    });
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (serverField === key) action.clearError();
  };
  const touch = (key: FieldKey) => setTouched((current) => (current[key] ? current : { ...current, [key]: true }));

  const today = toDateKey(now());
  const sires = parents.data?.sires ?? [];
  const dams = parents.data?.dams ?? [];
  const sire = sires.find((item) => item.id === form.sireId);
  const dam = dams.find((item) => item.id === form.damId);
  const owner = owners.data?.find((item) => item.id === form.ownerId);
  const barn = barns.data?.find((item) => item.id === form.barnId);

  // Lỗi của từng ô (luật giao diện kiểm được ngay); backend vẫn kiểm lại khi lưu.
  const errors = useMemo(() => {
    const result: Partial<Record<FieldKey, string>> = {};
    if (aptitudeOnly) return result;
    if (!form.name.trim()) result.name = 'Nhập tên ngựa';
    if (!form.gender) result.gender = 'Chọn giới tính';
    if (form.dateOfBirth && form.dateOfBirth > today) result.dateOfBirth = 'Ngày sinh không được ở tương lai';
    const chip = form.microchipId.trim();
    if (chip && chipCheck?.value === chip && chipCheck.holder) result.microchipId = `Số chip đã dùng cho ${chipCheck.holder}`;
    const parentError = (parent: HorseListItem | undefined) =>
      parent && !bornBefore(parent, form.dateOfBirth)
        ? `${parent.name} sinh ngày ${formatDate(parent.dateOfBirth)}, không trước ngày sinh của ngựa này`
        : undefined;
    const sireError = parentError(sire);
    const damError = parentError(dam);
    if (sireError) result.sireId = sireError;
    if (damError) result.damId = damError;
    if (barn && barnBlocker(barn)) result.barnId = `${barn.name}: ${barnBlocker(barn)!.toLowerCase()}`;
    return result;
  }, [aptitudeOnly, form, today, chipCheck, sire, dam, barn]);

  /** Lỗi hiển thị: ô đã chạm hoặc đã bấm lưu; lỗi backend luôn hiện. */
  const err = (key: FieldKey) => (serverField === key ? action.error : touched[key] || attempted ? errors[key] : undefined);

  // Danh sách chỉ gồm cha mẹ hợp lệ; ngựa đang được chọn vẫn giữ để ô không bị trống (lỗi hiện ở ô đó).
  const sireOptions = sires.filter((item) => bornBefore(item, form.dateOfBirth) || item.id === form.sireId);
  const damOptions = dams.filter((item) => bornBefore(item, form.dateOfBirth) || item.id === form.damId);

  const checkChip = async () => {
    touch('microchipId');
    const chip = form.microchipId.trim();
    if (!chip || (editing && chip === horse?.microchipId)) {
      setChipCheck(null);
      return;
    }
    if (chipCheck?.value === chip) return;
    try {
      const page = await listHorses({ search: chip, includeDeleted: true, limit: 20 });
      const hit = page.items.find((item) => item.id !== id && item.microchipId?.trim() === chip);
      const status = hit?.isDeleted ? 'đã xóa' : hit?.lifecycleStatus === 'TRANSFERRED' ? 'đã chuyển nhượng' : '';
      // Ghi chú trạng thái, trừ khi tên đã có sẵn chữ đó.
      const note = hit && status && !hit.name.toLowerCase().includes(status) ? ` (${status})` : '';
      setChipCheck({ value: chip, holder: hit ? `${hit.name}${note}` : undefined });
    } catch {
      // Không kiểm được lúc này: backend vẫn chặn trùng khi lưu.
      setChipCheck(null);
    }
  };

  if (editing && detail.loading) return <Skeleton rows={6} />;
  if (editing && (detail.error || !horse)) return <NotFound message={detail.error} />;
  if (!editing && !can(user, 'horse.create')) return <NotFound message="Chỉ Quản lý câu lạc bộ được tạo hồ sơ ngựa." />;
  const readOnly = !!horse && (horse.isDeleted || horse.lifecycleStatus === 'TRANSFERRED');
  if (editing && horse && (readOnly || (!isManager && !aptitudeOnly))) {
    return (
      <div className="space-y-6">
        <PageHeader title={`Sửa hồ sơ ${horse.name}`} />
        <Notice tone="warning" icon={<Lock size={16} />}>
          {readOnly
            ? 'Hồ sơ đã chuyển nhượng hoặc đã xóa nên chỉ xem được.'
            : 'Bạn không có quyền sửa hồ sơ con ngựa này (ngoài phạm vi khu bạn phụ trách).'}{' '}
          <Link to={links.horse(horse.id)} className="font-semibold underline">
            Quay lại hồ sơ
          </Link>
        </Notice>
      </div>
    );
  }

  const text = (value: string) => (value.trim() ? value.trim() : null);
  const backTo = editing && horse ? links.horse(horse.id) : links.horses;

  /* ----- Thay đổi so với hồ sơ đang lưu (chế độ sửa) ----- */
  const sireName = (value: string | null) => (value ? (sires.find((item) => item.id === value)?.name ?? '…') : undefined);
  const damName = (value: string | null) => (value ? (dams.find((item) => item.id === value)?.name ?? '…') : undefined);
  const ownerName = (value: string | null) => (value ? (owners.data?.find((item) => item.id === value)?.fullName ?? horse?.owner?.fullName ?? 'Chủ hiện tại') : undefined);
  const changes: { label: string; from?: ReactNode; to?: ReactNode }[] = [];
  if (horse) {
    if (aptitudeOnly) {
      if ((form.raceAptitude || null) !== horse.raceAptitude) {
        changes.push({
          label: 'Sở trường cự ly',
          from: horse.raceAptitude ? distanceLabel[horse.raceAptitude] : undefined,
          to: form.raceAptitude ? distanceLabel[form.raceAptitude] : undefined,
        });
      }
    } else {
      if (form.name.trim() !== horse.name) changes.push({ label: 'Tên', from: horse.name, to: form.name.trim() });
      if (form.gender && form.gender !== horse.gender) changes.push({ label: 'Giới tính', from: horse.gender ? sexLabel[horse.gender] : undefined, to: sexLabel[form.gender] });
      if (text(form.breed) !== horse.breed) changes.push({ label: 'Giống', from: breedText(horse.breed), to: breedText(text(form.breed)) });
      if (text(form.color) !== horse.color) changes.push({ label: 'Màu lông', from: colorText(horse.color), to: colorText(text(form.color)) });
      if ((form.dateOfBirth || null) !== horse.dateOfBirth) {
        changes.push({ label: 'Ngày sinh', from: horse.dateOfBirth ? formatDate(horse.dateOfBirth) : undefined, to: form.dateOfBirth ? formatDate(form.dateOfBirth) : undefined });
      }
      if (text(form.microchipId) !== horse.microchipId) changes.push({ label: 'Số chip', from: horse.microchipId ?? undefined, to: text(form.microchipId) ?? undefined });
      if ((form.sireId || null) !== horse.sireId) changes.push({ label: 'Cha', from: sireName(horse.sireId), to: sireName(form.sireId || null) });
      if ((form.damId || null) !== horse.damId) changes.push({ label: 'Mẹ', from: damName(horse.damId), to: damName(form.damId || null) });
      if ((form.ownerId || null) !== horse.ownerId) changes.push({ label: 'Chủ sở hữu', from: ownerName(horse.ownerId), to: ownerName(form.ownerId || null) });
      if (photoFile) changes.push({ label: 'Ảnh đại diện', from: horse.mediaId ? 'Ảnh cũ' : undefined, to: 'Ảnh mới' });
      else if (photoRemoved && horse.mediaId) changes.push({ label: 'Ảnh đại diện', from: 'Ảnh cũ', to: undefined });
    }
  }

  const submit = async () => {
    setAttempted(true);
    if (Object.keys(errors).length > 0) {
      scrollToFirstError(formRef.current ?? document);
      return;
    }
    if (!editing) {
      const created = await action.run(async () => {
        const mediaId = photoFile ? await uploadHorsePhoto(photoFile) : undefined;
        const input: CreateHorseInput = {
          name: form.name.trim(),
          gender: form.gender as Gender,
          breed: text(form.breed) ?? undefined,
          color: text(form.color) ?? undefined,
          microchipId: text(form.microchipId) ?? undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          sireId: form.sireId || undefined,
          damId: form.damId || undefined,
          ownerId: form.ownerId || undefined,
          mediaId,
          barnId: form.barnId || undefined,
        };
        return createHorse(input);
      });
      if (created) {
        toast.push(`Đã tạo hồ sơ ${created.name}`, 'success');
        navigate(links.horse(created.id));
      }
      return;
    }
    if (!horse) return;
    const saved = await action.run(async () => {
      const input: UpdateHorseInput = { version: horse.version };
      if (aptitudeOnly) {
        input.raceAptitude = form.raceAptitude || null;
      } else {
        // Chỉ gửi trường thật sự đổi; null nghĩa là xóa giá trị.
        if (form.name.trim() !== horse.name) input.name = form.name.trim();
        if (form.gender && form.gender !== horse.gender) input.gender = form.gender;
        if (text(form.breed) !== horse.breed) input.breed = text(form.breed);
        if (text(form.color) !== horse.color) input.color = text(form.color);
        if (text(form.microchipId) !== horse.microchipId) input.microchipId = text(form.microchipId);
        if ((form.dateOfBirth || null) !== horse.dateOfBirth) input.dateOfBirth = form.dateOfBirth || null;
        if ((form.sireId || null) !== horse.sireId) input.sireId = form.sireId || null;
        if ((form.damId || null) !== horse.damId) input.damId = form.damId || null;
        if ((form.ownerId || null) !== horse.ownerId) input.ownerId = form.ownerId || null;
        if (photoFile) input.mediaId = await uploadHorsePhoto(photoFile);
        else if (photoRemoved && horse.mediaId) input.mediaId = null;
      }
      return updateHorse(horse.id, input);
    });
    if (saved) {
      toast.push('Đã lưu hồ sơ', 'success');
      navigate(links.horse(horse.id));
    }
  };

  const stale = action.error?.includes('vừa được người khác cập nhật') ?? false;

  const ownerMissing = !!horse?.ownerId && !!owners.data && !owners.data.some((item) => item.id === horse.ownerId);
  const currentPhoto = photoPreview ?? (photoRemoved ? undefined : photo.data);
  const loadingList = (loading: boolean, data: unknown) => loading && !data;
  // Lịch ngày sinh mở sẵn ở khoảng 3 năm trước (tuổi thường gặp của ngựa mới vào câu lạc bộ).
  const birthDefault = `${Number(today.slice(0, 4)) - 3}${today.slice(4)}`;
  const noChanges = editing && changes.length === 0;
  // Cây phả hệ: ông bà lấy từ cha mẹ đã chọn, tra trong danh sách ngựa đực / cái đã tải sẵn.
  const byId = new Map([...sires, ...dams].map((item) => [item.id, item]));
  const node = (horseId?: string | null) => {
    if (!horseId) return null;
    const found = byId.get(horseId);
    return { id: horseId, name: found?.name ?? 'Đã khai báo' };
  };
  const grand = {
    sireSire: node(sire?.sireId),
    sireDam: node(sire?.damId),
    damSire: node(dam?.sireId),
    damDam: node(dam?.damId),
  };
  const tags = [
    form.gender ? sexLabel[form.gender] : undefined,
    breedLabel(text(form.breed)),
    colorLabel(text(form.color)),
    form.dateOfBirth && form.dateOfBirth <= today ? ageText(form.dateOfBirth) : undefined,
    form.raceAptitude ? distanceLabel[form.raceAptitude] : undefined,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5" ref={formRef}>
      <PageHeader
        back={
          <button type="button" onClick={() => navigate(backTo)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-900">
            <ArrowLeft size={15} /> {editing ? 'Về hồ sơ' : 'Danh sách ngựa'}
          </button>
        }
        title={editing ? `Sửa hồ sơ ${horse?.name ?? ''}` : 'Thêm ngựa mới'}
        description={aptitudeOnly ? 'Cập nhật sở trường cự ly cho ngựa thuộc khu bạn phụ trách.' : 'Ô có dấu * là bắt buộc, các ô khác bổ sung sau được.'}
      />

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {aptitudeOnly && (
            <Notice tone="info" icon={<Info size={16} />}>
              Định danh, phả hệ và chủ sở hữu do Quản lý câu lạc bộ cập nhật.
            </Notice>
          )}

          {!aptitudeOnly && (
            <Card>
              <SectionTitle>Định danh</SectionTitle>
              <div className="space-y-5">
                <div className="grid gap-x-4 gap-y-5 sm:grid-cols-6">
                  <Field label="Tên ngựa" required name="name" error={err('name')} counter={<CharCount value={form.name} max={NAME_MAX} />} className="sm:col-span-4">
                    <Input
                      value={form.name}
                      maxLength={NAME_MAX}
                      onChange={(event) => set('name', event.target.value)}
                      onBlur={() => touch('name')}
                      placeholder="Ví dụ: Tia Chớp"
                      className={cn(err('name') && invalidClass)}
                    />
                  </Field>
                  <Field label="Giới tính" required name="gender" error={err('gender')} className="sm:col-span-2">
                    <Select
                      value={form.gender}
                      onChange={(event) => {
                        set('gender', event.target.value as Gender);
                        touch('gender');
                      }}
                      onBlur={() => touch('gender')}
                      className={cn(err('gender') && invalidClass)}
                    >
                      <option value="">Chọn giới tính…</option>
                      {(Object.keys(sexLabel) as Gender[]).map((item) => (
                        <option key={item} value={item}>
                          {sexLabel[item]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Giống" name="breed" error={err('breed')} className="sm:col-span-3">
                    <PresetSelect options={BREEDS} value={form.breed} onChange={(value) => set('breed', value)} maxLength={80} placeholder="Tên giống" emptyLabel="Chưa rõ giống" />
                  </Field>
                  <Field label="Màu lông" name="color" error={err('color')} className="sm:col-span-3">
                    <PresetSelect options={COLORS} value={form.color} onChange={(value) => set('color', value)} maxLength={40} placeholder="Màu lông" emptyLabel="Chưa chọn" />
                  </Field>
                  <Field label="Ngày sinh" name="dateOfBirth" error={err('dateOfBirth')} className="sm:col-span-3">
                    <DatePicker
                      value={form.dateOfBirth}
                      max={today}
                      defaultView="year"
                      defaultMonth={birthDefault}
                      onChange={(value) => set('dateOfBirth', value)}
                      onBlur={() => touch('dateOfBirth')}
                      invalid={!!err('dateOfBirth')}
                    />
                  </Field>
                  <Field label="Số chip" name="microchipId" error={err('microchipId')} className="sm:col-span-3">
                    <Input
                      value={form.microchipId}
                      maxLength={80}
                      className={cn('font-mono', err('microchipId') && invalidClass)}
                      onChange={(event) => set('microchipId', event.target.value)}
                      onBlur={checkChip}
                      placeholder="704098100000014"
                      spellCheck={false}
                    />
                  </Field>
                </div>
              </div>
            </Card>
          )}

          {editing && (aptitudeOnly || horse?.raceAptitude) && (
            <Card>
              <SectionTitle>Sở trường cự ly</SectionTitle>
              {aptitudeOnly ? (
                <div className="grid gap-2 sm:grid-cols-4">
                  {([['', 'Chưa xác định', 'Để trống'], ...(Object.keys(distanceLabel) as RaceAptitude[]).map((key) => [key, distanceLabel[key], distanceHint[key]])] as [string, string, string][]).map(
                    ([value, label, hint]) => (
                      <button
                        key={value || 'none'}
                        type="button"
                        onClick={() => set('raceAptitude', value as RaceAptitude | '')}
                        className={cn(
                          'rounded-xl border px-4 py-3 text-left transition',
                          form.raceAptitude === value ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/15' : 'border-gray-200 bg-white hover:border-gray-300',
                        )}
                      >
                        <p className="text-sm font-semibold text-gray-900">{label}</p>
                        <p className="text-xs text-gray-500">{hint}</p>
                      </button>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600">{horse?.raceAptitude ? distanceLabel[horse.raceAptitude] : 'Chưa xác định'} — do HT phụ trách khu cập nhật.</p>
              )}
            </Card>
          )}

          {!aptitudeOnly && (
            <Card>
              <SectionTitle>Phả hệ</SectionTitle>
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                <Field label="Cha" name="sireId" error={err('sireId')}>
                  <Select
                    value={form.sireId}
                    disabled={loadingList(parents.loading, parents.data)}
                    onChange={(event) => {
                      set('sireId', event.target.value);
                      touch('sireId');
                    }}
                    className={cn(err('sireId') && invalidClass)}
                  >
                    <option value="">{loadingList(parents.loading, parents.data) ? 'Đang tải…' : 'Không khai báo'}</option>
                    {sireOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {parentLabel(item)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Mẹ" name="damId" error={err('damId')}>
                  <Select
                    value={form.damId}
                    disabled={loadingList(parents.loading, parents.data)}
                    onChange={(event) => {
                      set('damId', event.target.value);
                      touch('damId');
                    }}
                    className={cn(err('damId') && invalidClass)}
                  >
                    <option value="">{loadingList(parents.loading, parents.data) ? 'Đang tải…' : 'Không khai báo'}</option>
                    {damOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {parentLabel(item)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Card>
          )}

          {!aptitudeOnly && (
            <Card>
              <SectionTitle>{editing ? 'Chủ sở hữu' : 'Chủ sở hữu và khu chuồng'}</SectionTitle>
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                <Field label="Chủ sở hữu" name="ownerId" error={err('ownerId')}>
                  <Select
                    value={form.ownerId}
                    disabled={loadingList(owners.loading, owners.data)}
                    onChange={(event) => set('ownerId', event.target.value)}
                    className={cn(err('ownerId') && invalidClass)}
                  >
                    <option value="">{loadingList(owners.loading, owners.data) ? 'Đang tải…' : 'Chưa có chủ'}</option>
                    {ownerMissing && horse?.ownerId && <option value={horse.ownerId}>{horse.owner?.fullName ?? 'Chủ hiện tại'} (tài khoản đã khóa)</option>}
                    {(owners.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.fullName} · {item.email}
                      </option>
                    ))}
                  </Select>
                </Field>
                {!editing && (
                  <Field label="Khu chuồng" name="barnId" error={err('barnId')}>
                    <Select
                      value={form.barnId}
                      disabled={loadingList(barns.loading, barns.data)}
                      onChange={(event) => {
                        set('barnId', event.target.value);
                        touch('barnId');
                      }}
                      className={cn(err('barnId') && invalidClass)}
                    >
                      <option value="">{loadingList(barns.loading, barns.data) ? 'Đang tải…' : 'Chưa xếp khu'}</option>
                      {(barns.data ?? []).map((item) => {
                        const blocker = barnBlocker(item);
                        return (
                          <option key={item.id} value={item.id} disabled={!!blocker}>
                            {item.name} · {blocker ? blocker.toLowerCase() : `còn nhận ${item.availableStallCount} ngựa`}
                          </option>
                        );
                      })}
                    </Select>
                  </Field>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Cột phải: thẻ hồ sơ — ảnh lớn (bấm / kéo thả để chọn), mức đầy đủ, điều sẽ xảy ra khi lưu, nút lưu */}
        <aside className="lg:sticky lg:top-6 lg:col-span-4">
          <div className="overflow-hidden rounded-3xl bg-white shadow-[0_24px_50px_-30px_rgba(6,78,59,0.45)] ring-1 ring-gray-200/80">
            {aptitudeOnly ? (
              <div className="relative aspect-[16/9] overflow-hidden">
                {currentPhoto ? <img src={currentPhoto} alt={form.name} className="absolute inset-0 h-full w-full object-cover" /> : <TurfPlaceholder name={form.name} className="absolute inset-0" />}
                <span className="absolute inset-0 bg-linear-to-t from-emerald-950/80 via-transparent to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-5">
                  <span className="block truncate text-2xl font-bold tracking-tight text-white">{form.name}</span>
                  <span className="block truncate font-mono text-xs text-white/75">{form.microchipId || 'Chưa có số chip'}</span>
                </span>
              </div>
            ) : (
              <PhotoDropzone
                preview={currentPhoto}
                name={form.name}
                chip={form.microchipId}
                error={err('mediaId')}
                onPick={(file, preview) => {
                  setPhotoFile(file);
                  setPhotoPreview(preview);
                  setPhotoRemoved(false);
                  if (serverField === 'mediaId') action.clearError();
                }}
                onClear={() => {
                  setPhotoFile(undefined);
                  setPhotoPreview(undefined);
                  setPhotoRemoved(true);
                }}
              />
            )}

            <div className="space-y-4 p-5">
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Pill key={tag} tone="gray">
                      {tag}
                    </Pill>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Giới tính, giống, tuổi bạn nhập sẽ hiện ở đây.</p>
              )}

              {!aptitudeOnly && owner && (
                <dl className="space-y-1.5 text-sm">
                  {owner && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-gray-500">Chủ</dt>
                      <dd className="truncate font-medium text-gray-900">{owner.fullName}</dd>
                    </div>
                  )}
                </dl>
              )}

              {!aptitudeOnly && <PedigreeMini name={form.name} sire={sire ? { id: sire.id, name: sire.name } : null} dam={dam ? { id: dam.id, name: dam.name } : null} grand={grand} />}

              {!editing && (
                <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50/60 p-3 text-sm text-gray-700 ring-1 ring-emerald-100">
                  <MapPinned size={15} className="mt-0.5 shrink-0 text-emerald-700" />
                  {barn && !barnBlocker(barn) ? (
                    <span>
                      Vào <span className="font-semibold">{barn.name}</span>
                      {barn.headTrainerFullName ? `, HT ${barn.headTrainerFullName} xếp ô sau.` : ', chờ xếp ô.'}
                    </span>
                  ) : (
                    <span>Vào danh sách Chờ xếp khu.</span>
                  )}
                </div>
              )}

              {editing && (
                <div>
                  <p className="text-sm font-semibold text-gray-900">Sẽ thay đổi{changes.length > 0 ? ` (${changes.length})` : ''}</p>
                  {changes.length === 0 ? (
                    <p className="mt-1 text-sm text-gray-400">Chưa có thay đổi nào.</p>
                  ) : (
                    <ul className="mt-1 divide-y divide-gray-100">
                      {changes.map((item) => (
                        <ChangeLine key={item.label} {...item} />
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {action.error && !serverField && <ErrorBox message={action.error} />}
              {serverField && <p className="text-sm text-red-600">Chưa lưu được — xem ô báo lỗi bên trái.</p>}
              {stale && (
                <Button variant="secondary" className="w-full" onClick={() => detail.reload()}>
                  <RefreshCw size={14} /> Tải lại hồ sơ mới nhất
                </Button>
              )}

              <div className="space-y-2 border-t border-gray-100 pt-4">
                <Button className="h-11 w-full text-[0.95rem]" onClick={submit} disabled={action.pending || noChanges}>
                  {action.pending ? (photoFile ? 'Đang tải ảnh và lưu…' : 'Đang lưu…') : editing ? 'Lưu thay đổi' : 'Tạo hồ sơ'}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate(backTo)} disabled={action.pending}>
                  Hủy
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
