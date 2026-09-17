import { create } from 'zustand';
import { horses as initialHorses, ownerships as initialOwnerships, raceRegistrations as initialRaceRegistrations, trainingPlans as initialTrainingPlans, users as initialUsers } from '../data/raceos';
import type { Horse, Ownership, RaceRegistration, TrainingPlan, TrainingSession, User } from '../types/raceos';

export type {
  HealthStatus,
  Horse,
  HorseGender,
  LifecycleStatus,
  Ownership,
  RaceAptitude,
  TrainingPlan,
  TrainingSession,
  User,
  UserRole,
} from '../types/raceos';

interface AppState {
  horses: Horse[];
  users: User[];
  ownerships: Ownership[];
  trainingPlans: TrainingPlan[];
  raceRegistrations: RaceRegistration[];
  alerts: unknown[];
  isAuthenticated: boolean;
  currentUser: User | null;
  createHorse: (horse: Horse) => void;
  updateHorse: (id: string, partialData: Partial<Horse>) => void;
  deleteHorse: (id: string) => void;
  updateOwnerships: (horseId: string, newOwnerships: Ownership[]) => void;
  saveTrainingPlan: (plan: TrainingPlan) => void;
  saveTrainingSession: (planId: string, phaseId: string, session: TrainingSession) => void;
  registerRace: (registration: RaceRegistration) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useStore = create<AppState>((set) => ({
  horses: initialHorses,
  users: initialUsers,
  ownerships: initialOwnerships,
  trainingPlans: initialTrainingPlans,
  raceRegistrations: initialRaceRegistrations,
  alerts: [],
  isAuthenticated: false,
  currentUser: null,
  createHorse: (horse) => set((state) => ({ horses: [...state.horses, horse] })),
  updateHorse: (id, partialData) =>
    set((state) => ({
      horses: state.horses.map((horse) =>
        horse.id === id ? { ...horse, ...partialData } : horse,
      ),
    })),
  deleteHorse: (id) =>
    set((state) => ({ horses: state.horses.filter((horse) => horse.id !== id) })),
  updateOwnerships: (horseId, newOwnerships) =>
    set((state) => ({
      ownerships: [
        ...state.ownerships.filter((ownership) => ownership.horseId !== horseId),
        ...newOwnerships,
      ],
    })),
  saveTrainingPlan: (plan) =>
    set((state) => ({ trainingPlans: state.trainingPlans.some((item) => item.id === plan.id) ? state.trainingPlans.map((item) => item.id === plan.id ? plan : item) : [...state.trainingPlans, plan] })),
  saveTrainingSession: (planId, phaseId, session) =>
    set((state) => ({ trainingPlans: state.trainingPlans.map((plan) => plan.id !== planId ? plan : { ...plan, phases: plan.phases.map((phase) => phase.id !== phaseId ? phase : { ...phase, sessions: phase.sessions.some((item) => item.id === session.id) ? phase.sessions.map((item) => item.id === session.id ? session : item) : [...phase.sessions, session] }) }) })),
  registerRace: (registration) =>
    set((state) => ({ raceRegistrations: state.raceRegistrations.some((item) => item.horseId === registration.horseId && item.raceId === registration.raceId) ? state.raceRegistrations : [...state.raceRegistrations, registration] })),
  login: async (email, password) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (password !== 'password123') return false;
    const user = initialUsers.find((candidate) => candidate.email === email);
    if (!user) return false;
    set({ isAuthenticated: true, currentUser: user });
    return true;
  },
  logout: () => set({ isAuthenticated: false, currentUser: null }),
}));
