import type { InfraState } from './infraStoreTypes'
import { performanceMonitor } from '../simulation/PerformanceMonitor'
import { TECHNICAL_MANUALS } from '../physics/Manuals'
import type { TerminalSession, TerminalPane } from './terminalTypes'
import { PrometheusExporter } from '../simulation/observability/PrometheusExporter'
import { ObservabilityTracer } from '../simulation/observability/ObservabilityTracer'
import { ObservabilityAlerting } from '../simulation/observability/ObservabilityAlerting'

export function handleCommand(
  get: () => InfraState, 
  set: (fn: (s: InfraState) => Partial<InfraState>) => void, 
  text: string
): void {
  const siteId = get().currentSiteId
  const siteState = get().terminalStates[siteId]
  if (!siteState) return
  
  const activeSession = siteState.sessions.find(s => s.id === siteState.activeSessionId)
  if (!activeSession) return
  const activePane = activeSession.panes.find(p => p.id === activeSession.activePaneId) || activeSession.panes[0]
  if (!activePane) return

  const { nodes, updateNode, dnsRecords } = get()
  
  const resolveHostname = (host: string) => {
    const record = dnsRecords.find(r => r.hostname === host)
    return record ? record.ip : host
  }
  
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
  let newContext = { ...activePane.context }
  const newCwd = activePane.cwd
  let forceClear = false

  // --- 5. CORE COMMAND LOGIC ---
  const targetNode = nodes.find(n => n.id === newContext.targetId)

  if (newContext.mode === 'ssh' && targetNode) {
    const { connections } = get()
    const hasOobLink = connections.some(c => {
      const isTarget = c.startNodeId === targetNode.id || c.endNodeId === targetNode.id
      const sourcePort = nodes.find(n => n.id === c.startNodeId)?.ports.find(p => p.id === c.startPortId)
      const destPort = nodes.find(n => n.id === c.endNodeId)?.ports.find(p => p.id === c.endPortId)
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

  if (cmdLower === 'help') {
    output.push("--- [[GREEN]]v1.6 BOOTSTRAP KERNEL[[RESET]] ---")
    output.push("BOOTSTRAP: [[YELLOW]]poweron[[RESET]], [[YELLOW]]hostname [n][[RESET]], [[YELLOW]]ip setup [ip] [gw] [dns][[RESET]]")
    output.push("OPS: [[BLUE]]lifecycle advance[[RESET]], [[BLUE]]ipmi status[[RESET]], [[BLUE]]ipmi power [on|off|cycle][[RESET]]")
    output.push("CORE: [[BLUE]]ls -la[[RESET]], [[BLUE]]cd[[RESET]], [[BLUE]]pwd[[RESET]], [[RED]]clear[[RESET]], [[BLUE]]man [topic][[RESET]]")
    output.push("NET: [[GREEN]]ping [target][[RESET]], [[GREEN]]show ip brief[[RESET]], [[GREEN]]traceroute[[RESET]]")
    output.push("ORCH: [[BLUE]]apt install[[RESET]], [[BLUE]]systemctl start[[RESET]], [[BLUE]]sync-ntp[[RESET]]")
    output.push("NAV: [[YELLOW]]scan console[[RESET]], [[YELLOW]]connect console [id][[RESET]], [[YELLOW]]exit[[RESET]]")
    output.push("SIM: [[BLUE]]ecs-stats[[RESET]], [[BLUE]]sim-diagnostics[[RESET]], [[BLUE]]prom[[RESET]], [[BLUE]]traces[[RESET]], [[BLUE]]alerts[[RESET]]")
  } else if (targetNode && targetNode.systemState === 'off' && !['poweron', 'exit', 'help'].includes(cmdLower)) {
    output.push("[[RED]]SYSTEM ERROR: Node is logically powered down.[[RESET]]")
    output.push("Required: '[[YELLOW]]poweron[[RESET]]' to initialize CPU/RAM.")
  } else if (targetNode && targetNode.systemState === 'booting' && !['exit', 'help'].includes(cmdLower)) {
    output.push("[[YELLOW]]BOOT INTERRUPT: System is currently in POST/Kernel initialization.[[RESET]]")
    output.push(`Progress: ${targetNode.bootProgress}% | Please wait for success telemetry.`)
  } else if (targetNode && targetNode.systemState === 'running' && !targetNode.hostname && !['hostname', 'exit', 'help', 'ipmi'].includes(cmdLower)) {
    output.push("[[RED]]BOOT ERROR: Unique Hostname not set.[[RESET]]")
    output.push("Required: '[[YELLOW]]hostname [name][[RESET]]' to set node identity.")
  } else if (cmdLower === 'poweron') {
    if (newContext.mode === 'ssh' && targetNode) {
      get().powerOnNode(targetNode.id)
      output.push("[[GREEN]]Initializing Hardware Stack...[[RESET]]")
      output.push("POST: CPU Check [OK] | RAM Sync [OK] | Bus Scan [OK]")
      output.push("Kernel handover initiated. Boot sequence active.")
    } else output.push("[[RED]]poweron: must be connected to a node serial console.[[RESET]]")
  } else if (cmdLower === 'hostname') {
    const name = args[1]
    if (newContext.mode === 'ssh' && targetNode) {
      if (!name) output.push("usage: hostname [name]")
      else if (nodes.some(n => n.hostname === name && n.id !== targetNode.id)) {
        output.push(`[[RED]]NAME COLLISION: Hostname '${name}' is already registered on this subnet.[[RESET]]`)
      } else {
        get().setNodeHostname(targetNode.id, name)
        output.push(`[[GREEN]]Identity established: ${name}.infra.local[[RESET]]`)
      }
    } else output.push("[[RED]]hostname: must be connected to a node serial console.[[RESET]]")
  } else if (cmdLower === 'ip' && args[1] === 'setup') {
    const [,,ip, gw, dns] = args
    if (newContext.mode === 'ssh' && targetNode) {
      if (!ip || !gw || !dns) {
        output.push("usage: [[YELLOW]]ip setup [IP] [Gateway] [DNS][[RESET]]")
      } else if (nodes.some(n => n.managementIP === ip && n.id !== targetNode.id)) {
        output.push(`[[RED]]IP CONFLICT: ${ip} is already assigned to another interface.[[RESET]]`)
      } else {
        updateNode(targetNode.id, { managementIP: ip, isConfigured: true })
        output.push(`[[GREEN]]Logical Interface Configured:[[RESET]]`)
        output.push(`IP: ${ip} | GW: ${gw} | DNS: ${dns}`)
      }
    } else output.push("[[RED]]ip setup: must be connected to a node serial console.[[RESET]]")
  } else if (cmdLower === 'ls') {
    output.push("[[BLUE]]bin[[RESET]]  [[BLUE]]etc[[RESET]]  [[BLUE]]root[[RESET]]  [[BLUE]]var[[RESET]]")
    Object.keys(siteState.storedFiles).forEach(f => output.push(`[[GREEN]]${f.split('/').pop()}[[RESET]]`))
  } else if (cmdLower === 'show' && args[1] === 'ip' && args[2] === 'brief') {
    output.push("Interface       IP-Address      Status                Protocol")
    output.push("---------       ----------      ------                --------")
    nodes.filter(n => n.siteId === siteId && n.type !== 'rack').forEach(n => {
      const ip = n.managementIP || 'unassigned'
      const state = n.systemState as string
      const statusColor = state === 'running' ? '[[GREEN]]' : state === 'booting' ? '[[YELLOW]]' : '[[RED]]'
      const status = `${statusColor}${state.toUpperCase()}[[RESET]]`
      output.push(`${n.hostname || n.id.slice(0,8)}`.padEnd(15) + `${ip.padEnd(15)} ${status.padEnd(30)}`)
    })
  } else if (cmdLower === 'ping') {
    const target = args[1]
    if (!target) output.push("usage: ping [IP_or_Hostname]")
    else {
      const ip = resolveHostname(target)
      const tNode = nodes.find(n => n.managementIP === ip || n.hostname === target)
      if (tNode && get().checkNetworkPath(newContext.targetId || 'bastion', tNode.id)) {
        const result = get().ping(newContext.targetId || 'bastion', ip)
        if (result.success) output.push(`[[BLUE]]PING ${target} (${ip})[[RESET]]`, result.message)
        else output.push(`[[RED]]${result.message}[[RESET]]`)
      } else output.push(`[[RED]]PING ${target}: No route to host.[[RESET]]`)
    }
  } else if (cmdLower === 'exit') {
    if (newContext.mode !== 'global') {
      newContext = { mode: 'global', targetId: null }
      output.push("[[YELLOW]]Console detached.[[RESET]]")
    } else setTimeout(() => get().closeTerminalPane(activePane.id), 50)
  } else if (cmdLower === 'clear') {
    forceClear = true
  } else if (cmdLower === 'ecs-stats') {
    const telemetry = get().getSimulationTelemetry()
    if (telemetry) {
      output.push("--- [[BLUE]]ECS TELEMETRY[[RESET]] ---")
      output.push(`Tick: ${telemetry.tickDurationMs.toFixed(4)}ms | Entities: ${telemetry.entityCount}`)
      if (telemetry.queryTelemetry) {
        const q = telemetry.queryTelemetry
        output.push(`Queries: ${q.activeQueries} | Hits: ${q.queryHits} | Misses: ${q.queryMisses} | Hit Ratio: ${(q.cacheHitRatio * 100).toFixed(1)}%`)
      }
    } else {
      output.push("[[RED]]Telemetry unavailable.[[RESET]]")
    }
  } else if (cmdLower === 'sim-diagnostics') {
    output.push("--- [[YELLOW]]DIAGNOSTICS[[RESET]] ---")
    output.push(`FPS: ${performanceMonitor.getMetrics().fps} | Latency: ${performanceMonitor.getMetrics().workerLatency.toFixed(2)}ms`)
  } else if (cmdLower === 'man') {
    const topic = args[1]
    if (topic && TECHNICAL_MANUALS[topic]) output.push(...TECHNICAL_MANUALS[topic])
    else output.push(`[[RED]]No manual entry for ${topic || ''}[[RESET]]`)
  } else if (cmdLower === 'export') {
    const expr = args[1]
    if (!expr) {
      Object.entries(siteState.envVars).forEach(([k, v]) => output.push(`${k}=${v}`))
    } else {
      const eqIdx = expr.indexOf('=')
      if (eqIdx === -1) {
        output.push("usage: export KEY=VALUE")
      } else {
        const key = expr.slice(0, eqIdx).trim()
        const val = expr.slice(eqIdx + 1).trim()
        
        // Update the env vars in the site terminal state!
        set((s: InfraState) => {
          const cs = s.terminalStates[siteId]
          if (!cs) return {}
          return {
            terminalStates: {
              ...s.terminalStates,
              [siteId]: {
                ...cs,
                envVars: {
                  ...cs.envVars,
                  [key]: val
                }
              }
            }
          }
        })
        output.push(`[[GREEN]]env set: ${key} = ${val}[[RESET]]`)
      }
    }
  } else if (cmdLower === 'prometheus' || cmdLower === 'prom') {
    const rawMetrics = PrometheusExporter.exportMetrics()
    output.push("--- [[GREEN]]PROMETHEUS OPENMETRICS EXPORTER[[RESET]] ---")
    rawMetrics.split('\n').forEach(line => {
      if (line.trim()) {
        output.push(line)
      }
    })
  } else if (cmdLower === 'traces' || cmdLower === 'trace') {
    const spans = ObservabilityTracer.getSpans()
    output.push("--- [[BLUE]]SYSTEM TRANSACTION TRACER LOGS[[RESET]] ---")
    if (spans.length === 0) {
      output.push("No transaction spans recorded in the current sliding window.")
    } else {
      spans.forEach(span => {
        const timeStr = new Date(span.timestamp).toLocaleTimeString()
        const durationStr = span.durationMs !== undefined ? `${span.durationMs}ms` : 'running'
        const color = span.status === 'success' ? '[[GREEN]]' : span.status === 'failed' ? '[[RED]]' : '[[YELLOW]]'
        const statusLabel = `${color}${span.status.toUpperCase()}[[RESET]]`
        output.push(`[${timeStr}] ${statusLabel} ${span.name} (id: ${span.spanId}, parent: ${span.parentSpanId ?? 'none'}, duration: ${durationStr})`)
        if (span.metadata && Object.keys(span.metadata).length > 0) {
          output.push(`  metadata: ${JSON.stringify(span.metadata)}`)
        }
      })
    }
  } else if (cmdLower === 'alerts' || cmdLower === 'alert') {
    const rules = ObservabilityAlerting.getRules()
    output.push("--- [[RED]]OBSERVABILITY RULES REGISTRY[[RESET]] ---")
    rules.forEach(rule => {
      const activeStr = rule.isActive ? '[[GREEN]]ACTIVE[[RESET]]' : '[[RED]]INACTIVE[[RESET]]'
      output.push(`Rule: ${rule.name} [${activeStr}]`)
      output.push(`  Metric: ${rule.metricType} | Operator: ${rule.operator} | Threshold: ${rule.threshold} | Severity: ${rule.severity}`)
    })
  } else if (cmdLower === 'pdu') {
    const action = args[1]?.toLowerCase()
    const targetRackId = args[2]
    if (action === 'status') {
      output.push("--- [[BLUE]]PDU POWER DISTRIBUTION MODULES[[RESET]] ---")
      nodes.filter(n => n.type === 'rack' && n.siteId === siteId).forEach(n => {
        const isTripped = n.breakerTripped
        const statusStr = isTripped ? '[[RED]]TRIPPED[[RESET]]' : '[[GREEN]]NOMINAL[[RESET]]'
        output.push(`Rack: ${n.hostname || n.name || n.id.slice(0, 8)} | Max: ${(n.maxPowerKW ?? 5).toFixed(1)} kW | Load: ${(n.currentPowerKW ?? 0).toFixed(2)} kW | Status: ${statusStr}`)
      })
    } else if (action === 'reset') {
      if (!targetRackId) {
        output.push("usage: pdu reset [rack_id_or_name]")
      } else {
        const rack = nodes.find(n => n.type === 'rack' && (n.id === targetRackId || n.name === targetRackId || n.hostname === targetRackId))
        if (!rack) {
          output.push(`[[RED]]ERROR: Rack '${targetRackId}' not found.[[RESET]]`)
        } else {
          get().resetRackBreaker(rack.id)
          output.push(`[[GREEN]]SUCCESS: PDU Breaker for ${rack.name || rack.id.slice(0, 8)} has been reset. All mounted servers are starting boot sequence.[[RESET]]`)
        }
      }
    } else {
      output.push("usage: [[YELLOW]]pdu status[[RESET]] or [[YELLOW]]pdu reset [rack_id][[RESET]]")
    }
  } else {
    output.push(`-bash: [[YELLOW]]${cmdLower}[[RESET]]: command not found`)
  }

  // --- 7. FINAL UPDATE ---
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
            logs: forceClear ? [] : [...p.logs, `> ${text}`, ...output].slice(-200),
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
