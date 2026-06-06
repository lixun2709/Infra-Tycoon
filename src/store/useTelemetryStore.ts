import { create } from 'zustand'

export interface TelemetryState {
  realTimePlayedSeconds: number
  networkLoad: number
  resilienceIndex: number
  totalPowerKW: number
  totalRoomBTU: number
  overloadedRackCount: number
  networkUptime: number
  cloudEgressGB: number
  activeCloudInstances: number
  
  setTelemetryValue: <K extends keyof Omit<TelemetryState, 'setTelemetryValue'>>(key: K, value: TelemetryState[K]) => void
  incrementTime: (seconds: number) => void
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  realTimePlayedSeconds: 0,
  networkLoad: 0.1,
  resilienceIndex: 100,
  totalPowerKW: 0,
  totalRoomBTU: 0,
  overloadedRackCount: 0,
  networkUptime: 100,
  cloudEgressGB: 0,
  activeCloudInstances: 0,

  setTelemetryValue: (key, value) => set({ [key]: value }),
  incrementTime: (seconds) => set((state) => ({ realTimePlayedSeconds: state.realTimePlayedSeconds + seconds }))
}))
