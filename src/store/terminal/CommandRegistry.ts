import type { InfraState } from '../infraStoreTypes'
import type { TerminalSession, TerminalPane, TerminalStateRecord } from '../terminalTypes'
import type { InfraNode } from '../infraTypes'

export type CommandAuthority = 'READ_ONLY' | 'OPERATIONAL' | 'SIMULATION_CRITICAL'

export interface CommandContext {
  get: () => InfraState
  set: (fn: (s: InfraState) => Partial<InfraState>) => void
  args: string[]
  siteId: string
  siteState: TerminalStateRecord
  activeSession: TerminalSession
  activePane: TerminalPane
  newContext: any
  newCwd: string
  targetNode: InfraNode | undefined
  output: string[]
  forceClear: { value: boolean }
}

export interface TerminalCommandDef {
  name: string
  authority: CommandAuthority
  description: string
  execute: (ctx: CommandContext) => void
}

export const COMMAND_REGISTRY: Record<string, TerminalCommandDef> = {}

export function registerCommand(cmd: TerminalCommandDef) {
  COMMAND_REGISTRY[cmd.name.toLowerCase()] = cmd
}
