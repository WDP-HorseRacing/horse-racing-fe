// Tab Thông tin của lớp. HLV phụ trách sửa được khi lớp đang chạy (không đổi giáo án, HLV).
// Đổi ngày bắt đầu thì ngày kết thúc tự tính lại. BE chặn khi buổi hoặc ghi danh nằm ngoài khoảng mới.
// Lỗi của từng ô hiện khi rời ô hoặc bấm lưu; ô xóa trắng gửi null để BE xóa giá trị cũ.
import { useMemo, useRef, useState } from 'react';
import { updateClass } from '../../../api/training';
import type { RaceAptitude } from '../../../api/types';
import { Button, CharCount, ErrorBox, Field, InfoGrid, Input, Notice, Select, Textarea, invalidClass, useToast } from '../../../components/ui';
import { DatePicker } from '../../../components/ui/DatePicker';
import { useAction } from '../../../hooks/useService';
import { useFormErrors } from '../../../hooks/useFormErrors';
import { formatDate, formatDateTime } from '../../../lib/format';
import { classEndDate, clubDateKey, clubToday } from '../../../lib/club-time';
import { distanceLabel } from '../../../lib/labels';
import { classStatusText } from '../../../lib/training-labels';
import { Stepper } from '../components/Stepper';
import type { ClassBundle } from './class-bundle';

/** Giới hạn của BE (mô tả BE không giới hạn, FE đặt 500). */
const CODE_MAX = 32;
const NAME_MAX = 160;
const DESCRIPTION_MAX = 500;

type InfoField = 'code' | 'name' | 'startDate' | 'maxHorses' | 'raceAptitude' | 'description';
const FIELDS: InfoField[] = ['code', 'name', 'startDate', 'maxHorses', 'raceAptitude', 'description'];

