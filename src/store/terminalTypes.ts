export type TerminalPane = {
  id: string
  logs: string[]
  history: string[]
  cwd: string
  context: {
    mode: 'global' | 'console' | 'ssh' | 'config' | 'interface' | 'nano' | 'top'
    targetId: string | null
  }
}

export type TerminalSession = {
  id: string
  title: string
  panes: TerminalPane[]
  activePaneId: string
  layout: 'single' | 'vertical' | 'horizontal' | 'split-v' | 'split-h'
}

export type TerminalStateRecord = {
  sessions: TerminalSession[]
  activeSessionId: string
  layout: {
    width: number
    height: number
    x: number
    y: number
    isMaximized: boolean
  }
  aliases: Record<string, string>
  envVars: Record<string, string>
  storedFiles: Record<string, string>
}
