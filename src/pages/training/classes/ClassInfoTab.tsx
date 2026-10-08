// Tab Thông tin của lớp. HLV phụ trách sửa được khi lớp còn nháp hoặc đang chạy (không đổi giáo án, HLV).
// Đổi ngày bắt đầu thì ngày kết thúc tự tính lại. BE chặn khi buổi hoặc ghi danh nằm ngoài khoảng mới.
import { useState } from 'react';
import { updateClass } from '../../../api/training';
import type { RaceAptitude } from '../../../api/types';
import { Button, CharCount, ErrorBox, Field, InfoGrid, Input, Notice, Select, Textarea, invalidClass, useToast } from '../../../components/ui';
import { DatePicker } from '../../../components/ui/DatePicker';
import { useAction } from '../../../hooks/useService';
import { formatDate, formatDateTime } from '../../../lib/format';
import { classEndDate, clubDateKey } from '../../../lib/club-time';
import { distanceLabel } from '../../../lib/labels';
import { classStatusText } from '../../../lib/training-labels';
import { Stepper } from '../components/Stepper';
import type { ClassBundle } from './class-bundle';

export default function ClassInfoTab({ bundle, manage, reload }: { bundle: ClassBundle; manage: boolean; reload: () => void }) {
  const toast = useToast();
  const { item, plan, sessions, enrollments } = bundle;
  const editable = manage && (item.status === 'DRAFT' || item.status === 'ACTIVE');
  const [code, setCode] = useState(item.code);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? '');
  const [raceAptitude, setRaceAptitude] = useState<'' | RaceAptitude>(item.raceAptitude ?? '');
  const [maxHorses, setMaxHorses] = useState(item.maxHorses);
  const [startDate, setStartDate] = useState(item.startDate);
  const save = useAction();
  const activeHorses = enrollments.filter((enrollment) => enrollment.status === 'ACTIVE').length;
  const totalWeeks = plan?.totalWeeks;
  const endDate = totalWeeks ? classEndDate(startDate, totalWeeks) : item.endDate;
  const outside = sessions.filter((session) => {
    const day = clubDateKey(session.scheduledStartAt);
    return day < startDate || day > endDate;
  }).length;
  const changed = code !== item.code || name !== item.name || description !== (item.description ?? '') || raceAptitude !== (item.raceAptitude ?? '') || maxHorses !== item.maxHorses || startDate !== item.startDate;

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

  const submit = () =>
    void save.run(
      () =>
        updateClass(item.id, {
          code: code.trim() !== item.code ? code.trim() : undefined,
          name: name.trim() !== item.name ? name.trim() : undefined,
          description: description !== (item.description ?? '') ? description.trim() : undefined,
          raceAptitude: raceAptitude && raceAptitude !== item.raceAptitude ? raceAptitude : undefined,
          maxHorses: maxHorses !== item.maxHorses ? maxHorses : undefined,
          startDate: startDate !== item.startDate ? startDate : undefined,
        }),
      () => {
        toast.push('Đã lưu thông tin lớp', 'success');
        reload();
      },
    );

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">
        {save.error && <ErrorBox message={save.error} />}
        <div className="grid gap-4 sm:grid-cols-5">
          <Field label="Mã lớp" required className="sm:col-span-2">
            <Input value={code} className={`font-mono uppercase ${!code.trim() ? invalidClass : ''}`} onChange={(event) => setCode(event.target.value.toUpperCase())} />
          </Field>
          <Field label="Tên lớp" required className="sm:col-span-3">
            <Input value={name} onChange={(event) => setName(event.target.value)} className={!name.trim() ? invalidClass : ''} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ngày bắt đầu" hint={`Kết thúc ${formatDate(endDate)} (tự tính)`}>
            <DatePicker value={startDate} onChange={setStartDate} clearable={false} />
          </Field>
          <Field label="Sĩ số tối đa" error={maxHorses < activeHorses ? `Không nhỏ hơn số ngựa đang học (${activeHorses})` : undefined}>
            <Stepper value={maxHorses} onChange={setMaxHorses} min={1} max={50} suffix="ngựa" label="sĩ số" />
          </Field>
          <Field label="Sở trường mục tiêu">
            <Select value={raceAptitude} onChange={(event) => setRaceAptitude(event.target.value as '' | RaceAptitude)}>
              <option value="">Không đặt</option>
              {(['SPRINTER', 'MILER', 'STAYER'] as const).map((value) => (
                <option key={value} value={value}>
                  {distanceLabel[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {outside > 0 && <Notice tone="warning">Ngày bắt đầu mới làm {outside} buổi nằm ngoài thời gian của lớp. Hệ thống sẽ không cho lưu.</Notice>}
        <Field label="Mô tả" counter={<CharCount value={description} max={500} />}>
          <Textarea rows={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={!changed} onClick={() => {
            setCode(item.code);
            setName(item.name);
            setDescription(item.description ?? '');
            setRaceAptitude(item.raceAptitude ?? '');
            setMaxHorses(item.maxHorses);
            setStartDate(item.startDate);
          }}>
            Hoàn tác
          </Button>
          <Button disabled={!changed || save.pending || !code.trim() || !name.trim() || maxHorses < activeHorses} onClick={submit}>
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
