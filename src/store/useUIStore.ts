import { create } from 'zustand';
import { Vector3 } from 'three';
import { audioManager } from '../utils/AudioManager'
import { logger } from '../core/telemetry/Logger';
import type { ThemeKey } from './themeTypes';
import type { InfraAlert } from './infraTypes';

// Keep track of when alert types (by template and node) were acknowledged
const acknowledgedAt = new Map<string, number>();

export function normalizeAlertMessage(msg: string): string {
  return msg.replace(/\d+(\.\d+)?/g, '#');
}

export function clearAlertSuppressions(): void {
  acknowledgedAt.clear();
}

export interface UIState {
  networkLoad: number;
  isNetworkManagerOpen: boolean;
  currentSiteId: string;
  mousePosition: Vector3 | null;
  isHeatMapVisible: boolean;
  isGlobalMapOpen: boolean;
  isTerminalOpen: boolean;
  renderQuality: 'ultra' | 'auto' | 'low';
  activeTheme: ThemeKey;
  timeFormat: '24h' | '12h';
  alerts: InfraAlert[];

  setNetworkLoad: (load: number) => void;
  setNetworkManagerOpen: (open: boolean) => void;
  setCurrentSiteId: (siteId: string) => void;
  setMousePosition: (pos: Vector3 | null) => void;
  toggleHeatMap: () => void;
  toggleGlobalMap: () => void;
  setIsTerminalOpen: (val: boolean) => void;
  setRenderQuality: (quality: 'ultra' | 'auto' | 'low') => void;
  setTheme: (theme: ThemeKey) => void;
  setTimeFormat: (format: '24h' | '12h') => void;
  pushAlert: (severity: 'info' | 'warning' | 'critical', message: string, nodeId?: string) => void;
  acknowledgeAlert: (id: string) => void;
  acknowledgeAllAlerts: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  networkLoad: 0.1,
  isNetworkManagerOpen: false,
  currentSiteId: 'site-1',
  mousePosition: null,
  isHeatMapVisible: false,
  isGlobalMapOpen: false,
  isTerminalOpen: false,
  renderQuality: 'auto',
  activeTheme: 'cyberpunk',
  timeFormat: '24h',
  alerts: [],

  setNetworkLoad: (load) => set({ networkLoad: load }),
  setNetworkManagerOpen: (open) => set({ isNetworkManagerOpen: open }),
  setCurrentSiteId: (siteId) => set({ currentSiteId: siteId }),
  setMousePosition: (pos) => set({ mousePosition: pos }),
  toggleHeatMap: () => set((state) => ({ isHeatMapVisible: !state.isHeatMapVisible })),
  toggleGlobalMap: () => set((state) => ({ isGlobalMapOpen: !state.isGlobalMapOpen })),
  setIsTerminalOpen: (val) => set({ isTerminalOpen: val }),
  setRenderQuality: (quality) => set({ renderQuality: quality }),
  setTheme: (theme) => set({ activeTheme: theme }),
  setTimeFormat: (format) => set({ timeFormat: format }),

  pushAlert: (severity, message, nodeId) => {
    // 10-minute suppression filter for acknowledged alerts
    const normalized = normalizeAlertMessage(message);
    const key = `${severity}:${normalized}:${nodeId || ''}`;
    const lastAck = acknowledgedAt.get(key);
    if (lastAck !== undefined) {
      const elapsed = Date.now() - lastAck;
      if (elapsed < 10 * 60 * 1000) {
        return; // Suppress acknowledged recurring alert
      }
    }

    if (severity === 'critical') {
      audioManager.playEffect('error');
    } else if (severity === 'warning') {
      audioManager.playEffect('alert');
    }
    
    set((state) => ({
      alerts: [{ 
        id: crypto.randomUUID(), 
        timestamp: Date.now(), 
        cycle: 0, // In actual game, this might need real cycle time from simulation store if needed
        severity, 
        message, 
        isAcknowledged: false, 
        nodeId 
      }, ...state.alerts].slice(0, 100)
    }));
  },

  acknowledgeAlert: (id) => {
    set((state) => {
      const alert = state.alerts.find((a) => a.id === id);
      if (alert) {
        const normalized = normalizeAlertMessage(alert.message);
        const key = `${alert.severity}:${normalized}:${alert.nodeId || ''}`;
        acknowledgedAt.set(key, Date.now());
      }
      return {
        alerts: state.alerts.map((a) => a.id === id ? { ...a, isAcknowledged: true } : a)
      };
    });
  },

  acknowledgeAllAlerts: () => {
    set((state) => {
      state.alerts.forEach((alert) => {
        if (!alert.isAcknowledged) {
          const normalized = normalizeAlertMessage(alert.message);
          const key = `${alert.severity}:${normalized}:${alert.nodeId || ''}`;
          acknowledgedAt.set(key, Date.now());
        }
      });
      return {
        alerts: state.alerts.map((a) => ({ ...a, isAcknowledged: true }))
      };
    });
  }
}));
