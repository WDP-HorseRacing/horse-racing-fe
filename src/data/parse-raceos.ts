import type { RaceOSFixture } from '../types/raceos';

const arrayKeys: (keyof RaceOSFixture)[] = [
  'mockUsers', 'mockOwnerships', 'initialHorses', 'upcomingRaces', 'groomTasks',
  'operationalAlerts', 'inventory', 'reportMetrics', 'reportTrend', 'workflowSteps',
  'trainingPlans', 'raceRegistrations',
];

export function parseRaceOSFixture(value: unknown): RaceOSFixture {
  if (!value || typeof value !== 'object') throw new Error('Invalid RaceOS payload: object expected');
  const record = value as Record<string, unknown>;
  for (const key of arrayKeys) {
    if (!Array.isArray(record[key])) throw new Error(`Invalid RaceOS payload: ${key} must be an array`);
  }
  for (const horse of record.initialHorses as Record<string, unknown>[]) {
    if (!horse || typeof horse.id !== 'string' || typeof horse.name !== 'string') {
      throw new Error('Invalid RaceOS payload: every horse requires string id and name');
    }
  }
  return value as RaceOSFixture;
}
