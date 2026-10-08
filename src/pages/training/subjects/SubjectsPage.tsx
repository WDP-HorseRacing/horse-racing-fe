// F2.2 — Danh mục môn học của câu lạc bộ. Club Manager thêm, sửa, xóa. HLV trưởng, bác sĩ, Groom chỉ xem.
// Bố cục 8/4: trái là các môn nhóm theo cường độ (và nhóm Chạy thử), phải là thẻ chi tiết môn đang chọn.
import { useMemo, useRef, useState } from 'react';
import { BookOpenCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteSubject, listSubjects } from '../../../api/training';
import type { TrainingSubject } from '../../../api/types';
import {
  Button,
  ChipFilter,
  ConfirmDialog,
  EmptyState,
  ErrorBox,
  NotFound,
  Notice,
  PageHeader,
  SearchInput,
  Skeleton,
  cn,
  useToast,
} from '../../../components/ui';
import { useAction, useService } from '../../../hooks/useService';
import { can } from '../../../auth/permissions';
import { useStore } from '../../../store/store';
import { formatDate } from '../../../lib/format';
import { formatMeters, formatRaceTime } from '../../../lib/training-format';
import { INTENSITIES, intensityText, sessionTypeText } from '../../../lib/training-labels';
import { gsap, useGSAP } from '../../../lib/gsap';
import { prefersReducedMotion } from '../../../lib/motion';
import { Figure, IntensityBars, TrialBadge } from '../components/bits';
import SubjectSheet from './SubjectSheet';

type Filter = 'ALL' | 'LIGHT' | 'MODERATE' | 'HEAVY' | 'TRIAL';

