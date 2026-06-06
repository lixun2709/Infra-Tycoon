import { create } from 'zustand'

export interface Contract {
  id: string
  name: string
  description: string
  reward: number
  reputationReward: number
  deadline?: number
  requirements: {
    type: string
    target: number
    current: number
  }[]
  status: 'active' | 'completed' | 'failed'
}

export interface Loan {
  id: string
  principal: number
  interestRate: number
  remainingAmount: number
  monthlyPayment: number
}

export interface GameplayState {
  balance: number
  reputation: number
  reputationHistory: number[]
  operationalBudget: number
  playerAuthority: 'GUEST' | 'OPERATOR' | 'ADMIN' | 'SIMULATION_CRITICAL'
  isAutoPilot: boolean
  isBankrupt: boolean
  consecutiveNegativeMonths: number
  activeContracts: Contract[]
  loans: Loan[]
  
  setGameplayValue: <K extends keyof Omit<GameplayState, 'setGameplayValue'>>(key: K, value: GameplayState[K]) => void
}

export const useGameplayStore = create<GameplayState>((set) => ({
  balance: 100000,
  reputation: 50,
  reputationHistory: [],
  operationalBudget: 1000000,
  playerAuthority: 'SIMULATION_CRITICAL',
  isAutoPilot: false,
  isBankrupt: false,
  consecutiveNegativeMonths: 0,
  activeContracts: [],
  loans: [],

  setGameplayValue: (key, value) => set({ [key]: value })
}))
