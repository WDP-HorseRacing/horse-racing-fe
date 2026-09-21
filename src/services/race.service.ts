// Flow 5 — đăng ký thi đấu và báo cáo thành tích.
import type { Database, TrackSurface } from '../types/domain';
import { AppError, ERR_NOT_FOUND, newId, stamp, touch } from './db';
import { commit, pushNotification, query, requirePermission, requireUser, writeAudit } from './api';
import { visibleHorses } from '../auth/permissions';
import { findUser, ownedHorseIds, representativeOwner, zoneIdOf } from './selectors';
import { canRace } from '../lib/rules';
import { now } from '../lib/clock';
import { ageOf, daysBetween, toDateKey } from '../lib/format';

export function listRaces() {
  return query((db) => {
    requireUser();
    const at = now();
    return db.races
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((race) => ({
        id: race.id,
        name: race.name,
        date: race.date,
        venue: race.venue,
        distanceM: race.distanceM,
        surface: race.surface,
        fee: race.fee,
        purse: race.purse,
        minAge: race.minAge,
        registrationDeadline: race.registrationDeadline,
        status: race.status,
        closed: race.registrationDeadline < toDateKey(at),
        registrationCount: db.raceRegistrations.filter(
          (item) => item.raceId === race.id && item.status === 'REGISTERED',
        ).length,
      }));
  });
}

export interface RaceCandidate {
  horseId: string;
  horseName: string;
  horseAvatar?: string;
  distancePreference?: string;
  matchesPreference: boolean;
  allowed: boolean;
  reason?: string;
  alreadyRegistered: boolean;
}

function preferenceFor(distanceM: number): string {
  if (distanceM < 1400) return 'SPRINTER';
  if (distanceM <= 1800) return 'MILER';
  return 'STAYER';
}

export function listRaceCandidates(raceId: string) {
  return query((db) => {
    const user = requireUser();
    const race = db.races.find((item) => item.id === raceId);
    if (!race) throw new AppError(ERR_NOT_FOUND);
    const at = now();

    let horses = visibleHorses(db, user).filter(
      (horse) => !horse.isReference && !horse.deletedAt && horse.lifecycleStatus === 'ACTIVE',
    );
    if (user.role === 'HEAD_TRAINER') horses = horses.filter((horse) => zoneIdOf(db, horse.id) === user.zoneId);

    return horses.map<RaceCandidate>((horse) => {
      const check = canRace(db, horse);
      const age = ageOf(horse.birthDate, at);
      let allowed = check.allowed;
      let reason = check.reason;
      if (allowed && race.minAge && age !== undefined && age < race.minAge) {
        allowed = false;
        reason = `Ngựa ${age} tuổi, giải yêu cầu tối thiểu ${race.minAge} tuổi`;
      }
      return {
        horseId: horse.id,
        horseName: horse.name,
        horseAvatar: horse.avatar,
        distancePreference: horse.distancePreference,
        matchesPreference: horse.distancePreference === preferenceFor(race.distanceM),
        allowed,
        reason,
        alreadyRegistered: db.raceRegistrations.some(
          (item) =>
            item.raceId === raceId &&
            item.horseId === horse.id &&
            (item.status === 'PENDING_OWNER' || item.status === 'REGISTERED'),
        ),
      };
    });
  });
}

