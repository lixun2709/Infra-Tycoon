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
  layout: 'single' | 'vertical' | 'horizontal'
}
