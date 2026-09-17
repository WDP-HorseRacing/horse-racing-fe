export type RaceAptitude = 'SPRINTER' | 'MILER' | 'STAYER';
export type HealthStatus = 'ELIGIBLE' | 'UNDER_OBSERVATION' | 'INJURED' | 'QUARANTINED';
export type LifecycleStatus = 'ACTIVE' | 'RETIRED' | 'TRANSFERRED';
export type HorseGender = 'MALE' | 'FEMALE' | 'GELDING';
export type UserRole = 'HEAD_TRAINER' | 'CLUB_MANAGER' | 'HORSE_OWNER' | 'VETERINARIAN' | 'GROOM';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
}

export interface PrimaryOwner { id: string; name: string; percentage: number }
export interface Ownership { horseId: string; ownerId: string; percentage: number }

export interface Horse {
  id: string;
  name: string;
  dateOfBirth: string;
  gender: HorseGender;
  breed: string;
  color: string;
  microchipId: string;
  healthStatus: HealthStatus;
  lifecycleStatus: LifecycleStatus;
  fitness: number;
  weight: number;
  currentPhase: string;
  lastTraining: string;
  age: number;
  raceReadiness: 'High' | 'Medium' | 'Low' | 'Peak';
  avatar: string;
  race_aptitude: RaceAptitude;
  sireId?: string;
  damId?: string;
  primaryOwner?: PrimaryOwner;
  isInTraining?: boolean;
}

export type SessionStatus = 'planned' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type PlanStatus = 'draft' | 'active' | 'completed' | 'suspended';
export interface TrainingSession {
  id: string;
  date: string;
  time: string;
  title: string;
  type: string;
  objective: string;
  distanceM: number;
  durationMin: number;
  intensity: 'Light' | 'Moderate' | 'High';
  workloadPercent: number;
  surface: 'Soft' | 'Turf' | 'Dirt' | 'Synthetic' | 'Sand';
  status: SessionStatus;
  assignedGroom: string;
  note: string;
  energyMcal: number;
  concentratePercent: number;
}
export interface TrainingPhase { id: string; name: string; objective: string; order: number; startDate: string; endDate: string; sessions: TrainingSession[] }
export interface TrainingPlan { id: string; horseId: string; name: string; objective: string; status: PlanStatus; startDate: string; endDate: string; targetEvent: string; note: string; phases: TrainingPhase[]; publishedAt: string }

export interface UpcomingRace { id: string; name: string; dist: number; date: string; venue: string }
export interface RaceRegistration { id: string; horseId: string; raceId: string; submittedBy: string; status: 'submitted' | 'approved' | 'rejected'; createdAt: string }
export interface GroomTaskFixture { time: string; horse: string; detail: string }
export interface OperationalAlert { severity: 'Critical' | 'Warning' | 'Info'; horse: string; detail: string }
export interface InventoryFixture { name: string; stock: string; low: boolean }
export interface ReportMetric { label: string; value: string }
export interface WorkflowStep { role: string; action: string }

export interface RaceOSFixture {
  mockUsers: User[];
  mockOwnerships: Ownership[];
  initialHorses: Horse[];
  upcomingRaces: UpcomingRace[];
  raceRegistrations: RaceRegistration[];
  groomTasks: GroomTaskFixture[];
  operationalAlerts: OperationalAlert[];
  inventory: InventoryFixture[];
  reportMetrics: ReportMetric[];
  reportTrend: number[];
  workflowSteps: WorkflowStep[];
  trainingPlans: TrainingPlan[];
}
