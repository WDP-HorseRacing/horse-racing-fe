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
  isInTraining?: boolean;
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
  { horseId: 'goldship', ownerId: 'u3', percentage: 60 },
  { horseId: 'goldship', ownerId: 'u4', percentage: 40 },
  { horseId: 'winx', ownerId: 'u3', percentage: 51 },
  { horseId: 'winx', ownerId: 'u1', percentage: 49 },
];

// =====================================================
// REAL HORSE DATA — Goldship Family (JPN) + Winx Family (AUS)
// Sources: Wikipedia, JBIS, Racing Australia, PedigreeQuery
// =====================================================

const initialHorses: Horse[] = [
  // ===== GOLDSHIP FAMILY =====

  // Gen 1 — Target
  {
    id: 'goldship',
    name: 'Gold Ship',
    dateOfBirth: '2009-03-06',
    gender: 'MALE',
    breed: 'Thoroughbred',
    color: 'Grey',
    microchipId: 'JPN2009030601',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'RETIRED',
    fitness: 85,
    weight: 508,
    currentPhase: 'Stud Duty',
    lastTraining: 'N/A (Retired)',
    age: 17,
    raceReadiness: 'Low',
    avatar: '/gold-ship.png',
    race_aptitude: 'STAYER',
    sireId: 'staygold',
    damId: 'pointflag',
    primaryOwner: { id: 'u3', name: 'Sheikh Mohammed', percentage: 60 },
  },

  // Gen 2 — Parents
  {
    id: 'staygold',
    name: 'Stay Gold',
    dateOfBirth: '1994-03-24',
    gender: 'MALE',
    breed: 'Thoroughbred',
    color: 'Dark Bay',
    microchipId: 'JPN1994032401',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'RETIRED',
    fitness: 0,
    weight: 478,
    currentPhase: 'Deceased',
    lastTraining: 'N/A',
    age: 21, // died 2015
    raceReadiness: 'Low',
    avatar: '/stay-gold.jpg',
    race_aptitude: 'STAYER',
    sireId: 'sundaysilence',
    damId: 'goldensash',
  },
  {
    id: 'pointflag',
    name: 'Point Flag',
    dateOfBirth: '2001-04-10',
    gender: 'FEMALE',
    breed: 'Thoroughbred',
    color: 'Bay',
    microchipId: 'JPN2001041001',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'RETIRED',
    fitness: 0,
    weight: 460,
    currentPhase: 'Broodmare (Retired)',
    lastTraining: 'N/A',
    age: 25,
    raceReadiness: 'Low',
    avatar: '/point-flag.jpg',
    race_aptitude: 'MILER',
    sireId: 'mejiromcqueen',
    damId: 'pastoralism',
  },

  // Gen 3 — Grandparents (Sire side)
  {
    id: 'sundaysilence',
    name: 'Sunday Silence',
    dateOfBirth: '1986-03-25',
    gender: 'MALE',
    breed: 'Thoroughbred',
    color: 'Dark Brown',
    microchipId: 'USA1986032501',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'RETIRED',
    fitness: 0,
    weight: 490,
    currentPhase: 'Deceased (2002)',
    lastTraining: 'N/A',
    age: 16, // died 2002
    raceReadiness: 'Low',
    avatar: '/sunday-silence.jpg',
    race_aptitude: 'MILER',
  },
  {
    id: 'goldensash',
    name: 'Golden Sash',
    dateOfBirth: '1988-04-23',
    gender: 'FEMALE',
    breed: 'Thoroughbred',
    color: 'Chestnut',
    microchipId: 'JPN1988042301',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'RETIRED',
    fitness: 0,
    weight: 440,
    currentPhase: 'Broodmare (Retired)',
    lastTraining: 'N/A',
    age: 38,
    raceReadiness: 'Low',
    avatar: '/golden-sash.jpg',
    race_aptitude: 'MILER',
  },

  // Gen 3 — Grandparents (Dam side)
  {
    id: 'mejiromcqueen',
    name: 'Mejiro McQueen',
    dateOfBirth: '1987-04-03',
    gender: 'MALE',
    breed: 'Thoroughbred',
    color: 'Grey',
    microchipId: 'JPN1987040301',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'RETIRED',
    fitness: 0,
    weight: 498,
    currentPhase: 'Deceased (2006)',
    lastTraining: 'N/A',
    age: 19, // died 2006
    raceReadiness: 'Low',
    avatar: '/Mejiro-McQueen.jpg',
    race_aptitude: 'STAYER',
  },
  {
    id: 'pastoralism',
    name: 'Pastoralism',
    dateOfBirth: '1994-01-01',
    gender: 'FEMALE',
    breed: 'Thoroughbred',
    color: 'Bay',
    microchipId: 'JPN1994010101',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'RETIRED',
    fitness: 0,
    weight: 450,
    currentPhase: 'Broodmare',
    lastTraining: 'N/A',
    age: 32,
    raceReadiness: 'Low',
    avatar: '', // No photo available
    race_aptitude: 'MILER',
  },

  // ===== WINX FAMILY =====

  // Gen 1 — Target (STILL ALIVE)
  {
    id: 'winx',
    name: 'Winx',
    dateOfBirth: '2011-09-14',
    gender: 'FEMALE',
    breed: 'Thoroughbred',
    color: 'Bay',
    microchipId: 'AUS2011091401',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'RETIRED',
    fitness: 90,
    weight: 490,
    currentPhase: 'Broodmare',
    lastTraining: 'N/A (Retired 2019)',
    age: 14,
    raceReadiness: 'Low',
    avatar: '/winx.jpg',
    race_aptitude: 'MILER',
    sireId: 'streetcry',
    damId: 'vegasshowgirl',
    primaryOwner: { id: 'u3', name: 'Sheikh Mohammed', percentage: 51 },
    isInTraining: false,
  },

  // Gen 2 — Parents
  {
    id: 'streetcry',
    name: 'Street Cry',
    dateOfBirth: '1998-03-11',
    gender: 'MALE',
    breed: 'Thoroughbred',
    color: 'Dark Bay',
    microchipId: 'IRE1998031101',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'RETIRED',
    fitness: 0,
    weight: 510,
    currentPhase: 'Deceased (2014)',
    lastTraining: 'N/A',
    age: 16, // died 2014
    raceReadiness: 'Low',
    avatar: '/street-cry.jpg',
    race_aptitude: 'MILER',
    sireId: 'machiavellian',
    damId: 'helenstreet',
  },
  {
    id: 'vegasshowgirl',
    name: 'Vegas Showgirl',
    dateOfBirth: '2002-10-06',
    gender: 'FEMALE',
    breed: 'Thoroughbred',
    color: 'Bay',
    microchipId: 'NZL2002100601',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'RETIRED',
    fitness: 0,
    weight: 470,
    currentPhase: 'Deceased (2023)',
    lastTraining: 'N/A',
    age: 21, // died 2023
    raceReadiness: 'Low',
    avatar: '/vegas-showgirl.jpg',
    race_aptitude: 'SPRINTER',
    sireId: 'alakbar',
    damId: 'vegasmagic',
  },

  // Gen 3 — Grandparents (Sire side)
  {
    id: 'machiavellian',
    name: 'Machiavellian',
    dateOfBirth: '1987-01-31',
    gender: 'MALE',
    breed: 'Thoroughbred',
    color: 'Bay',
    microchipId: 'USA1987013101',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'RETIRED',
    fitness: 0,
    weight: 500,
    currentPhase: 'Deceased (2004)',
    lastTraining: 'N/A',
    age: 17, // died 2004
    raceReadiness: 'Low',
    avatar: '/MACHIAVELLIAN.jpg',
    race_aptitude: 'SPRINTER',
  },
  {
    id: 'helenstreet',
    name: 'Helen Street',
    dateOfBirth: '1982-04-04',
    gender: 'FEMALE',
    breed: 'Thoroughbred',
    color: 'Bay',
    microchipId: 'GBR1982040401',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'RETIRED',
    fitness: 0,
    weight: 460,
    currentPhase: 'Broodmare (Retired)',
    lastTraining: 'N/A',
    age: 44,
    raceReadiness: 'Low',
    avatar: '/helen-street.jpg',
    race_aptitude: 'MILER',
  },

  // Gen 3 — Grandparents (Dam side)
  {
    id: 'alakbar',
    name: 'Al Akbar',
    dateOfBirth: '1990-11-07',
    gender: 'MALE',
    breed: 'Thoroughbred',
    color: 'Bay',
    microchipId: 'AUS1990110701',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'RETIRED',
    fitness: 0,
    weight: 490,
    currentPhase: 'Deceased',
    lastTraining: 'N/A',
    age: 36,
    raceReadiness: 'Low',
    avatar: '/al-akbar.jpg',
    race_aptitude: 'SPRINTER',
  },
  {
    id: 'vegasmagic',
    name: 'Vegas Magic',
    dateOfBirth: '1985-01-01',
    gender: 'FEMALE',
    breed: 'Thoroughbred',
    color: 'Bay',
    microchipId: 'AUS1985010101',
    healthStatus: 'ELIGIBLE',
    lifecycleStatus: 'RETIRED',
    fitness: 0,
    weight: 450,
    currentPhase: 'Broodmare (Retired)',
    lastTraining: 'N/A',
    age: 41,
    raceReadiness: 'Low',
    avatar: '/vegas-magic.jpg',
    race_aptitude: 'MILER',
  },
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