export function listRegistrations(filters: { raceId?: string; mineOnly?: boolean } = {}) {
  return query((db) => {
    const user = requireUser();
    const allowed = new Set(visibleHorses(db, user).map((horse) => horse.id));
    const ownIds = user.role === 'HORSE_OWNER' ? new Set(ownedHorseIds(db, user.id)) : null;

    return db.raceRegistrations
      .filter((item) => allowed.has(item.horseId))
      .filter((item) => !filters.raceId || item.raceId === filters.raceId)
      .filter((item) => !ownIds || ownIds.has(item.horseId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => {
        const race = db.races.find((race) => race.id === item.raceId);
        const horse = db.horses.find((horse) => horse.id === item.horseId);
        const representative = representativeOwner(db, item.horseId);
        return {
          id: item.id,
          raceId: item.raceId,
          raceName: race?.name ?? '—',
          raceDate: race?.date ?? '',
          distanceM: race?.distanceM ?? 0,
          horseId: item.horseId,
          horseName: horse?.name ?? '—',
          horseAvatar: horse?.avatar,
          status: item.status,
          cancelReason: item.cancelReason,
          createdByName: findUser(db, item.createdBy)?.name ?? '—',
          representativeName: representative?.name,
          canDecide:
            user.role === 'HORSE_OWNER' &&
            representative?.id === user.id &&
            item.status === 'PENDING_OWNER',
        };
      });
  });
}

export function createRegistration(raceId: string, horseId: string) {
  return commit((db) => {
    const user = requirePermission('race.register');
    const race = db.races.find((item) => item.id === raceId);
    const horse = db.horses.find((item) => item.id === horseId);
    if (!race || !horse) throw new AppError(ERR_NOT_FOUND);
    const at = now();
    if (race.registrationDeadline < toDateKey(at)) throw new AppError('Giải đã đóng đăng ký');

    const check = canRace(db, horse);
    if (!check.allowed) throw new AppError(check.reason!);

    const representative = representativeOwner(db, horseId);
    if (!representative) {
      throw new AppError('Chưa có chủ đại diện — không gửi duyệt đăng ký thi đấu được');
    }
    if (
      db.raceRegistrations.some(
        (item) =>
          item.raceId === raceId &&
          item.horseId === horseId &&
          (item.status === 'PENDING_OWNER' || item.status === 'REGISTERED'),
      )
    ) {
      throw new AppError('Ngựa đã có đăng ký cho giải này');
    }

    const registrationId = newId('rg');
    db.raceRegistrations.push({
      id: registrationId,
      raceId,
      horseId,
      status: 'PENDING_OWNER',
      createdBy: user.id,
      ...stamp(at),
    });

    pushNotification(db, at, {
      userId: representative.id,
      title: `${race.name}: chờ bạn duyệt đăng ký của ${horse.name}`,
      body: `Ngày đua ${race.date}, cự ly ${race.distanceM} m. Phí đăng ký ${race.fee.toLocaleString('vi-VN')} đ.`,
      link: '/races/approvals',
    });

    writeAudit(db, at, {
      action: 'Tạo đăng ký thi đấu',
      entityType: 'RaceRegistration',
      entityId: registrationId,
      after: { raceId, horseId },
      actor: user,
    });
    return registrationId;
  });
}

export function decideRegistration(registrationId: string, approve: boolean, note?: string) {
  return commit((db) => {
    const user = requirePermission('race.approve');
    const registration = db.raceRegistrations.find((item) => item.id === registrationId);
    if (!registration) throw new AppError(ERR_NOT_FOUND);
    const representative = representativeOwner(db, registration.horseId);
    if (representative?.id !== user.id) throw new AppError('Chỉ chủ đại diện mới duyệt được đăng ký này');
    if (registration.status !== 'PENDING_OWNER') throw new AppError('Đăng ký này đã được xử lý');

    const at = now();
    registration.status = approve ? 'REGISTERED' : 'REJECTED';
    registration.ownerDecisionBy = user.id;
    registration.cancelReason = approve ? undefined : note?.trim();
    touch(registration, at);

    const race = db.races.find((item) => item.id === registration.raceId);
    if (approve && race) {
      db.expenses.push({
        id: newId('ex'),
        horseId: registration.horseId,
        category: 'RACE_FEE',
        amount: race.fee,
        date: toDateKey(at),
        sourceType: 'RACE_REGISTRATION',
        sourceId: registration.id,
        note: `Phí đăng ký ${race.name}`,
        ...stamp(at),
      });
    }

    pushNotification(db, at, {
      userId: registration.createdBy,
      title: approve ? 'Chủ ngựa đã duyệt đăng ký' : 'Chủ ngựa từ chối đăng ký',
      body: `${db.horses.find((h) => h.id === registration.horseId)?.name} — ${race?.name}`,
      link: '/races',
    });

    writeAudit(db, at, {
      action: approve ? 'Duyệt đăng ký thi đấu' : 'Từ chối đăng ký thi đấu',
      entityType: 'RaceRegistration',
      entityId: registrationId,
      before: { status: 'PENDING_OWNER' },
      after: { status: registration.status },
      reason: note,
      actor: user,
    });
  });
}

export function listResults(raceId?: string) {
  return query((db) => {
    requireUser();
    return db.raceResults
      .filter((item) => !raceId || item.raceId === raceId)
      .map((item) => ({
        id: item.id,
        raceId: item.raceId,
        raceName: db.races.find((race) => race.id === item.raceId)?.name ?? '—',
        raceDate: db.races.find((race) => race.id === item.raceId)?.date ?? '',
        horseId: item.horseId,
        horseName: db.horses.find((horse) => horse.id === item.horseId)?.name ?? '—',
        rank: item.rank,
        timeSeconds: item.timeSeconds,
        prize: item.prize,
      }))
      .sort((a, b) => b.raceDate.localeCompare(a.raceDate) || a.rank - b.rank);
  });
}

export function saveResult(input: { raceId: string; horseId: string; rank: number; timeSeconds: number; prize: number }) {
  return commit((db) => {
    const user = requirePermission('race.manage');
    const race = db.races.find((item) => item.id === input.raceId);
    if (!race) throw new AppError(ERR_NOT_FOUND);
    const at = now();
    if (race.date > toDateKey(at)) throw new AppError('Chưa tới ngày đua, chưa nhập được kết quả');
    if (input.rank < 1) throw new AppError('Thứ hạng phải từ 1 trở lên', 'rank');

    const existing = db.raceResults.find(
      (item) => item.raceId === input.raceId && item.horseId === input.horseId,
    );
    if (existing) {
      Object.assign(existing, input);
      touch(existing, at);
    } else {
      db.raceResults.push({ id: newId('rres'), ...input, ...stamp(at) });
    }
    race.status = 'FINISHED';
    touch(race, at);

    writeAudit(db, at, {
      action: 'Nhập kết quả thi đấu',
      entityType: 'RaceResult',
      entityId: `${input.raceId}:${input.horseId}`,
      after: input,
      actor: user,
    });
  });
}

export function createRace(input: {
  name: string;
  date: string;
  venue: string;
  distanceM: number;
  surface: TrackSurface;
  fee: number;
  purse: number;
  minAge?: number;
  registrationDeadline: string;
}) {
  return commit((db) => {
    const user = requirePermission('race.manage');
    if (!input.name.trim()) throw new AppError('Vui lòng nhập tên giải', 'name');
    if (!input.date) throw new AppError('Vui lòng chọn ngày đua', 'date');
    if (input.registrationDeadline > input.date) {
      throw new AppError('Hạn đăng ký phải trước ngày đua', 'registrationDeadline');
    }
    const at = now();
    db.races.push({ id: newId('race'), ...input, name: input.name.trim(), status: 'OPEN', ...stamp(at) });
    writeAudit(db, at, { action: 'Tạo giải đua', entityType: 'Race', entityId: input.name, after: input, actor: user });
  });
}

/* ===== F5.4 — báo cáo ===== */

function boardingCost(db: Database, horseId: string, from: Date, to: Date): number {
  const horse = db.horses.find((item) => item.id === horseId);
  const rate = horse?.dailyRate ?? db.settings.defaultDailyRate;
  return Math.max(0, daysBetween(from, to)) * rate;
}

export function getOwnerReport(months = 3) {
  return query((db) => {
    const user = requireUser();
    const at = now();
    const ownerId = user.role === 'HORSE_OWNER' ? user.id : undefined;

    const periods = Array.from({ length: months }, (_, index) => {
      const end = new Date(at.getFullYear(), at.getMonth() - index + 1, 0);
      const start = new Date(at.getFullYear(), at.getMonth() - index, 1);
      return { label: `Tháng ${start.getMonth() + 1}/${start.getFullYear()}`, start, end };
    });

    const relevant = db.ownerships.filter((item) => !ownerId || item.ownerId === ownerId);
    const horseIds = [...new Set(relevant.map((item) => item.horseId))];

    return horseIds.map((horseId) => {
      const horse = db.horses.find((item) => item.id === horseId);
      const share = relevant.find((item) => item.horseId === horseId);
      const percent = share?.percent ?? 100;
      const ownedFrom = share ? new Date(share.startDate) : new Date(0);
      const ownedTo = share?.endDate ? new Date(share.endDate) : at;

      const rows = periods.map((period) => {
        // Chỉ tính phần nằm trong thời gian người này sở hữu.
        const from = period.start > ownedFrom ? period.start : ownedFrom;
        const to = period.end < ownedTo ? period.end : ownedTo;
        const active = to >= from;

        const inRange = (date: string) => active && date >= toDateKey(from) && date <= toDateKey(to);
        const sum = (category: string) =>
          db.expenses
            .filter((item) => item.horseId === horseId && item.category === category && inRange(item.date))
            .reduce((total, item) => total + item.amount, 0);

        const prize = db.raceResults
          .filter((item) => item.horseId === horseId)
          .filter((item) => {
            const race = db.races.find((race) => race.id === item.raceId);
            return race ? inRange(race.date) : false;
          })
          .reduce((total, item) => total + item.prize, 0);

        const boarding = active ? boardingCost(db, horseId, from, to) : 0;
        const medical = sum('MEDICAL');
        const raceFee = sum('RACE_FEE');
        const other = sum('OTHER');
        const total = boarding + medical + raceFee + other;

        return {
          label: period.label,
          boarding,
          medical,
          raceFee,
          other,
          prize,
          total,
          myShare: Math.round(((total - prize) * percent) / 100),
          myPrize: Math.round((prize * percent) / 100),
        };
      });

      return {
        horseId,
        horseName: horse?.name ?? '—',
        horseAvatar: horse?.avatar,
        percent,
        rows,
      };
    });
  });
}

export function getClubReport() {
  return query((db) => {
    requirePermission('report.club');
    const at = now();
    const periods = Array.from({ length: 3 }, (_, index) => {
      const start = new Date(at.getFullYear(), at.getMonth() - index, 1);
      const end = new Date(at.getFullYear(), at.getMonth() - index + 1, 0);
      return { label: `Tháng ${start.getMonth() + 1}/${start.getFullYear()}`, start, end };
    }).reverse();

    return {
      operations: db.zones.map((zone) => ({
        zoneName: zone.name,
        rows: periods.map((period) => ({
          label: period.label,
          amount: db.expenses
            .filter(
              (item) =>
                item.zoneId === zone.id &&
                item.category === 'OPERATION' &&
                item.date >= toDateKey(period.start) &&
                item.date <= toDateKey(period.end),
            )
            .reduce((total, item) => total + item.amount, 0),
        })),
      })),
      raceRevenue: db.races
        .filter((race) => race.status === 'FINISHED')
        .map((race) => ({
          name: race.name,
          date: race.date,
          fees: db.raceRegistrations.filter((item) => item.raceId === race.id && item.status === 'REGISTERED').length * race.fee,
          prizes: db.raceResults
            .filter((item) => item.raceId === race.id)
            .reduce((total, item) => total + item.prize, 0),
        })),
      medicalTotal: db.expenses
        .filter((item) => item.category === 'MEDICAL')
        .reduce((total, item) => total + item.amount, 0),
    };
  });
}

export function getHorseExpenses(horseId: string) {
  return query((db) => {
    const user = requireUser();
    const at = now();
    const share = user.role === 'HORSE_OWNER'
      ? db.ownerships.find((item) => item.horseId === horseId && item.ownerId === user.id && !item.endDate)
      : undefined;
    const percent = share?.percent ?? 100;

    const expenses = db.expenses
      .filter((item) => item.horseId === horseId)
      // Chủ ngựa không thấy khoản vận hành chung.
      .filter((item) => user.role !== 'HORSE_OWNER' || item.category !== 'OPERATION')
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((item) => ({
        id: item.id,
        category: item.category,
        amount: item.amount,
        myAmount: Math.round((item.amount * percent) / 100),
        date: item.date,
        note: item.note,
      }));

    const horse = db.horses.find((item) => item.id === horseId);
    const monthStart = new Date(at.getFullYear(), at.getMonth(), 1);
    return {
      percent,
      boardingThisMonth: boardingCost(db, horseId, monthStart, at),
      dailyRate: horse?.dailyRate ?? db.settings.defaultDailyRate,
      expenses,
      prizes: db.raceResults
        .filter((item) => item.horseId === horseId)
        .map((item) => ({
          raceName: db.races.find((race) => race.id === item.raceId)?.name ?? '—',
          date: db.races.find((race) => race.id === item.raceId)?.date ?? '',
          rank: item.rank,
          prize: item.prize,
          myPrize: Math.round((item.prize * percent) / 100),
        })),
    };
  });
}

export function getHorseRaceHistory(horseId: string) {
  return query((db) => {
    requireUser();
    return db.raceResults
      .filter((item) => item.horseId === horseId)
      .map((item) => {
        const race = db.races.find((race) => race.id === item.raceId);
        return {
          id: item.id,
          raceName: race?.name ?? '—',
          date: race?.date ?? '',
          distanceM: race?.distanceM ?? 0,
          surface: race?.surface,
          rank: item.rank,
          timeSeconds: item.timeSeconds,
          prize: item.prize,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  });
}
