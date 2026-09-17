import fixtureJson from './raceos.json';
import { parseRaceOSFixture } from './parse-raceos';

// API boundary: replace fixtureJson with the API payload while keeping this contract.
const fixture = parseRaceOSFixture(fixtureJson);

export const users = fixture.mockUsers;
export const ownerships = fixture.mockOwnerships;
export const horses = fixture.initialHorses;
export const upcomingRaces = fixture.upcomingRaces;
export const raceRegistrations = fixture.raceRegistrations;
export const groomTasks = fixture.groomTasks;
export const operationalAlerts = fixture.operationalAlerts;
export const inventory = fixture.inventory;
export const reportMetrics = fixture.reportMetrics;
export const reportTrend = fixture.reportTrend;
export const workflowSteps = fixture.workflowSteps;
export const trainingPlans = fixture.trainingPlans;
