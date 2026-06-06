import type { StateCreator } from 'zustand'
import type { InfraState, ItsmSlice } from '../infraStoreTypes'

export const createItsmSlice: StateCreator<InfraState, [], [], ItsmSlice> = (set) => ({
  expediteTicket: (ticketId: string) => set((state: any) => {
    const ticket = state.technicianTickets.find((t: any) => t.id === ticketId)
    if (!ticket) return state
    
    // Expedite cost ($2000 per priority bump)
    const cost = 2000
    if (state.balance < cost) return state

    // Speed up remaining time by 50%
    const remaining = ticket.totalSeconds - ticket.elapsedSeconds
    const newTotal = ticket.elapsedSeconds + Math.floor(remaining * 0.5)

    return {
      balance: state.balance - cost,
      technicianTickets: state.technicianTickets.map((t: any) => 
        t.id === ticketId 
          ? { ...t, priorityFee: (t.priorityFee || 0) + cost, totalSeconds: newTotal }
          : t
      )
    }
  }),
  
  resolveTicket: (ticketId: string) => set((state: any) => {
    return {
      technicianTickets: state.technicianTickets.filter((t: any) => t.id !== ticketId)
    }
  })
})
