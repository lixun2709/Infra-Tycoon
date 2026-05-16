import { create } from 'zustand';
import type { Connection } from './infraTypes';

interface NetworkState {
  connections: Connection[];
  patchingActive: boolean;
  activePatchSource: { nodeId: string; portId: string } | null;
  networkLoad: number;
  networkUptime: number;
  
  setNetworkLoad: (load: number) => void;
  setPatchingActive: (active: boolean) => void;
  setActivePatchSource: (source: { nodeId: string; portId: string } | null) => void;
  addConnection: (connection: Connection) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  connections: [],
  patchingActive: false,
  activePatchSource: null,
  networkLoad: 0.1,
  networkUptime: 100,

  setNetworkLoad: (load) => set({ networkLoad: load }),
  setPatchingActive: (active) => set({ patchingActive: active }),
  setActivePatchSource: (source) => set({ activePatchSource: source }),
  addConnection: (connection) => set((state) => ({ connections: [...state.connections, connection] })),
  removeConnection: (id) => set((state) => ({ connections: state.connections.filter(c => c.id !== id) })),
  updateConnection: (id, updates) => set((state) => ({
    connections: state.connections.map(c => c.id === id ? { ...c, ...updates } : c)
  })),
}));
