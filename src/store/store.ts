import { create } from 'zustand';

export type RaceAptitude = 'SPRINTER' | 'MILER' | 'STAYER';
export type HealthStatus = 'ELIGIBLE' | 'UNDER_OBSERVATION' | 'INJURED' | 'QUARANTINED';
export type LifecycleStatus = 'ACTIVE' | 'RETIRED' | 'TRANSFERRED';
export type HorseGender = 'MALE' | 'FEMALE' | 'GELDING';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'HEAD_TRAINER' | 'CLUB_MANAGER' | 'HORSE_OWNER';
  avatar: string;
}

export interface PrimaryOwner {
  id: string;
  name: string;
  percentage: number;
}

export interface Ownership {
  horseId: string;
  ownerId: string;
  percentage: number;
}

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
}

export interface TrainingPlan {
  horseId: string;
  distance: string;
  workload: 'Light' | 'Moderate' | 'Heavy';
  surface: 'Turf' | 'Dirt' | 'Sand';
  energy_mcal: number;
  concentrate_percentage: number;
}

const mockUsers: User[] = [
  { id: 'u1', name: 'Dr. Nguyen', email: 'trainer@gmail.com', role: 'HEAD_TRAINER', avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=150&h=150&auto=format&fit=crop' },
  { id: 'u2', name: 'Mr. John', email: 'manager@gmail.com', role: 'CLUB_MANAGER', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&h=150&auto=format&fit=crop' },
  { id: 'u3', name: 'Sheikh Mohammed', email: 'owner@gmail.com', role: 'HORSE_OWNER', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&h=150&auto=format&fit=crop' },
  { id: 'u4', name: 'Sarah Connor', email: 'sarah@gmail.com', role: 'HORSE_OWNER', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150&h=150&auto=format&fit=crop' },
];

const mockOwnerships: Ownership[] = [
  { horseId: 'h1', ownerId: 'u3', percentage: 60 },
  { horseId: 'h1', ownerId: 'u4', percentage: 40 },
  { horseId: 'h2', ownerId: 'u2', percentage: 100 },
  { horseId: 'h3', ownerId: 'u3', percentage: 51 },
  { horseId: 'h3', ownerId: 'u1', percentage: 49 },
  { horseId: 'h4', ownerId: 'u4', percentage: 75 },
  { horseId: 'h4', ownerId: 'u3', percentage: 25 },
];

// MOCK PEDIGREE DATA (30 horses)
const pedigreeHorses: Horse[] = [];

const createMockHorse = (id: string, name: string, gender: HorseGender, avatarId: number, aptitude: RaceAptitude, sireId?: string, damId?: string): Horse => ({
  id, name, dateOfBirth: '2015-01-01', gender, breed: 'Thoroughbred', color: 'Bay', microchipId: `985${id}`, healthStatus: 'ELIGIBLE', lifecycleStatus: 'ACTIVE', fitness: 100, weight: 500, currentPhase: 'Base', lastTraining: 'N/A', age: 8, raceReadiness: 'High', avatar: `https://images.unsplash.com/photo-${avatarId}?q=80&w=150&h=150&auto=format&fit=crop`, race_aptitude: aptitude, sireId, damId
});

// Gen 1 (Target)
const targetHorse = createMockHorse('h1', 'Thunder King', 'MALE', 1553310461, 'SPRINTER', 'sire1', 'dam1');

// Gen 2 (Parents)
const sire1 = createMockHorse('sire1', 'Storm Catcher', 'MALE', 1534438097544, 'SPRINTER', 'sire2_1', 'dam2_1');
const dam1 = createMockHorse('dam1', 'Midnight Breeze', 'FEMALE', 1598974357801, 'MILER', 'sire2_2', 'dam2_2');

// Gen 3 (Grandparents)
const sire2_1 = createMockHorse('sire2_1', 'Wind Chaser', 'MALE', 1615560410492, 'SPRINTER', 'sire3_1', 'dam3_1');
const dam2_1 = createMockHorse('dam2_1', 'Lightning Strike', 'FEMALE', 1553310461, 'STAYER', 'sire3_2', 'dam3_2');
const sire2_2 = createMockHorse('sire2_2', 'Shadow Fax', 'MALE', 1534438097544, 'MILER', 'sire3_3', 'dam3_3');
const dam2_2 = createMockHorse('dam2_2', 'Silver Cloud', 'FEMALE', 1598974357801, 'MILER', 'sire3_4', 'dam3_4');

// Gen 4 (Great-Grandparents)
const sire3_1 = createMockHorse('sire3_1', 'Gen3 Sire 1', 'MALE', 1615560410492, 'SPRINTER');
const dam3_1 = createMockHorse('dam3_1', 'Gen3 Dam 1', 'FEMALE', 1553310461, 'SPRINTER');
const sire3_2 = createMockHorse('sire3_2', 'Gen3 Sire 2', 'MALE', 1534438097544, 'STAYER');
const dam3_2 = createMockHorse('dam3_2', 'Gen3 Dam 2', 'FEMALE', 1598974357801, 'STAYER');
const sire3_3 = createMockHorse('sire3_3', 'Gen3 Sire 3', 'MALE', 1615560410492, 'MILER');
const dam3_3 = createMockHorse('dam3_3', 'Gen3 Dam 3', 'FEMALE', 1553310461, 'MILER');
const sire3_4 = createMockHorse('sire3_4', 'Gen3 Sire 4', 'MALE', 1534438097544, 'MILER');
const dam3_4 = createMockHorse('dam3_4', 'Gen3 Dam 4', 'FEMALE', 1598974357801, 'MILER');

const initialHorses: Horse[] = [
  targetHorse, sire1, dam1, sire2_1, dam2_1, sire2_2, dam2_2, sire3_1, dam3_1, sire3_2, dam3_2, sire3_3, dam3_3, sire3_4, dam3_4,
  { id: 'h2', name: 'Silver Arrow', dateOfBirth: '2023-01-20', gender: 'FEMALE', breed: 'Thoroughbred', color: 'Grey', microchipId: '985121028743211', healthStatus: 'UNDER_OBSERVATION', lifecycleStatus: 'ACTIVE', fitness: 75, weight: 498, currentPhase: 'Speed Work', lastTraining: '800 m', age: 3, raceReadiness: 'Medium', avatar: 'https://images.unsplash.com/photo-1598974357801-cbca100e65d3?q=80&w=200&h=200&auto=format&fit=crop', race_aptitude: 'MILER', sireId: 'sire2_2', damId: 'dam2_2', primaryOwner: { id: 'u2', name: 'Dubai Racing Club', percentage: 100 } },
  { id: 'h3', name: 'Red Storm', dateOfBirth: '2021-11-10', gender: 'MALE', breed: 'Thoroughbred', color: 'Chestnut', microchipId: '985121028743212', healthStatus: 'INJURED', lifecycleStatus: 'ACTIVE', fitness: 60, weight: 520, currentPhase: 'Recovery', lastTraining: 'No training (Locked)', age: 5, raceReadiness: 'Low', avatar: 'https://images.unsplash.com/photo-1534438097544-59cb468903c7?q=80&w=200&h=200&auto=format&fit=crop', race_aptitude: 'STAYER', primaryOwner: { id: 'u3', name: 'Highflyer Syndicate', percentage: 51 } },
  { id: 'h4', name: 'Night Eclipse', dateOfBirth: '2022-06-05', gender: 'GELDING', breed: 'Thoroughbred', color: 'Black', microchipId: '985121028743213', healthStatus: 'ELIGIBLE', lifecycleStatus: 'ACTIVE', fitness: 88, weight: 505, currentPhase: 'Race Prep', lastTraining: '1,600 m (Live)', age: 4, raceReadiness: 'Peak', avatar: 'https://images.unsplash.com/photo-1615560410492-a1b7e41d8e12?q=80&w=200&h=200&auto=format&fit=crop', race_aptitude: 'SPRINTER', primaryOwner: { id: 'u4', name: 'Starlight Racing', percentage: 75 } }
];

interface AppState {
  horses: Horse[];
  users: User[];
  ownerships: Ownership[];
  trainingPlans: Record<string, TrainingPlan>;
  alerts: any[];
  isAuthenticated: boolean;
  currentUser: User | null;
  createHorse: (horse: Horse) => void;
  updateHorse: (id: string, partialData: Partial<Horse>) => void;
  deleteHorse: (id: string) => void;
  updateOwnerships: (horseId: string, newOwnerships: Ownership[]) => void;
  saveTrainingPlan: (plan: TrainingPlan) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useStore = create<AppState>((set) => ({
  horses: initialHorses,
  users: mockUsers,
  ownerships: mockOwnerships,
  trainingPlans: {},
  alerts: [],
  isAuthenticated: false,
  currentUser: null,
  createHorse: (horse) => set((state) => ({ horses: [...state.horses, horse] })),
  updateHorse: (id, partialData) => set((state) => ({
    horses: state.horses.map(h => h.id === id ? { ...h, ...partialData } : h)
  })),
  deleteHorse: (id) => set((state) => ({
    horses: state.horses.filter(h => h.id !== id)
  })),
  updateOwnerships: (horseId, newOwnerships) => set((state) => ({
    ownerships: [
      ...state.ownerships.filter(o => o.horseId !== horseId),
      ...newOwnerships
    ]
  })),
  saveTrainingPlan: (plan) => set((state) => ({
    trainingPlans: { ...state.trainingPlans, [plan.horseId]: plan }
  })),
  login: async (email, password) => { console.log('Login attempt:', {email, password, mockUsers});
    await new Promise(resolve => setTimeout(resolve, 800));
    if (password === 'password123') {
      const user = mockUsers.find(u => u.email === email);
      if (user) {
        set({ isAuthenticated: true, currentUser: user });
        return true;
      }
    }
    return false;
  },
  logout: () => set({ isAuthenticated: false, currentUser: null }),
}));