import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import { CONTRACT_CATALOG } from '../../physics/contractLibrary'

export interface EconomySlice {
  processEconomyTick: (dt: number) => void
  chargeMaintenanceCost: (amount: number, reason: string) => boolean
}

export const createEconomySlice: StateCreator<InfraState, [], [], EconomySlice> = (set, get) => ({
  chargeMaintenanceCost: (amount: number, reason: string) => {
    const { balance, pushAlert } = get()
    if (balance < amount) {
      pushAlert('critical', `BANKRUPTCY WARNING: Insufficient funds for ${reason}. Overdrafting!`)
    }
    set(state => ({ balance: state.balance - amount }))
    return true
  },

  processEconomyTick: (dt: number) => {
    const { 
      nodes, 
      activeContracts, 
      realTimePlayedSeconds, 
      balance, 
      reputation,
      pushAlert
    } = get()

    const SECONDS_PER_MONTH = 3600
    const nextRealTimePlayedSeconds = realTimePlayedSeconds + dt
    const oldFloor = Math.floor(realTimePlayedSeconds / SECONDS_PER_MONTH)
    const newFloor = Math.floor(nextRealTimePlayedSeconds / SECONDS_PER_MONTH)
    const isMonthEnd = newFloor > oldFloor
    
    let monthlyRevenue = 0
    let monthlyPenalty = 0

    const updatedContracts = activeContracts.map(contract => {
      const blueprint = CONTRACT_CATALOG[contract.blueprintId] || contract.blueprintId // support dynamic contracts later
      
      // We will handle dynamic contracts in the activeContracts themselves if not in catalog
      const mrr = blueprint?.monthlyMRR || (contract as Record<string, unknown>).monthlyMRR || 0 as number

      if (isMonthEnd) {
        monthlyRevenue += mrr
        monthlyPenalty += contract.accumulatedPenalty
        
        return {
          ...contract,
          accumulatedPenalty: 0
        }
      }
      return contract
    })

    // OPEX calculations (Normalized where 3600 seconds = 1 Month)
    
    // Power: Assume ~$90 per KW per month ($0.12/kWh * 24 * 30)
    const totalPowerKW = nodes.reduce((sum, n) => sum + (n.wattage || 0), 0) / 1000
    const powerCostPerMonth = totalPowerKW * 90 
    
    // Rack rent: $500 per rack per month
    const rackRentPerMonth = nodes.filter(n => n.type === 'rack').length * 500

    // Maintenance: $100 base per node per month
    const maintenanceCostPerMonth = nodes.reduce((sum, n) => {
      if (n.type === 'rack' || n.type === 'cooling') return sum
      const base = 100 
      const stressMultiplier = n.isThrottled ? 2.5 : 1.0
      const ageMultiplier = 1 + ((n.degradation || 0) / 100)
      return sum + (base * stressMultiplier * ageMultiplier)
    }, 0)

    // Cloud: $300 per instance per month
    const cloudCostPerMonth = get().cloudBurstingActive ? (get().activeCloudInstances * 300) : 0
    
    // Egress: $0.10 per GB (charged directly over the month)
    const egressCostPerMonth = get().cloudEgressGB * 0.1 * 3600 // roughly extrapolating per second usage

    const totalExpensesPerMonth = powerCostPerMonth + rackRentPerMonth + cloudCostPerMonth + egressCostPerMonth + maintenanceCostPerMonth
    
    let newBalance = balance

    if (isMonthEnd) {
      const netPayout = monthlyRevenue - monthlyPenalty - totalExpensesPerMonth
      newBalance += netPayout
      
      const avgUptime = updatedContracts.length > 0 
        ? updatedContracts.reduce((sum, c) => sum + (c.totalTicks > 0 ? c.uptimeTicks / c.totalTicks : 1), 0) / updatedContracts.length 
        : 1.0
      
      const repChange = avgUptime > 0.99 ? 2 : avgUptime < 0.95 ? -5 : 0
      const newReputation = Math.max(0, Math.min(100, reputation + repChange))
      
      set({ reputation: newReputation })
      pushAlert('info', `MONTHLY PAYOUT: $${netPayout.toLocaleString()} (Rev: $${monthlyRevenue}, OPEX: -$${totalExpensesPerMonth}, Penalties: -$${monthlyPenalty})`)

      if (updatedContracts.length > 0) {
        if (avgUptime >= 0.99) {
          get().gainXp(updatedContracts.length * 150, 'SLA Excellence')
        } else if (avgUptime >= 0.95) {
          get().gainXp(updatedContracts.length * 50, 'SLA Fulfilled')
        }
      }

      // Bankruptcy mechanics
      if (newBalance < 0) {
        pushAlert('critical', `BANKRUPTCY WARNING: Enterprise balance is negative! Operational shutdown imminent if insolvency continues.`)
      }

      // Contract cancellation due to reputation
      if (newReputation < 20 && updatedContracts.length > 0) {
        pushAlert('critical', 'REPUTATION CRITICAL: Clients are terminating contracts due to poor reliability.')
        // In a real loop, we might remove contracts here. Handled later.
      }
    }

    set({ 
      activeContracts: updatedContracts,
      balance: newBalance,
      realTimePlayedSeconds: nextRealTimePlayedSeconds
    })
  }
})
