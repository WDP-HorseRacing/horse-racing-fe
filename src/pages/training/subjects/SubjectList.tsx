import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAction, useService } from '../../../hooks/useService';
import {
  createSubject,
  deleteSubject,
  listSubjects,
  updateSubject,
  type SubjectInput,
  type SubjectRow,
} from '../../../services/training.service';
import {
  Button,
  ConfirmDialog,
  DataTable,
  ErrorBox,
  FilterSelect,
  PageHeader,
  Pill,
  SearchInput,
  Skeleton,
  Tip,
  Toolbar,
  useToast,
  type Column,
} from '../../../components/ui';
import { IntensityPill } from '../../../components/ui/status';
import { intensityLabel, surfaceLabel, workoutLabel } from '../../../lib/labels';
import { links } from '../../../lib/links';
import type { TrainingIntensity, WorkoutType } from '../../../types/domain';
import { volumeLabel, workoutLine } from '../setup-components/helpers';
import { SubjectSheet } from './SubjectSheet';

export default function SubjectList() {
  const toast = useToast();
  const { data, loading, error, reload } = useService(() => listSubjects(), []);
  const [search, setSearch] = useState('');
  const [workout, setWorkout] = useState('');
  const [intensity, setIntensity] = useState('');
  const [editing, setEditing] = useState<{ row?: SubjectRow } | null>(null);
  const [deleting, setDeleting] = useState<SubjectRow | null>(null);
  const save = useAction();
  const remove = useAction();

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('vi');
    return (data?.rows ?? []).filter(
      (row) =>
        (!term || `${row.name} ${row.description ?? ''}`.toLocaleLowerCase('vi').includes(term)) &&
        (!workout || row.workoutType === workout) &&
        (!intensity || row.intensity === intensity),
    );
  }, [data, search, workout, intensity]);

  const canManage = !!data?.canManage;
  const unused = data?.rows.filter((row) => row.deletable).length ?? 0;

  const submit = async (input: SubjectInput) => {
    const id = await save.run(() => (editing?.row ? updateSubject(editing.row.id, input) : createSubject(input)));
    if (id) {
      toast.push(editing?.row ? 'Đã lưu môn học' : 'Đã thêm môn học', 'success');
      setEditing(null);
      reload();
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const done = await remove.run(() => deleteSubject(deleting.id));
    if (done) {
      toast.push(`Đã xóa môn "${deleting.name}"`, 'success');
      setDeleting(null);
      reload();
    }
  };

  const columns: Column<SubjectRow>[] = [
    {
      key: 'name',
      header: 'Môn học',
      className: 'min-w-[240px]',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{row.name}</p>
          {row.description && <p className="mt-0.5 line-clamp-2 max-w-md text-xs font-light text-gray-500">{row.description}</p>}
        </div>
      ),
    },
    { key: 'type', header: 'Loại bài tập', render: (row) => <span className="text-gray-700">{workoutLabel[row.workoutType]}</span> },
    {
      key: 'distance',
      header: 'Cự ly × lặp',
      render: (row) => (
        <div className="whitespace-nowrap tabular-nums">
          <p className="font-medium text-gray-800">{workoutLine(row.distanceM, row.repetitions)}</p>
          {row.repetitions > 1 && <p className="text-xs font-light text-gray-400">tổng {volumeLabel(row.volumeM)}</p>}
        </div>
      ),
    },
    { key: 'intensity', header: 'Cường độ', render: (row) => <IntensityPill intensity={row.intensity} /> },
    { key: 'surface', header: 'Mặt sân', render: (row) => <span className="whitespace-nowrap text-gray-600">{surfaceLabel[row.surface]}</span> },
    {
      key: 'usage',
      header: 'Đang dùng',
      className: 'min-w-[200px]',
      render: (row) =>
        row.usedByPrograms.length === 0 && row.usedBySessions === 0 ? (
          <span className="text-xs font-light text-gray-400">Chưa dùng ở đâu</span>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.usedByPrograms.map((program) => (
              <Link
                key={program.id}
                to={links.program(program.id)}
                onClick={(event) => event.stopPropagation()}
                className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100"
              >
                {program.name}
              </Link>
            ))}
            {row.usedBySessions > 0 && <span className="text-xs text-gray-400">{row.usedBySessions} buổi đã sinh</span>}
          </div>
        ),
    },
  ];

  if (canManage) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Tip content="Sửa môn học — buổi đã sinh giữ nguyên nội dung cũ">
            <button
              type="button"
              aria-label={`Sửa ${row.name}`}
              onClick={() => {
                save.clearError();
                setEditing({ row });
              }}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-emerald-50 hover:text-emerald-700"
            >
              <Pencil size={15} />
            </button>
          </Tip>
          <Tip content={row.deletable ? 'Xóa môn học' : `Không xóa được: ${row.blockReason}`}>
            <span>
              <button
                type="button"
                aria-label={`Xóa ${row.name}`}
                disabled={!row.deletable}
                onClick={() => {
                  remove.clearError();
                  setDeleting(row);
                }}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
              >
                <Trash2 size={15} />
              </button>
            </span>
          </Tip>
        </div>
      ),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Huấn luyện · môn học"
        title="Môn học"
        description="Nội dung huấn luyện dùng lại được: loại bài tập, cự ly, cường độ, mặt sân. Môn học không gắn với con ngựa nào; giáo án xếp các môn này theo giai đoạn."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                save.clearError();
                setEditing({});
              }}
            >
              <Plus size={16} /> Thêm môn học
            </Button>
          ) : undefined
        }
      />

      {data && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
          <span>
            <span className="font-semibold text-gray-900 tabular-nums">{data.rows.length}</span> môn học
          </span>
          <span>
            <span className="font-semibold text-gray-900 tabular-nums">{data.rows.length - unused}</span> đang được dùng
          </span>
          {unused > 0 && (
            <span>
              <span className="font-semibold text-emerald-700 tabular-nums">{unused}</span> chưa dùng, xóa được
            </span>
          )}
          {!canManage && <Pill tone="slate">Chỉ xem — thêm, sửa, xóa môn học là việc của huấn luyện viên trưởng</Pill>}
        </div>
      )}

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên hoặc mô tả…" className="min-w-[220px] flex-1" />
        <FilterSelect value={workout} onChange={setWorkout} label="Loại bài tập">
          <option value="">Mọi loại bài tập</option>
          {(Object.keys(workoutLabel) as WorkoutType[]).map((key) => (
            <option key={key} value={key}>
              {workoutLabel[key]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect value={intensity} onChange={setIntensity} label="Cường độ">
          <option value="">Mọi cường độ</option>
          {(Object.keys(intensityLabel) as TrainingIntensity[]).map((key) => (
            <option key={key} value={key}>
              {intensityLabel[key]}
            </option>
          ))}
        </FilterSelect>
      </Toolbar>

      {error && <ErrorBox message={error} />}
      {loading && !data ? (
        <Skeleton rows={6} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          emptyTitle="Không có môn học khớp bộ lọc"
          emptyHint="Bỏ bớt điều kiện lọc hoặc thêm môn học mới."
        />
      )}

      <SubjectSheet
        open={editing !== null}
        initial={editing?.row}
        pending={save.pending}
        error={save.error}
        errorField={save.field}
        onSubmit={submit}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Xóa môn học"
        message={
          <>
            Xóa môn <span className="font-semibold text-gray-900">{deleting?.name}</span>? Môn chưa được giáo án hay buổi học nào
            dùng nên xóa an toàn. Xóa là xóa mềm, vẫn giữ trong nhật ký.
          </>
        }
        confirmLabel="Xóa môn học"
        pending={remove.pending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      >
        {remove.error && <ErrorBox message={remove.error} />}
      </ConfirmDialog>
    </div>
  );
}
