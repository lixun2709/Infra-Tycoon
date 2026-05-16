import { create } from 'zustand';
import type { TerminalSession } from './terminalTypes';

interface TerminalState {
  isTerminalOpen: boolean;
  terminalStates: Record<string, {
    sessions: TerminalSession[];
    activeSessionId: string;
    layout: {
      width: number;
      height: number;
      x: number;
      y: number;
      isMaximized: boolean;
    };
    aliases: Record<string, string>;
    envVars: Record<string, string>;
    storedFiles: Record<string, string>;
  }>;

  setIsTerminalOpen: (open: boolean) => void;
  updateTerminalLayout: (siteId: string, layout: Partial<TerminalState['terminalStates'][string]['layout']>) => void;
  setTerminalState: (siteId: string, state: TerminalState['terminalStates'][string]) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  isTerminalOpen: false,
  terminalStates: {},

  setIsTerminalOpen: (open) => set({ isTerminalOpen: open }),
  updateTerminalLayout: (siteId, layout) => set((state) => ({
    terminalStates: {
      ...state.terminalStates,
      [siteId]: {
        ...state.terminalStates[siteId],
        layout: { ...state.terminalStates[siteId].layout, ...layout }
      }
    }
  })),
  setTerminalState: (siteId, siteState) => set((state) => ({
    terminalStates: {
      ...state.terminalStates,
      [siteId]: siteState
    }
  })),
}));
