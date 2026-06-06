/* eslint-disable @typescript-eslint/no-explicit-any */
import type { InfraState } from './infraStoreTypes'
import type { TerminalSession, TerminalPane } from './terminalTypes'
import { COMMAND_REGISTRY } from './terminal/CommandRegistry'
import { initializeTerminalCommands } from './terminal/TerminalCommands'

// Initialize commands once
initializeTerminalCommands()

import { logger } from '../core/telemetry'

export function handleCommand(
  get: () => InfraState, 
  set: (fn: (s: InfraState) => Partial<InfraState>) => void, 
  text: string
): void {
  const siteId = get().currentSiteId
  const siteState = get().terminalStates[siteId]
  if (!siteState) return
  
  const activeSession = siteState.sessions.find((s: any) => s.id === siteState.activeSessionId)
  if (!activeSession) return
  const activePane = activeSession.panes.find((p: any) => p.id === activeSession.activePaneId) || activeSession.panes[0]
  if (!activePane) return
  const { nodes } = get()
  
  // --- 1. ALIAS SUBSTITUTION ---
  let processedCmd = text.trim()
  const firstWord = processedCmd.split(/\s+/)[0] || ""
  if (firstWord && siteState.aliases[firstWord]) {
     processedCmd = (siteState.aliases[firstWord] || "") + processedCmd.slice(firstWord.length)
  }

  // --- 2. ENV VAR SUBSTITUTION ---
  processedCmd = processedCmd.replace(/\$(\w+)/g, (_, name) => siteState.envVars[name] || '')

  // --- 3. REDIRECTION ---
  if (processedCmd.includes('>')) {
    const parts = processedCmd.split('>')
    processedCmd = (parts[0] || "").trim()
  }

  // --- 4. PIPING SETUP ---
  const pipeParts = processedCmd.split('|').map(s => s.trim())
  const baseCmd = pipeParts[0] || ""
  const args = baseCmd.split(/\s+/)
  const cmdLower = (args[0] || "").toLowerCase()

  const output: string[] = [] 
  const newContext = { ...activePane.context }
  const newCwd = activePane.cwd
  const forceClear = { value: false }

  // --- 5. CORE COMMAND LOGIC ---
  const targetNode = nodes.find((n: any) => n.id === newContext.targetId)

  if (newContext.mode === 'ssh' && targetNode) {
    const { connections } = get()
    const hasOobLink = connections.some((c: any) => {
      const isTarget = c.startNodeId === targetNode.id || c.endNodeId === targetNode.id
      const sourcePort = nodes.find((n: any) => n.id === c.startNodeId)?.ports.find((p: any) => p.id === c.startPortId)
      const destPort = nodes.find((n: any) => n.id === c.endNodeId)?.ports.find((p: any) => p.id === c.endPortId)
      return isTarget && (sourcePort?.type === 'network' || destPort?.type === 'network')
    })
    
    if (!hasOobLink && !['exit', 'help'].includes(cmdLower)) {
      output.push(`[[RED]]ERROR: No Serial/OOB connection to [${targetNode.hostname || targetNode.id.slice(0,8)}].[[RESET]]`)
      output.push("Verify physical Top-of-Rack patching to Management Switch.")
      
      set((s: InfraState) => {
        const cs = s.terminalStates[siteId]
        if (!cs) return {}
        const ns = cs.sessions.map((sess: TerminalSession) => sess.id === activeSession.id ? {
          ...sess,
          panes: sess.panes.map((p: TerminalPane) => p.id === activePane.id ? { ...p, logs: [...p.logs, `> ${text}`, ...output].slice(-200) } : p)
        } : sess)
        return { terminalStates: { ...s.terminalStates, [siteId]: { ...cs, sessions: ns } } }
      })
      return
    }
  }

  // Pre-command boot checks
  if (targetNode && targetNode.systemState === 'off' && !['poweron', 'exit', 'help'].includes(cmdLower)) {
    output.push("[[RED]]SYSTEM ERROR: Node is logically powered down.[[RESET]]")
    output.push("Required: '[[YELLOW]]poweron[[RESET]]' to initialize CPU/RAM.")
  } else if (targetNode && targetNode.systemState === 'booting' && !['exit', 'help'].includes(cmdLower)) {
    output.push("[[YELLOW]]BOOT INTERRUPT: System is currently in POST/Kernel initialization.[[RESET]]")
    output.push(`Progress: ${targetNode.bootProgress}% | Please wait for success telemetry.`)
  } else if (targetNode && targetNode.systemState === 'running' && !targetNode.hostname && !['hostname', 'exit', 'help', 'ipmi'].includes(cmdLower)) {
    output.push("[[RED]]BOOT ERROR: Unique Hostname not set.[[RESET]]")
    output.push("Required: '[[YELLOW]]hostname [name][[RESET]]' to set node identity.")
  } else {
    // Execute from registry
    const commandDef = COMMAND_REGISTRY[cmdLower]
    if (commandDef) {
      const playerAuthority = get().playerAuthority || 'SIMULATION_CRITICAL'
      const authLevels = {
        'READ_ONLY': 1,
        'OPERATIONAL': 2,
        'SIMULATION_CRITICAL': 3
      }
      
      const requiredLevel = authLevels[commandDef.authority] || 3
      const currentLevel = authLevels[playerAuthority] || 1

      if (requiredLevel > currentLevel) {
        output.push(`[[RED]]PERMISSION DENIED: Command '${cmdLower}' requires ${commandDef.authority} authority.[[RESET]]`)
        output.push(`Current session authority: ${playerAuthority}`)
        logger.warn(`Unauthorized terminal command attempt`, {
          command: cmdLower,
          requiredAuth: commandDef.authority,
          currentAuth: playerAuthority,
          targetNode: targetNode?.id
        })
      } else {
        try {
          commandDef.execute({
            get,
            set,
            args,
            siteId,
            siteState,
            activeSession,
            activePane,
            newContext,
            newCwd,
            targetNode,
            output,
            forceClear
          })
        } catch (err) {
          output.push(`[[RED]]Command execution failed: ${err}[[RESET]]`)
        }
      }
    } else {
      output.push(`-bash: [[YELLOW]]${cmdLower}[[RESET]]: command not found`)
    }
  }

  // --- 7. FINAL UPDATE ---
  logger.info(`Terminal Command Executed`, {
    siteId,
    targetNode: targetNode?.id || 'none',
    command: cmdLower,
    args,
    success: output.length > 0 && !output[output.length - 1]?.includes('[[RED]]Command execution failed')
  });

  set((s: InfraState) => {
    const cs = s.terminalStates[siteId]
    if (!cs) return {}
    const finalSessions = cs.sessions.map((sess: TerminalSession) => {
      if (sess.id !== activeSession.id) return sess
      return {
        ...sess,
        panes: sess.panes.map((p: TerminalPane) => {
          if (!activePane || p.id !== activePane.id) return p
          return {
            ...p,
            logs: forceClear.value ? [] : [...p.logs, `> ${text}`, ...output].slice(-200),
            history: [...p.history, text].slice(-100),
            context: newContext,
            cwd: newCwd
          }
        })
      }
    })
    return { terminalStates: { ...s.terminalStates, [siteId]: { ...cs, sessions: finalSessions } } }
  })
}

