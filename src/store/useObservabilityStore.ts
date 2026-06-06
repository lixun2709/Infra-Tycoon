import { create } from 'zustand'

export interface AuditLog {
  timestamp: number
  message: string
  type: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS' | 'TERMINAL'
  metadata?: any
}

export interface PostMortem {
  id: string
  incidentType: string
  rootCause: string
  financialImpact: number
  reputationImpact: number
  timestamp: number
}

export interface Incident {
  id: string
  type: string
  status: 'ACTIVE' | 'RESOLVED'
  startTime: number
  endTime?: number
  affectedNodeIds: string[]
  severity: 'WARNING' | 'CRITICAL'
}

export interface TechnicianTicket {
  id: string
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED'
  type: 'HARDWARE_REPAIR' | 'CABLE_RUN' | 'MAINTENANCE'
  targetNodeId: string
  assignedTechnicianId?: string
  createdAt: number
}

export interface ObservabilityState {
  auditLogs: AuditLog[]
  postMortems: PostMortem[]
  incidents: Incident[]
  technicianTickets: TechnicianTicket[]
  
  addAuditLog: (log: Omit<AuditLog, 'timestamp'>) => void
  addIncident: (incident: Omit<Incident, 'id' | 'startTime'>) => void
  resolveIncident: (id: string) => void
  addPostMortem: (pm: Omit<PostMortem, 'id' | 'timestamp'>) => void
  addTechnicianTicket: (ticket: Omit<TechnicianTicket, 'id' | 'createdAt' | 'status'>) => void
  updateTechnicianTicket: (id: string, updates: Partial<TechnicianTicket>) => void
}

export const useObservabilityStore = create<ObservabilityState>((set) => ({
  auditLogs: [],
  postMortems: [],
  incidents: [],
  technicianTickets: [],

  addAuditLog: (log) => set((state) => ({
    auditLogs: [{ ...log, timestamp: Date.now() }, ...state.auditLogs].slice(0, 1000)
  })),

  addIncident: (incident) => set((state) => ({
    incidents: [
      ...state.incidents,
      {
        ...incident,
        id: `inc-${Math.random().toString(36).substr(2, 9)}`,
        startTime: Date.now()
      }
    ]
  })),

  resolveIncident: (id) => set((state) => ({
    incidents: state.incidents.map(inc => 
      inc.id === id ? { ...inc, status: 'RESOLVED', endTime: Date.now() } : inc
    )
  })),

  addPostMortem: (pm) => set((state) => ({
    postMortems: [
      {
        ...pm,
        id: `pm-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      },
      ...state.postMortems
    ]
  })),

  addTechnicianTicket: (ticket) => set((state) => ({
    technicianTickets: [
      ...state.technicianTickets,
      {
        ...ticket,
        id: `tkt-${Math.random().toString(36).substr(2, 9)}`,
        status: 'PENDING',
        createdAt: Date.now()
      }
    ]
  })),

  updateTechnicianTicket: (id, updates) => set((state) => ({
    technicianTickets: state.technicianTickets.map(t =>
      t.id === id ? { ...t, ...updates } : t
    )
  }))
}))
