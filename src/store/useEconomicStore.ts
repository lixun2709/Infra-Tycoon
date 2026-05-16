import { create } from 'zustand';
import type { ActiveContract } from './infraTypes';

interface EconomicState {
  balance: number;
  reputation: number;
  activeContracts: ActiveContract[];
  operationalBudget: number;

  updateBalance: (delta: number) => void;
  updateReputation: (delta: number) => void;
  addContract: (contract: ActiveContract) => void;
  removeContract: (id: string) => void;
}

export const useEconomicStore = create<EconomicState>((set) => ({
  balance: 1000000,
  reputation: 85,
  activeContracts: [],
  operationalBudget: 1000000,

  updateBalance: (delta) => set((state) => ({ balance: state.balance + delta })),
  updateReputation: (delta) => set((state) => ({ reputation: Math.max(0, Math.min(100, state.reputation + delta)) })),
  addContract: (contract) => set((state) => ({ activeContracts: [...state.activeContracts, contract] })),
  removeContract: (id) => set((state) => ({ activeContracts: state.activeContracts.filter(c => c.id !== id) })),
}));
