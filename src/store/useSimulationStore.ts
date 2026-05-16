import { create } from 'zustand';
import type { InfraNode, InfraAlert, AuditLog, Site } from './infraTypes';

interface SimulationState {
  nodes: InfraNode[];
  sites: Site[];
  currentSiteId: string;
  simulationCycle: number;
  alerts: InfraAlert[];
  auditLogs: AuditLog[];
  isHeatMapVisible: boolean;
  
  setNodes: (nodes: InfraNode[]) => void;
  updateNode: (id: string, updates: Partial<InfraNode>) => void;
  addNode: (node: InfraNode) => void;
  removeNode: (id: string) => void;
  setCurrentSiteId: (siteId: string) => void;
  incrementCycle: () => void;
  pushAlert: (alert: InfraAlert) => void;
  toggleHeatMap: () => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  nodes: [],
  sites: [],
  currentSiteId: 'site-1',
  simulationCycle: 0,
  alerts: [],
  auditLogs: [],
  isHeatMapVisible: false,

  setNodes: (nodes) => set({ nodes }),
  updateNode: (id, updates) => set((state) => ({
    nodes: state.nodes.map(n => n.id === id ? { ...n, ...updates } : n)
  })),
  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  removeNode: (id) => set((state) => ({ nodes: state.nodes.filter(n => n.id !== id) })),
  setCurrentSiteId: (siteId) => set({ currentSiteId: siteId }),
  incrementCycle: () => set((state) => ({ simulationCycle: state.simulationCycle + 1 })),
  pushAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 100) })),
  toggleHeatMap: () => set((state) => ({ isHeatMapVisible: !state.isHeatMapVisible })),
}));
