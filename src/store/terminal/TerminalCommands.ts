import { registerCommand, COMMAND_REGISTRY } from './CommandRegistry'
import { TECHNICAL_MANUALS } from '../../physics/Manuals'
import { performanceMonitor } from '../../simulation/PerformanceMonitor'
import { PrometheusExporter } from '../../simulation/observability/PrometheusExporter'
import { ObservabilityTracer } from '../../simulation/observability/ObservabilityTracer'
import { ObservabilityAlerting } from '../../simulation/observability/ObservabilityAlerting'

export function initializeTerminalCommands() {
  registerCommand({
    name: 'help',
    authority: 'READ_ONLY',
    description: 'Displays the bootstrap kernel help menu.',
    execute: ({ output }) => {
      output.push("--- [[GREEN]]v1.6 BOOTSTRAP KERNEL[[RESET]] ---")
      output.push("BOOTSTRAP: [[YELLOW]]poweron[[RESET]], [[YELLOW]]hostname [n][[RESET]], [[YELLOW]]ip setup [ip] [gw] [dns][[RESET]]")
      output.push("OPS: [[BLUE]]lifecycle advance[[RESET]], [[BLUE]]ipmi status[[RESET]], [[BLUE]]ipmi power [on|off|cycle][[RESET]]")
      output.push("CORE: [[BLUE]]ls -la[[RESET]], [[BLUE]]cd[[RESET]], [[BLUE]]pwd[[RESET]], [[RED]]clear[[RESET]], [[BLUE]]man [topic][[RESET]]")
      output.push("NET: [[GREEN]]ping [target][[RESET]], [[GREEN]]show ip brief[[RESET]], [[GREEN]]traceroute[[RESET]]")
      output.push("ORCH: [[BLUE]]apt install[[RESET]], [[BLUE]]systemctl start[[RESET]], [[BLUE]]sync-ntp[[RESET]]")
      output.push("NAV: [[YELLOW]]scan console[[RESET]], [[YELLOW]]connect console [id][[RESET]], [[YELLOW]]exit[[RESET]]")
      output.push("SIM: [[BLUE]]ecs-stats[[RESET]], [[BLUE]]sim-diagnostics[[RESET]], [[BLUE]]prom[[RESET]], [[BLUE]]traces[[RESET]], [[BLUE]]alerts[[RESET]]")
      output.push("SECURITY: [[RED]]dr-drill [site_id][[RESET]], [[RED]]ransomware-drill[[RESET]], [[RED]]isolate [node_id][[RESET]], [[RED]]format [node_id][[RESET]]")
    }
  })

  registerCommand({
    name: 'ls',
    authority: 'READ_ONLY',
    description: 'List directory contents.',
    execute: ({ output, siteState }) => {
      output.push("[[BLUE]]bin[[RESET]]  [[BLUE]]etc[[RESET]]  [[BLUE]]root[[RESET]]  [[BLUE]]var[[RESET]]")
      Object.keys(siteState.storedFiles).forEach(f => output.push(`[[GREEN]]${f.split('/').pop()}[[RESET]]`))
    }
  })

  registerCommand({
    name: 'pwd',
    authority: 'READ_ONLY',
    description: 'Print working directory.',
    execute: ({ output, newCwd }) => {
      output.push(newCwd || '/')
    }
  })

  registerCommand({
    name: 'cd',
    authority: 'OPERATIONAL',
    description: 'Change directory.',
    execute: (ctx) => {
      ctx.newCwd = ctx.args[1] || '/'
    }
  })

  registerCommand({
    name: 'cat',
    authority: 'READ_ONLY',
    description: 'Concatenate files and print on the standard output.',
    execute: ({ args, siteState, output }) => {
      const file = args[1]
      if (file && siteState.storedFiles[file]) {
        siteState.storedFiles[file].split('\n').forEach(line => output.push(line))
      } else {
        output.push(`cat: ${file}: No such file or directory`)
      }
    }
  })

  registerCommand({
    name: 'echo',
    authority: 'READ_ONLY',
    description: 'Write arguments to the standard output.',
    execute: ({ args, output }) => {
      output.push(args.slice(1).join(' ').replace(/^["']|["']$/g, ''))
    }
  })

  registerCommand({
    name: 'clear',
    authority: 'READ_ONLY',
    description: 'Clear the terminal screen.',
    execute: ({ forceClear }) => {
      forceClear.value = true
    }
  })

  registerCommand({
    name: 'man',
    authority: 'READ_ONLY',
    description: 'Format and display the on-line manual pages.',
    execute: ({ args, output }) => {
      const topic = args[1]
      if (topic && TECHNICAL_MANUALS[topic]) output.push(...TECHNICAL_MANUALS[topic])
      else output.push(`[[RED]]No manual entry for ${topic || ''}[[RESET]]`)
    }
  })

  registerCommand({
    name: 'nano',
    authority: 'OPERATIONAL',
    description: 'Nano text editor.',
    execute: (ctx) => {
      const targetFile = ctx.args[1] || 'untitled.txt'
      ctx.newContext = { mode: 'nano', targetId: targetFile }
    }
  })

  registerCommand({
    name: 'top',
    authority: 'READ_ONLY',
    description: 'Display Linux processes.',
    execute: (ctx) => {
      ctx.newContext = { mode: 'top', targetId: ctx.newContext.targetId }
    }
  })

  registerCommand({
    name: 'exit',
    authority: 'OPERATIONAL',
    description: 'Exit the current console or pane.',
    execute: (ctx) => {
      if (ctx.newContext.mode !== 'global') {
        ctx.newContext = { mode: 'global', targetId: null }
        ctx.output.push("[[YELLOW]]Console detached.[[RESET]]")
      } else setTimeout(() => ctx.get().closeTerminalPane(ctx.activePane.id), 50)
    }
  })

  registerCommand({
    name: 'hostname',
    authority: 'OPERATIONAL',
    description: 'Show or set the system hostname.',
    execute: ({ args, newContext, targetNode, get, output }) => {
      const name = args[1]
      if (newContext.mode === 'ssh' && targetNode) {
        if (!name) output.push("usage: hostname [name]")
        else if (get().nodes.some(n => n.hostname === name && n.id !== targetNode.id)) {
          output.push(`[[RED]]NAME COLLISION: Hostname '${name}' is already registered on this subnet.[[RESET]]`)
        } else {
          get().setNodeHostname(targetNode.id, name)
          output.push(`[[GREEN]]Identity established: ${name}.infra.local[[RESET]]`)
        }
      } else output.push("[[RED]]hostname: must be connected to a node serial console.[[RESET]]")
    }
  })

  registerCommand({
    name: 'ip',
    authority: 'OPERATIONAL',
    description: 'Show / manipulate routing, networking devices, interfaces and tunnels.',
    execute: ({ args, newContext, targetNode, get, output }) => {
      if (args[1] === 'setup') {
        const [,,ip, gw, dns] = args
        if (newContext.mode === 'ssh' && targetNode) {
          if (!ip || !gw || !dns) {
            output.push("usage: [[YELLOW]]ip setup [IP] [Gateway] [DNS][[RESET]]")
          } else if (get().nodes.some(n => n.managementIP === ip && n.id !== targetNode.id)) {
            output.push(`[[RED]]IP CONFLICT: ${ip} is already assigned to another interface.[[RESET]]`)
          } else {
            get().updateNode(targetNode.id, { managementIP: ip, isConfigured: true })
            output.push(`[[GREEN]]Logical Interface Configured:[[RESET]]`)
            output.push(`IP: ${ip} | GW: ${gw} | DNS: ${dns}`)
          }
        } else output.push("[[RED]]ip setup: must be connected to a node serial console.[[RESET]]")
      } else {
         output.push("usage: ip setup [IP] [Gateway] [DNS]")
      }
    }
  })

  registerCommand({
    name: 'ping',
    authority: 'READ_ONLY',
    description: 'Send ICMP ECHO_REQUEST to network hosts.',
    execute: ({ args, get, newContext, output }) => {
      const target = args[1]
      if (!target) output.push("usage: ping [IP_or_Hostname]")
      else {
        const record = get().dnsRecords.find(r => r.hostname === target)
        const ip = record ? record.ip : target
        const tNode = get().nodes.find(n => n.managementIP === ip || n.hostname === target)
        if (tNode && get().checkNetworkPath(newContext.targetId || 'bastion', tNode.id)) {
          const result = get().ping(newContext.targetId || 'bastion', ip)
          if (result.success) output.push(`[[BLUE]]PING ${target} (${ip})[[RESET]]`, result.message)
          else output.push(`[[RED]]${result.message}[[RESET]]`)
        } else output.push(`[[RED]]PING ${target}: No route to host.[[RESET]]`)
      }
    }
  })

  registerCommand({
    name: 'export',
    authority: 'OPERATIONAL',
    description: 'Set environment variables.',
    execute: ({ args, siteState, output, _set, siteId }) => {
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
          set((s) => {
            const cs = s.terminalStates[siteId]
            if (!cs) return {}
            return {
              terminalStates: { ...s.terminalStates, [siteId]: { ...cs, envVars: { ...cs.envVars, [key]: val } } }
            }
          })
          output.push(`[[GREEN]]env set: ${key} = ${val}[[RESET]]`)
        }
      }
    }
  })

  registerCommand({
    name: 'show',
    authority: 'READ_ONLY',
    description: 'Show network information.',
    execute: ({ args, get, siteId, output }) => {
      if (args[1] === 'ip' && args[2] === 'brief') {
        output.push("Interface       IP-Address      Status                Protocol")
        output.push("---------       ----------      ------                --------")
        get().nodes.filter(n => n.siteId === siteId && n.type !== 'rack').forEach(n => {
          const ip = n.managementIP || 'unassigned'
          const state = n.systemState as string
          const statusColor = state === 'running' ? '[[GREEN]]' : state === 'booting' ? '[[YELLOW]]' : '[[RED]]'
          const status = `${statusColor}${state.toUpperCase()}[[RESET]]`
          output.push(`${n.hostname || n.id.slice(0,8)}`.padEnd(15) + `${ip.padEnd(15)} ${status.padEnd(30)}`)
        })
      } else {
         output.push("usage: show ip brief")
      }
    }
  })

  registerCommand({
    name: 'ecs-stats',
    authority: 'READ_ONLY',
    description: 'Display ECS telemetry.',
    execute: ({ get, output }) => {
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
    }
  })

  registerCommand({
    name: 'sim-diagnostics',
    authority: 'READ_ONLY',
    description: 'Display simulation diagnostics.',
    execute: ({ output }) => {
      output.push("--- [[YELLOW]]DIAGNOSTICS[[RESET]] ---")
      output.push(`FPS: ${performanceMonitor.getMetrics().fps} | Latency: ${performanceMonitor.getMetrics().workerLatency.toFixed(2)}ms`)
    }
  })

  registerCommand({
    name: 'prom',
    authority: 'READ_ONLY',
    description: 'Display Prometheus openmetrics.',
    execute: ({ output }) => {
      const rawMetrics = PrometheusExporter.exportMetrics()
      output.push("--- [[GREEN]]PROMETHEUS OPENMETRICS EXPORTER[[RESET]] ---")
      rawMetrics.split('\n').forEach(line => {
        if (line.trim()) output.push(line)
      })
    }
  })
  
  registerCommand({
    name: 'prometheus',
    authority: 'READ_ONLY',
    description: 'Alias for prom.',
    execute: (ctx) => COMMAND_REGISTRY['prom'].execute(ctx)
  })

  registerCommand({
    name: 'trace',
    authority: 'READ_ONLY',
    description: 'Display observability traces.',
    execute: ({ output }) => {
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
    }
  })

  registerCommand({
    name: 'traces',
    authority: 'READ_ONLY',
    description: 'Alias for trace.',
    execute: (ctx) => COMMAND_REGISTRY['trace'].execute(ctx)
  })

  registerCommand({
    name: 'alert',
    authority: 'READ_ONLY',
    description: 'Display observability alerts.',
    execute: ({ output }) => {
      const rules = ObservabilityAlerting.getRules()
      output.push("--- [[RED]]OBSERVABILITY RULES REGISTRY[[RESET]] ---")
      rules.forEach(rule => {
        const activeStr = rule.isActive ? '[[GREEN]]ACTIVE[[RESET]]' : '[[RED]]INACTIVE[[RESET]]'
        output.push(`Rule: ${rule.name} [${activeStr}]`)
        output.push(`  Metric: ${rule.metricType} | Operator: ${rule.operator} | Threshold: ${rule.threshold} | Severity: ${rule.severity}`)
      })
    }
  })

  registerCommand({
    name: 'alerts',
    authority: 'READ_ONLY',
    description: 'Alias for alert.',
    execute: (ctx) => COMMAND_REGISTRY['alert'].execute(ctx)
  })

  // SIMULATION CRITICAL COMMANDS
  registerCommand({
    name: 'poweron',
    authority: 'SIMULATION_CRITICAL',
    description: 'Power on a logically powered down node.',
    execute: ({ newContext, targetNode, get, output }) => {
      if (newContext.mode === 'ssh' && targetNode) {
        // Send to worker instead of mutating state synchronously
        get().sendTerminalCommand({ action: 'poweron', targetId: targetNode.id })
        output.push("[[GREEN]]Initializing Hardware Stack via Baseboard Management Controller...[[RESET]]")
        output.push("POST: CPU Check [PENDING] | RAM Sync [PENDING] | Bus Scan [PENDING]")
        output.push("Hardware initialization dispatched to facility controller.")
      } else output.push("[[RED]]poweron: must be connected to a node serial console.[[RESET]]")
    }
  })

  registerCommand({
    name: 'pdu',
    authority: 'SIMULATION_CRITICAL',
    description: 'Manage PDU power distribution modules.',
    execute: ({ args, siteId, get, output }) => {
      const action = args[1]?.toLowerCase()
      const targetRackId = args[2]
      if (action === 'status') {
        output.push("--- [[BLUE]]PDU POWER DISTRIBUTION MODULES[[RESET]] ---")
        get().nodes.filter(n => n.type === 'rack' && n.siteId === siteId).forEach(n => {
          const isTripped = n.breakerTripped
          const statusStr = isTripped ? '[[RED]]TRIPPED[[RESET]]' : '[[GREEN]]NOMINAL[[RESET]]'
          output.push(`Rack: ${n.hostname || n.name || n.id.slice(0, 8)} | Max: ${(n.maxPowerKW ?? 5).toFixed(1)} kW | Load: ${(n.currentPowerKW ?? 0).toFixed(2)} kW | Status: ${statusStr}`)
        })
      } else if (action === 'reset') {
        if (!targetRackId) {
          output.push("usage: pdu reset [rack_id_or_name]")
        } else {
          const rack = get().nodes.find(n => n.type === 'rack' && (n.id === targetRackId || n.name === targetRackId || n.hostname === targetRackId))
          if (!rack) {
            output.push(`[[RED]]ERROR: Rack '${targetRackId}' not found.[[RESET]]`)
          } else {
            // Worker authoritative dispatch
            get().sendTerminalCommand({ action: 'pdu reset', targetId: rack.id })
            output.push(`[[GREEN]]DISPATCHED: Reset signal sent to PDU for ${rack.name || rack.id.slice(0, 8)}.[[RESET]]`)
          }
        }
      } else {
        output.push("usage: [[YELLOW]]pdu status[[RESET]] or [[YELLOW]]pdu reset [rack_id][[RESET]]")
      }
    }
  })

  registerCommand({
    name: 'dr-drill',
    authority: 'SIMULATION_CRITICAL',
    description: 'Trigger a disaster recovery drill.',
    execute: ({ args, get, output }) => {
      const targetSite = args[1]
      if (!targetSite) {
        output.push("usage: dr-drill [site_id]")
      } else {
        get().sendTerminalCommand({ action: 'dr-drill', siteId: targetSite })
        output.push(`[[RED]]INITIATING DR DRILL FOR SITE: ${targetSite}[[RESET]]`)
        output.push("Facility power cut dispatched. Awaiting telemetry...")
      }
    }
  })

  registerCommand({
    name: 'ransomware-drill',
    authority: 'SIMULATION_CRITICAL',
    description: 'Trigger a ransomware simulation.',
    execute: ({ get, output }) => {
      get().sendTerminalCommand({ action: 'ransomware-drill' })
      output.push("[[RED]]WARNING: Ransomware payload dispatched into network via worker queue.[[RESET]]")
    }
  })

  registerCommand({
    name: 'isolate',
    authority: 'SIMULATION_CRITICAL',
    description: 'Isolate a node from the network.',
    execute: ({ args, get, output }) => {
      const targetNodeId = args[1]
      if (!targetNodeId) {
        output.push("usage: isolate [node_id]")
      } else {
        get().sendTerminalCommand({ action: 'isolate', targetId: targetNodeId })
        output.push(`[[YELLOW]]Isolation command dispatched for node ${targetNodeId}.[[RESET]]`)
      }
    }
  })

  registerCommand({
    name: 'format',
    authority: 'SIMULATION_CRITICAL',
    description: 'Format a node.',
    execute: ({ args, get, output }) => {
      const targetNodeId = args[1]
      if (!targetNodeId) {
        output.push("usage: format [node_id]")
      } else {
        get().sendTerminalCommand({ action: 'format', targetId: targetNodeId })
        output.push(`[[GREEN]]Format command dispatched for node ${targetNodeId}.[[RESET]]`)
      }
    }
  })
}