export default function SubjectsPage() {
  const user = useStore((state) => state.currentUser);
  const toast = useToast();
  const subjects = useService(() => listSubjects(), []);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const [editing, setEditing] = useState<TrainingSubject | 'new' | null>(null);
  const [removing, setRemoving] = useState<TrainingSubject | null>(null);
  const [flashId, setFlashId] = useState<string>();
  const remove = useAction();
  const scope = useRef<HTMLDivElement>(null);
  const canManage = can(user, 'subject.manage');

  const rows = useMemo(() => subjects.data ?? [], [subjects.data]);
  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    return rows.filter((subject) => {
      if (text && !subject.name.toLowerCase().includes(text) && !(subject.surface ?? '').toLowerCase().includes(text)) return false;
      if (filter === 'TRIAL') return subject.sessionType === 'TIME_TRIAL';
      if (filter !== 'ALL') return subject.intensity === filter && subject.sessionType === 'REGULAR';
      return true;
    });
  }, [rows, filter, search]);

  // Nhóm: các môn thường theo cường độ, rồi nhóm chạy thử riêng.
  const groups = useMemo(
    () =>
      [
        ...INTENSITIES.map((intensity) => ({
          key: intensity,
          title: `Cường độ ${intensityText[intensity].toLowerCase()}`,
          items: visible.filter((subject) => subject.sessionType === 'REGULAR' && subject.intensity === intensity),
        })),
        { key: 'TRIAL', title: 'Chạy thử', items: visible.filter((subject) => subject.sessionType === 'TIME_TRIAL') },
      ].filter((group) => group.items.length > 0),
    [visible],
  );

  const selected = rows.find((subject) => subject.id === selectedId) ?? visible[0];

  // Thẻ hiện dần theo nhóm, thanh cường độ mọc từ dưới lên.
  useGSAP(
    () => {
      if (!scope.current || prefersReducedMotion() || rows.length === 0) return;
      gsap.from('[data-subject-card]', { opacity: 0, y: 14, duration: 0.4, stagger: 0.035, ease: 'power3.out', clearProps: 'all' });
      gsap.from('[data-subject-card] [data-intensity-bars] > span', { scaleY: 0, duration: 0.45, stagger: 0.02, delay: 0.15, ease: 'back.out(2)' });
    },
    { scope, dependencies: [rows.length > 0, filter] },
  );

  if (!can(user, 'subject.view')) return <NotFound message="Danh mục môn học dành cho nhân sự câu lạc bộ." />;

  const counts = {
    ALL: rows.length,
    LIGHT: rows.filter((item) => item.sessionType === 'REGULAR' && item.intensity === 'LIGHT').length,
    MODERATE: rows.filter((item) => item.sessionType === 'REGULAR' && item.intensity === 'MODERATE').length,
    HEAVY: rows.filter((item) => item.sessionType === 'REGULAR' && item.intensity === 'HEAVY').length,
    TRIAL: rows.filter((item) => item.sessionType === 'TIME_TRIAL').length,
  };

  const confirmRemove = () => {
    if (!removing) return;
    void remove.run(
      () => deleteSubject(removing.id),
      () => {
        toast.push(`Đã xóa môn ${removing.name}`, 'success');
        setRemoving(null);
        setSelectedId(undefined);
        subjects.reload();
      },
    );
  };

  return (
    <div ref={scope} className="space-y-5">
      <PageHeader
        title="Môn học"
        description="Danh mục bài tập cố định của câu lạc bộ. Giáo án của huấn luyện viên trưởng ghép từ các môn này."
        actions={
          canManage && (
            <Button onClick={() => setEditing('new')}>
              <Plus size={16} /> Thêm môn
            </Button>
          )
        }
      />

      {subjects.loading && !subjects.data ? (
        <Skeleton rows={6} />
      ) : subjects.error ? (
        <ErrorBox message={subjects.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Chưa có môn học nào"
          hint={canManage ? 'Thêm vài môn như đi bộ hồi phục, phi nước kiệu, phi nước đại, chạy thử để huấn luyện viên trưởng lập giáo án.' : 'Quản lý câu lạc bộ chưa tạo môn học.'}
          action={
            canManage && (
              <Button onClick={() => setEditing('new')}>
                <Plus size={16} /> Thêm môn đầu tiên
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          <section className="space-y-5 lg:col-span-8">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên hoặc mặt sân" className="w-full sm:w-64" />
              <ChipFilter<Filter>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'ALL', label: 'Tất cả', count: counts.ALL },
                  { value: 'LIGHT', label: 'Nhẹ', count: counts.LIGHT },
                  { value: 'MODERATE', label: 'Trung bình', count: counts.MODERATE },
                  { value: 'HEAVY', label: 'Nặng', count: counts.HEAVY },
                  { value: 'TRIAL', label: 'Chạy thử', count: counts.TRIAL },
                ]}
              />
            </div>

            {groups.length === 0 && <EmptyState title="Không có môn khớp bộ lọc" />}
            {groups.map((group) => (
              <div key={group.key}>
                <h3 className="mb-2.5 text-sm font-semibold text-gray-700">
                  {group.title} <span className="font-normal text-gray-400">{group.items.length}</span>
                </h3>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {group.items.map((subject) => (
                    <button
                      key={subject.id}
                      type="button"
                      data-subject-card
                      onClick={() => setSelectedId(subject.id)}
                      className={cn(
                        'group flex min-w-0 flex-col gap-2 rounded-2xl bg-white p-4 text-left ring-1 transition duration-150',
                        selected?.id === subject.id ? 'shadow-grass-tint ring-2 ring-emerald-500/70' : 'ring-gray-200/80 hover:-translate-y-0.5 hover:ring-emerald-200',
                        flashId === subject.id && 'animate-[pulse_1s_ease-out_1]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate font-semibold text-gray-900">{subject.name}</p>
                        <TrialBadge type={subject.sessionType} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                        <IntensityBars intensity={subject.intensity} />
                        <span className="font-mono tabular-nums">{formatMeters(subject.plannedDistanceM)}</span>
                        {subject.surface && <span>{subject.surface}</span>}
                        {subject.targetTimeMs && <span className="font-mono tabular-nums text-amber-800">Mục tiêu {formatRaceTime(subject.targetTimeMs)}</span>}
                      </div>
                      {subject.description && <p className="line-clamp-2 text-xs text-gray-500">{subject.description}</p>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <aside className="lg:col-span-4">
            <div className="sticky top-4 space-y-3">
              {selected && (
                <div className="rounded-2xl bg-white p-5 shadow-grass-tint ring-1 ring-gray-200/80">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl tint-emerald">
                    <BookOpenCheck size={19} />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xl font-bold tracking-tight text-gray-900">{selected.name}</h3>
                    <TrialBadge type={selected.sessionType} />
                  </div>
                  {selected.description ? (
                    <p className="mt-1.5 whitespace-pre-line text-sm text-gray-600">{selected.description}</p>
                  ) : (
                    <p className="mt-1.5 text-sm text-gray-400">Chưa có mô tả</p>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-gray-50/80 p-3.5 ring-1 ring-gray-100">
                    <Figure label="Loại buổi" value={sessionTypeText[selected.sessionType]} mono={false} />
                    <Figure label="Cường độ" value={<IntensityBars intensity={selected.intensity} />} mono={false} />
                    <Figure label="Cự ly dự kiến" value={formatMeters(selected.plannedDistanceM)} />
                    <Figure label="Mặt sân" value={selected.surface ?? 'Chưa ghi'} mono={false} />
                    {selected.sessionType === 'TIME_TRIAL' && (
                      <Figure label="Thời gian mục tiêu" value={selected.targetTimeMs ? formatRaceTime(selected.targetTimeMs) : 'Chưa đặt'} className="col-span-2" />
                    )}
                  </div>
                  <p className="mt-3 text-xs text-gray-400">Cập nhật {formatDate(selected.updatedAt)}</p>
                  {canManage && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                      <Button variant="inline" size="sm" onClick={() => setEditing(selected)}>
                        <Pencil size={14} /> Sửa môn
                      </Button>
                      <Button variant="inlineDanger" size="sm" onClick={() => setRemoving(selected)}>
                        <Trash2 size={14} /> Xóa
                      </Button>
                    </div>
                  )}
                </div>
              )}
              <Notice tone="info">
                Sửa môn không làm đổi các buổi tập đã tạo. Môn đang nằm trong giáo án hoặc buổi tập thì không xóa được.
              </Notice>
            </div>
          </aside>
        </div>
      )}

      {editing && (
        <SubjectSheet
          subject={editing === 'new' ? undefined : editing}
          existingNames={rows.filter((row) => editing === 'new' || row.id !== editing.id).map((row) => row.name)}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setSelectedId(saved.id);
            setFlashId(saved.id);
            window.setTimeout(() => setFlashId(undefined), 1200);
            subjects.reload();
          }}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        title="Xóa môn học"
        message={
          <>
            Xóa môn <b>{removing?.name}</b> khỏi danh mục câu lạc bộ?
            {remove.error && <div className="mt-3"><ErrorBox message={remove.error === 'Môn học đang được dùng, không xóa được' ? 'Môn đang nằm trong giáo án hoặc buổi tập nên không xóa được. Hãy sửa môn thay vì xóa.' : remove.error} /></div>}
          </>
        }
        confirmLabel="Xóa môn"
        pending={remove.pending}
        onConfirm={confirmRemove}
        onClose={() => {
          setRemoving(null);
          remove.clearError();
        }}
      />
    </div>
  );
}
