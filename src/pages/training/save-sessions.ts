// Lưu nhiều buổi vào một lớp theo lô (BE nhận tối đa 100 buổi một lần, hỏng một buổi là hỏng cả lô).
// Mỗi lô gửi đã xếp theo giờ, nên "Buổi N:" trong câu lỗi BE chỉ thẳng vào buổi thứ N của lô đó.
// Không ném lỗi: trả số buổi đã lưu và lỗi (nếu có) kèm buổi gây lỗi để màn hình báo đúng chỗ.
import { addSessions, listClasses, listSessions } from '../../api/training';
import type { SessionInput } from '../../api/types';
import { AppError } from '../../lib/errors';
import { clubToday } from '../../lib/club-time';
import { slotText, type BusyItem } from './schedule-rules';

const CHUNK = 100;

export interface SaveFailure {
  message: string;
  /** Buổi gây lỗi, khi đọc được từ câu lỗi BE. */
  item?: SessionInput;
}

export async function saveSessionsInChunks(classId: string, inputs: SessionInput[], onProgress?: (saved: number, total: number) => void): Promise<{ saved: number; failure?: SaveFailure }> {
  const sorted = [...inputs].sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt));
  let saved = 0;
  for (let index = 0; index < sorted.length; index += CHUNK) {
    const chunk = sorted.slice(index, index + CHUNK);
    try {
      await addSessions(classId, chunk);
      saved += chunk.length;
      onProgress?.(saved, sorted.length);
    } catch (caught) {
      return { saved, failure: describe(caught, chunk) };
    }
  }
  return { saved };
}

function describe(caught: unknown, chunk: SessionInput[]): SaveFailure {
  const raw = caught instanceof Error ? caught.message : 'Không lưu được buổi tập';
  const fromText = /^Buổi (\d+): /.exec(raw);
  const fromField = caught instanceof AppError ? Object.keys(caught.fieldErrors).map((key) => /^sessions\.(\d+)/.exec(key)).find(Boolean) : undefined;
  const position = fromText ? Number(fromText[1]) - 1 : fromField ? Number(fromField[1]) : undefined;
  const item = position !== undefined ? chunk[position] : undefined;
  const reason = raw.replace(/^Buổi \d+: /, '');
  return { message: item ? `Buổi ${item.name} ${slotText(item.scheduledStartAt)}: ${reason}` : reason, item };
}

/**
 * Buổi chưa hủy, chưa kết thúc ở các lớp khác của chính HLV (BE chặn HLV trùng giờ giữa các lớp của mình).
 * Lỗi thì coi như rỗng: BE vẫn kiểm lại khi lưu.
 */
export async function loadTrainerBusy(headTrainerId: string | undefined, excludeClassId?: string): Promise<BusyItem[]> {
  try {
    const today = clubToday();
    const classes = (await listClasses()).filter((item) => item.headTrainerId === headTrainerId && item.id !== excludeClassId && item.endDate >= today);
    const lists = await Promise.all(classes.map((item) => listSessions(item.id).then((sessions) => sessions.map((session) => ({ session, code: item.code }))).catch(() => [])));
    const at = Date.now();
    return lists
      .flat()
      .filter(({ session }) => session.status !== 'CANCELLED' && new Date(session.scheduledEndAt).getTime() > at)
      .map(({ session, code }) => ({ startAt: session.scheduledStartAt, endAt: session.scheduledEndAt, classCode: code }));
  } catch {
    return [];
  }
}