export default function ClassInfoTab({ bundle, manage, reload }: { bundle: ClassBundle; manage: boolean; reload: () => void }) {
  const toast = useToast();
  const { item, plan, sessions, enrollments } = bundle;
  const editable = manage && item.status === 'ACTIVE';
  const [code, setCode] = useState(item.code);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? '');
  const [raceAptitude, setRaceAptitude] = useState<'' | RaceAptitude>(item.raceAptitude ?? '');
  const [maxHorses, setMaxHorses] = useState(item.maxHorses);
  const [startDate, setStartDate] = useState(item.startDate);
  const save = useAction();
  const formRef = useRef<HTMLDivElement>(null);
  const activeHorses = enrollments.filter((enrollment) => enrollment.status === 'ACTIVE').length;
  const totalWeeks = plan?.totalWeeks;
  const endDate = totalWeeks ? classEndDate(startDate, totalWeeks) : item.endDate;
  const outside = sessions.filter((session) => {
    const day = clubDateKey(session.scheduledStartAt);
    return day < startDate || day > endDate;
  }).length;
  const descriptionText = description.trim() || null;
  const changed =
    code.trim() !== item.code ||
    name.trim() !== item.name ||
    descriptionText !== (item.description || null) ||
    (raceAptitude || null) !== (item.raceAptitude ?? null) ||
    maxHorses !== item.maxHorses ||
    startDate !== item.startDate;

  const errors = useMemo(() => {
    const result: Partial<Record<InfoField, string>> = {};
    const codeText = code.trim();
    if (!codeText) result.code = 'Nhập mã lớp';
    else if (codeText.length > CODE_MAX) result.code = `Mã lớp tối đa ${CODE_MAX} ký tự`;
    const nameText = name.trim();
    if (!nameText) result.name = 'Nhập tên lớp';
    else if (nameText.length > NAME_MAX) result.name = `Tên lớp tối đa ${NAME_MAX} ký tự`;
    // Đổi ngày bắt đầu thì không được ở quá khứ. Giữ nguyên ngày cũ của lớp đã bắt đầu thì không sao.
    if (startDate !== item.startDate && startDate < clubToday()) result.startDate = 'Ngày bắt đầu không được ở quá khứ';
    else if (startDate !== item.startDate && outside > 0) result.startDate = `Ngày này làm ${outside} buổi nằm ngoài thời gian của lớp`;
    if (maxHorses < activeHorses) result.maxHorses = `Không nhỏ hơn số ngựa đang học (${activeHorses})`;
    if (description.trim().length > DESCRIPTION_MAX) result.description = `Mô tả tối đa ${DESCRIPTION_MAX} ký tự`;
    return result;
  }, [code, name, startDate, item.startDate, outside, maxHorses, activeHorses, description]);
  const serverErrors = useMemo(
    () => Object.fromEntries(FIELDS.flatMap((key) => (save.fieldErrors[key] ? [[key, save.fieldErrors[key]]] : save.field === key && save.error ? [[key, save.error]] : []))) as Record<string, string>,
    [save.fieldErrors, save.field, save.error],
  );
  const f = useFormErrors(errors, { fieldErrors: serverErrors });
  const fieldShown = Object.keys(serverErrors).length > 0;
  /** Sửa ô đang có lỗi BE thì bỏ lỗi đó. */
  const cleared = (key: InfoField) => {
    if (serverErrors[key]) save.clearError();
  };

  if (!editable) {
    return (
      <InfoGrid
        items={[
          { label: 'Mã lớp', value: <span className="font-mono">{item.code}</span> },
          { label: 'Trạng thái', value: classStatusText[item.status] },
          { label: 'Thời gian', value: `${formatDate(item.startDate)} đến ${formatDate(item.endDate)}`, wide: true },
          { label: 'Sĩ số tối đa', value: `${item.maxHorses} ngựa` },
          { label: 'Sở trường mục tiêu', value: item.raceAptitude ? distanceLabel[item.raceAptitude] : 'Không đặt' },
          { label: 'Giáo án', value: plan?.name ?? 'Theo giáo án của HLV' },
          { label: 'Tạo lúc', value: formatDateTime(item.createdAt) },
          ...(item.completedAt ? [{ label: 'Hoàn thành lúc', value: formatDateTime(item.completedAt) }] : []),
          ...(item.cancelledAt ? [{ label: 'Hủy lúc', value: formatDateTime(item.cancelledAt) }, { label: 'Lý do hủy', value: item.cancelReason, wide: true }] : []),
          { label: 'Mô tả', value: item.description ?? 'Không có', wide: true },
        ]}
      />
    );
  }

  const submit = () => {
    if (!f.attempt(formRef.current ?? undefined)) return;
    if (!changed) {
      toast.push('Chưa có thay đổi nào để lưu', 'info');
      return;
    }
    // Mô tả, sở trường xóa trắng gửi null để BE xóa.
    const body = {
      code: code.trim() !== item.code ? code.trim() : undefined,
      name: name.trim() !== item.name ? name.trim() : undefined,
      description: descriptionText !== (item.description || null) ? descriptionText : undefined,
      raceAptitude: (raceAptitude || null) !== (item.raceAptitude ?? null) ? raceAptitude || null : undefined,
      maxHorses: maxHorses !== item.maxHorses ? maxHorses : undefined,
      startDate: startDate !== item.startDate ? startDate : undefined,
    };
    void save.run(
      () => updateClass(item.id, body),
      () => {
        toast.push('Đã lưu thông tin lớp', 'success');
        f.reset();
        reload();
      },
    ).then((result) => result === undefined && reload());
  };

  const undo = () => {
    setCode(item.code);
    setName(item.name);
    setDescription(item.description ?? '');
    setRaceAptitude(item.raceAptitude ?? '');
    setMaxHorses(item.maxHorses);
    setStartDate(item.startDate);
    f.reset();
    save.clearError();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div ref={formRef} className="space-y-4 lg:col-span-8">
        {save.error && !fieldShown && <ErrorBox message={save.error} />}
        <div className="grid gap-4 sm:grid-cols-5">
          <Field label="Mã lớp" required name="code" className="sm:col-span-2" error={f.show('code')} onBlur={f.blur('code')} counter={<CharCount value={code} max={CODE_MAX} />}>
            <Input
              value={code}
              maxLength={CODE_MAX}
              className={`font-mono uppercase ${f.show('code') ? invalidClass : ''}`}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                cleared('code');
              }}
            />
          </Field>
          <Field label="Tên lớp" required name="name" className="sm:col-span-3" error={f.show('name')} onBlur={f.blur('name')} counter={<CharCount value={name} max={NAME_MAX} />}>
            <Input
              value={name}
              maxLength={NAME_MAX}
              onChange={(event) => {
                setName(event.target.value);
                cleared('name');
              }}
              className={f.show('name') ? invalidClass : ''}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ngày bắt đầu" name="startDate" hint={`Kết thúc ${formatDate(endDate)} (tự tính)`} error={f.show('startDate')} onBlur={f.blur('startDate')}>
            <DatePicker
              value={startDate}
              min={clubToday()}
              onChange={(value) => {
                setStartDate(value);
                // Chọn ngày xong là đã quyết định: báo lỗi ngay (buổi nằm ngoài khoảng mới), không chờ rời ô.
                f.touch('startDate');
                cleared('startDate');
              }}
              clearable={false}
              invalid={!!f.show('startDate')}
            />
          </Field>
          <Field label="Sĩ số tối đa" name="maxHorses" error={f.show('maxHorses')} onBlur={f.blur('maxHorses')}>
            <Stepper
              value={maxHorses}
              onChange={(value) => {
                setMaxHorses(value);
                cleared('maxHorses');
              }}
              min={1}
              max={50}
              suffix="ngựa"
              label="sĩ số"
            />
          </Field>
          <Field label="Sở trường mục tiêu" name="raceAptitude" error={f.show('raceAptitude')}>
            <Select
              value={raceAptitude}
              onChange={(event) => {
                setRaceAptitude(event.target.value as '' | RaceAptitude);
                cleared('raceAptitude');
              }}
            >
              <option value="">Không đặt</option>
              {(['SPRINTER', 'MILER', 'STAYER'] as const).map((value) => (
                <option key={value} value={value}>
                  {distanceLabel[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Mô tả" name="description" error={f.show('description')} onBlur={f.blur('description')} counter={<CharCount value={description} max={DESCRIPTION_MAX} />}>
          <Textarea
            rows={3}
            maxLength={DESCRIPTION_MAX}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              cleared('description');
            }}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={!changed || save.pending} onClick={undo}>
            Hoàn tác
          </Button>
          <Button disabled={save.pending} onClick={submit}>
            {save.pending ? 'Đang lưu…' : 'Lưu thông tin'}
          </Button>
        </div>
      </div>
      <aside className="lg:col-span-4">
        <Notice tone="info">Lớp không đổi được giáo án hay huấn luyện viên trưởng sau khi tạo. Đổi HLV chỉ qua bàn giao công việc của quản lý câu lạc bộ.</Notice>
      </aside>
    </div>
  );
}
