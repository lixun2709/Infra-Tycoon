import type { StateCreator } from 'zustand'
import type { InfraState } from '../infraStoreTypes'
import type { TerminalSession, TerminalPane, TerminalStateRecord } from '../terminalTypes'

export interface TerminalSlice {
  updateTerminalLayout: (layout: Partial<TerminalStateRecord['layout']>) => void
  addTerminalSession: (title?: string, initialContext?: TerminalPane['context']) => void
  closeTerminalSession: (sessionId: string) => void
  setActiveSession: (sessionId: string) => void
  splitTerminalPane: (direction: 'vertical' | 'horizontal') => void
  setActivePane: (paneId: string) => void
  closeTerminalPane: (paneId: string) => void
  setTerminalAlias: (name: string, command: string) => void
  setTerminalEnvVar: (name: string, value: string) => void
  writeTerminalFile: (path: string, content: string) => void
  updateTerminalLogs: (sessionId: string, paneId: string, logs: string[]) => void
}

export const createTerminalSlice: StateCreator<InfraState, [], [], TerminalSlice> = (set, get) => ({
  updateTerminalLayout: (layout) => {
    const { currentSiteId, terminalStates } = get()
    set({
      terminalStates: {
        ...terminalStates,
        [currentSiteId]: { ...terminalStates[currentSiteId], layout: { ...terminalStates[currentSiteId].layout, ...layout } }
      }
    })
  },

  addTerminalSession: (title = 'New Session', initialContext) => {
    const { currentSiteId, terminalStates } = get()
    const siteState = terminalStates[currentSiteId]
    const id = `s-${crypto.randomUUID()}`
    const paneId = `p-${crypto.randomUUID()}`
    
    const newSession: TerminalSession = {
      id,
      title,
      panes: [{ id: paneId, logs: [`Session ${title} initialized.`], history: [], cwd: '/', context: initialContext || { mode: 'global' as const, targetId: null } }],
      activePaneId: paneId,
      layout: 'single' as const
    }

    set({
      terminalStates: {
        ...terminalStates,
        [currentSiteId]: { ...siteState, sessions: [...siteState.sessions, newSession], activeSessionId: id }
      }
    })
  },

  closeTerminalSession: (sessionId) => {
    const { currentSiteId, terminalStates } = get()
    const siteState = terminalStates[currentSiteId]
    const filtered = siteState.sessions.filter(s => s.id !== sessionId)
    if (filtered.length === 0) return // Keep at least one

    set({
      terminalStates: {
        ...terminalStates,
        [currentSiteId]: { 
          ...siteState, 
          sessions: filtered, 
          activeSessionId: siteState.activeSessionId === sessionId ? filtered[0].id : siteState.activeSessionId 
        }
      }
    })
  },

  setActiveSession: (sessionId) => {
    const { currentSiteId, terminalStates } = get()
    set({
      terminalStates: {
        ...terminalStates,
        [currentSiteId]: { ...terminalStates[currentSiteId], activeSessionId: sessionId }
      }
    })
  },

  splitTerminalPane: (direction) => {
    const { currentSiteId, terminalStates } = get()
    const siteState = terminalStates[currentSiteId]
    const session = siteState.sessions.find(s => s.id === siteState.activeSessionId)
    if (!session) return

    const newPaneId = `p-${crypto.randomUUID()}`
    const activePane = session.panes.find(p => p.id === session.activePaneId) || session.panes[0]
    
    const newPane: TerminalPane = { ...activePane, id: newPaneId, logs: [`Pane split ${direction}.`] }
    
    set({
      terminalStates: {
        ...terminalStates,
        [currentSiteId]: {
          ...siteState,
          sessions: siteState.sessions.map(s => s.id === session.id ? {
            ...s,
            panes: [...s.panes, newPane],
            activePaneId: newPaneId,
            layout: direction === 'vertical' ? 'split-v' as const : 'split-h' as const
          } : s)
        }
      }
    })
  },

  setActivePane: (paneId) => {
    const { currentSiteId, terminalStates } = get()
    const siteState = terminalStates[currentSiteId]
    set({
      terminalStates: {
        ...terminalStates,
        [currentSiteId]: {
          ...siteState,
          sessions: siteState.sessions.map(s => s.id === siteState.activeSessionId ? { ...s, activePaneId: paneId } : s)
        }
      }
    })
  },

  closeTerminalPane: (paneId) => {
    const { currentSiteId, terminalStates } = get()
    const siteState = terminalStates[currentSiteId]
    const session = siteState.sessions.find(s => s.id === siteState.activeSessionId)
    if (!session || session.panes.length <= 1) return

    const filtered = session.panes.filter(p => p.id !== paneId)
    set({
      terminalStates: {
        ...terminalStates,
        [currentSiteId]: {
          ...siteState,
          sessions: siteState.sessions.map(s => s.id === session.id ? {
            ...s,
            panes: filtered,
            activePaneId: session.activePaneId === paneId ? filtered[0].id : session.activePaneId,
            layout: 'single' as const
          } : s)
        }
      }
    })
  },

  setTerminalAlias: (name, command) => {
    const { currentSiteId, terminalStates } = get()
    const siteState = terminalStates[currentSiteId]
    set({
      terminalStates: {
        ...terminalStates,
        [currentSiteId]: { ...siteState, aliases: { ...siteState.aliases, [name]: command } }
      }
    })
  },

  setTerminalEnvVar: (name, value) => {
    const { currentSiteId, terminalStates } = get()
    const siteState = terminalStates[currentSiteId]
    set({
      terminalStates: {
        ...terminalStates,
        [currentSiteId]: { ...siteState, envVars: { ...siteState.envVars, [name]: value } }
      }
    })
  },

  writeTerminalFile: (path, content) => {
    const { currentSiteId, terminalStates } = get()
    const siteState = terminalStates[currentSiteId]
    set({
      terminalStates: {
        ...terminalStates,
        [currentSiteId]: { ...siteState, storedFiles: { ...siteState.storedFiles, [path]: content } }
      }
    })
  },

  updateTerminalLogs: (sessionId, paneId, logs) => {
    const { currentSiteId, terminalStates } = get()
    const siteState = terminalStates[currentSiteId]
    if (!siteState) return

    set({
      terminalStates: {
        ...terminalStates,
        [currentSiteId]: {
          ...siteState,
          sessions: siteState.sessions.map(s => s.id === sessionId ? {
            ...s,
            panes: s.panes.map(p => p.id === paneId ? { ...p, logs } : p)
          } : s)
        }
      }
    })
  }
})
