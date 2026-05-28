import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import { CONTRACT_CATALOG } from '../../physics/contractLibrary'

export interface EconomySlice {
  processEconomyTick: (dt: number) => void
  chargeMaintenanceCost: (amount: number, reason: string) => boolean
}

export function getReputationTier(rep: number): 'Blacklisted' | 'Unproven' | 'Reliable' | 'Enterprise Trusted' | 'Mission Critical' {
  if (rep < 20) return 'Blacklisted'
  if (rep < 40) return 'Unproven'
  if (rep < 60) return 'Reliable'
  if (rep < 80) return 'Enterprise Trusted'
  return 'Mission Critical'
}

export const createEconomySlice: StateCreator<InfraState, [], [], EconomySlice> = (set, get) => ({
  adjustReputation: (amount: number, reason: string) => {
    const { reputation, reputationHistory, pushAlert } = get()
    if (amount === 0) return
    
    const newReputation = Math.max(0, Math.min(100, reputation + amount))
    if (newReputation === reputation) return // No change
    
    const entry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      amount,
      reason
    }
    
    const newHistory = [entry, ...reputationHistory].slice(0, 50) // Keep last 50 entries
    
    set({ reputation: newReputation, reputationHistory: newHistory })
    
    if (amount < 0) {
      pushAlert(amount <= -5 ? 'critical' : 'warning', `REPUTATION LOST: ${amount} (${reason})`)
    } else if (amount >= 5) {
      pushAlert('info', `REPUTATION GAINED: +${amount} (${reason})`)
    }
  },

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
      loans,
      consecutiveNegativeMonths,
      isBankrupt,
      pushAlert
    } = get()

    if (isBankrupt) {
      // Pause economy if bankrupt.
      return
    }

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
      // Process loans (OpEx)
      let totalLoanPayment = 0
      const updatedLoans = loans.map(loan => {
        // Interest is calculated on remaining principal
        const interestAmount = loan.remainingAmount * loan.interestRate
        // The minimum payment pays the interest plus a bit of principal (or whatever the min payment is)
        let payment = Math.max(interestAmount, loan.minimumMonthlyPayment)
        
        // If remaining is less than the payment, just pay the remainder
        if (loan.remainingAmount + interestAmount < payment) {
          payment = loan.remainingAmount + interestAmount
        }

        totalLoanPayment += payment

        return {
          ...loan,
          remainingAmount: loan.remainingAmount + interestAmount - payment
        }
      }).filter(loan => loan.remainingAmount > 0)

      const netPayout = monthlyRevenue - monthlyPenalty - totalExpensesPerMonth - totalLoanPayment
      newBalance += netPayout
      
      if (totalLoanPayment > 0) {
        pushAlert('warning', `DEBT SERVICING: $${totalLoanPayment.toLocaleString()} automatically deducted for corporate loans.`)
      }
      
      const avgUptime = updatedContracts.length > 0 
        ? updatedContracts.reduce((sum, c) => sum + (c.totalTicks > 0 ? c.uptimeTicks / c.totalTicks : 1), 0) / updatedContracts.length 
        : 1.0
      
      const repChange = avgUptime > 0.99 ? 2 : avgUptime < 0.95 ? -5 : 0
      if (repChange !== 0 && updatedContracts.length > 0) {
        get().adjustReputation(repChange, 'Monthly SLA Performance')
      }
      pushAlert('info', `MONTHLY PAYOUT: $${netPayout.toLocaleString()} (Rev: $${monthlyRevenue}, OPEX: -$${totalExpensesPerMonth}, Loans: -$${totalLoanPayment}, Penalties: -$${monthlyPenalty})`)

      if (updatedContracts.length > 0) {
        if (avgUptime >= 0.99) {
          get().gainXp(updatedContracts.length * 150, 'SLA Excellence')
        } else if (avgUptime >= 0.95) {
          get().gainXp(updatedContracts.length * 50, 'SLA Fulfilled')
        }
      }

      // Bankruptcy mechanics
      let newConsecutiveNegativeMonths = consecutiveNegativeMonths
      let newIsBankrupt = isBankrupt

      if (newBalance < 0) {
        newConsecutiveNegativeMonths++
        if (newConsecutiveNegativeMonths >= 3) {
          newIsBankrupt = true
          pushAlert('critical', `BANKRUPTCY DECLARED: Account negative for 3 consecutive months. Operations halted!`)
        } else {
          pushAlert('critical', `BANKRUPTCY WARNING: Enterprise balance is negative! (Month ${newConsecutiveNegativeMonths}/3). Cancel contracts or secure a loan!`)
        }
      } else {
        newConsecutiveNegativeMonths = 0
      }

      // Contract cancellation due to reputation
      const latestRep = get().reputation
      if (latestRep < 20 && updatedContracts.length > 0) {
        pushAlert('critical', 'REPUTATION CRITICAL: Clients have terminated all contracts due to Blacklisted status.')
        updatedContracts.length = 0 // Clear all active contracts
      }
      
      set({ loans: updatedLoans, consecutiveNegativeMonths: newConsecutiveNegativeMonths, isBankrupt: newIsBankrupt })
    }

    set({ 
      activeContracts: updatedContracts,
      balance: newBalance,
      realTimePlayedSeconds: nextRealTimePlayedSeconds
    })
  },
  
  takeLoan: (name: string, principal: number, interestRate: number, minimumMonthlyPayment: number) => {
    const { loans, balance, pushAlert } = get()
    const newLoan = {
      id: crypto.randomUUID(),
      name,
      principal,
      remainingAmount: principal,
      interestRate,
      minimumMonthlyPayment
    }
    
    set({
      loans: [...loans, newLoan],
      balance: balance + principal
    })
    
    pushAlert('info', `LOAN SECURED: $${principal.toLocaleString()} capital injected into enterprise balance.`)
  },
  
  repayLoan: (id: string, amount: number) => {
    const { loans, balance, pushAlert } = get()
    
    if (balance < amount) {
      pushAlert('warning', 'Insufficient funds to repay loan principal.')
      return
    }
    
    const updatedLoans = loans.map(loan => {
      if (loan.id === id) {
        return {
          ...loan,
          remainingAmount: Math.max(0, loan.remainingAmount - amount)
        }
      }
      return loan
    }).filter(loan => loan.remainingAmount > 0)
    
    set({
      loans: updatedLoans,
      balance: balance - amount
    })
    
    pushAlert('info', `LOAN REPAYMENT: $${amount.toLocaleString()} paid towards corporate debt.`)
  }
})
