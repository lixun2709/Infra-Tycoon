import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import type { TerminalPane } from '../../store/terminalTypes'
import { X, Plus, Maximize2, Minimize2, Terminal as TerminalIcon, GripHorizontal, Activity, Cpu, Shield } from 'lucide-react'

const TerminalLine: React.FC<{ text: string }> = ({ text }) => {
  if (text.startsWith('>')) {
    return (
      <div className="text-teal-400 font-black flex items-center gap-2 mb-2 mt-4">
        <span className="text-[10px] opacity-40">#</span>
        {text.slice(1)}
      </div>
    )
  }

  const parts = text.split(/(\[\[[A-Z]+\]\])/)
  const renderedParts: React.ReactNode[] = []
  let currentStyle = 'text-slate-300'
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part === '[[GREEN]]') { currentStyle = 'text-[#4AF626] font-bold' }
    else if (part === '[[RED]]') { currentStyle = 'text-[#FF3131] font-bold' }
    else if (part === '[[BLUE]]') { currentStyle = 'text-[#1E90FF] font-bold' }
    else if (part === '[[YELLOW]]') { currentStyle = 'text-[#FFFF00] font-bold' }
    else if (part === '[[RESET]]') { currentStyle = 'text-slate-300' }
    else if (part) {
      renderedParts.push(<span key={i} className={currentStyle}>{part}</span>)
    }
  }

  return (
    <div className="leading-relaxed break-words opacity-90 mb-0.5">
      {renderedParts}
    </div>
  )
}

const NanoEditor: React.FC<{ pane: TerminalPane, siteId: string }> = ({ pane, siteId }) => {
  const { terminalStates, writeTerminalFile, processCommand } = useInfraStore()
  const siteState = terminalStates[siteId]
  const filePath = pane.context.targetId || 'unknown'
  const initialContent = siteState?.storedFiles[filePath] || ''
  const [content, setContent] = useState(initialContent)

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'o') {
      e.preventDefault()
      writeTerminalFile(filePath, content)
      processCommand(`echo "[[GREEN]]File ${filePath} saved.[[RESET]]"`)
    }
    if (e.ctrlKey && e.key === 'x') {
      e.preventDefault()
      writeTerminalFile(filePath, content)
      processCommand('exit')
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-[#010409] text-[#e6edf3] font-mono text-[11px] p-0 overflow-hidden">
      <div className="bg-[#f0f6fc]/10 px-4 py-1 flex justify-between items-center text-[10px] font-bold">
        <span>GNU nano 7.2</span>
        <span className="uppercase">{filePath}</span>
        <span>Modified</span>
      </div>
      <textarea 
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKey}
        spellCheck={false}
        className="flex-1 bg-transparent p-4 outline-none resize-none custom-scrollbar leading-relaxed"
      />
      <div className="grid grid-cols-4 gap-4 px-4 py-2 bg-[#f0f6fc]/5 text-[9px] uppercase font-black text-slate-400">
        <div>[[YELLOW]]^G[[RESET]] Get Help</div>
        <div>[[YELLOW]]^O[[RESET]] Write Out</div>
        <div>[[YELLOW]]^W[[RESET]] Where Is</div>
        <div>[[YELLOW]]^K[[RESET]] Cut</div>
        <div>[[YELLOW]]^X[[RESET]] Exit</div>
        <div>[[YELLOW]]^J[[RESET]] Justify</div>
        <div>[[YELLOW]]^R[[RESET]] Read File</div>
        <div>[[YELLOW]]^U[[RESET]] Paste</div>
      </div>
    </div>
  )
}

const TopMonitor: React.FC<{ nodeId?: string | null, siteId: string }> = ({ nodeId, siteId }) => {
  const [tick, setTick] = useState(0)
  const { nodes, processCommand } = useInfraStore()
  const targetNode = nodeId ? nodes.find(n => n.id === nodeId) : null

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'q' || (e.ctrlKey && e.key === 'c')) {
        processCommand('exit')
      }
    }
    window.addEventListener('keydown', handleGlobalKey)
    return () => {
      clearInterval(interval)
      window.removeEventListener('keydown', handleGlobalKey)
    }
  }, [processCommand])

  const renderBar = (val: number, color: string) => {
    const filled = Math.floor(val / 5)
    return (
      <span className="font-mono">
        [<span className={color}>{'#'.repeat(Math.max(0, Math.min(20, filled)))}{' '.repeat(Math.max(0, 20 - filled))}</span>] {val.toFixed(1)}%
      </span>
    )
  }

  const metrics = useMemo(() => {
    const cpuBase = targetNode ? (targetNode.systemState === 'running' ? 15 : 0) : 5
    const memBase = targetNode ? (targetNode.systemState === 'running' ? 40 : 0) : 10
    
    const pseudoRand = (seed: number) => {
      const x = Math.sin(seed + tick) * 10000
      return x - Math.floor(x)
    }

    const currentSiteNodes = nodes.filter(n => n.siteId === siteId).slice(0, 12)

    return {
      cpu: pseudoRand(1) * 10 + cpuBase,
      mem: pseudoRand(2) * 5 + memBase,
      procMetrics: (targetNode ? targetNode.services : currentSiteNodes).map((_, i) => ({
        cpu: pseudoRand(i + 10) * 12,
        mem: pseudoRand(i + 20) * 5
      }))
    }
  }, [tick, targetNode, nodes, siteId])

  return (
    <div className="flex-1 bg-black p-8 font-mono text-[10px] space-y-4 overflow-hidden selection:bg-teal-500/20">
      <div className="flex justify-between items-start border-b border-white/10 pb-4">
        <div>
          <div className="text-teal-400 font-black text-xs mb-1">
            {targetNode ? `${targetNode.hostname || targetNode.id.slice(0,8)}` : 'PROD-INFRA'} - TOP MONITOR v1.4
          </div>
          <div className="text-slate-500 uppercase tracking-widest text-[9px]">Uptime: 42 days, 14:22:01</div>
        </div>
        <div className="text-right">
           <div className="text-slate-400">LOAD AVG: 0.85 1.02 0.94</div>
           <div className="text-slate-500 text-[9px]">Press [[RED]]'q'[[RESET]] or [[RED]]Ctrl+C[[RESET]] to exit</div>
        </div>
      </div>

      <div className="space-y-2">
         <div className="flex items-center gap-4">
            <span className="w-12 text-slate-500 uppercase">CPU:</span>
            {renderBar(metrics.cpu, 'text-emerald-400')}
         </div>
         <div className="flex items-center gap-4">
            <span className="w-12 text-slate-500 uppercase">MEM:</span>
            {renderBar(metrics.mem, 'text-teal-400')}
         </div>
      </div>

      <table className="w-full text-left mt-8 border-collapse">
         <thead>
           <tr className="text-slate-500 border-b border-white/5 uppercase text-[9px]">
             <th className="py-2">PID</th>
             <th>USER</th>
             <th>%CPU</th>
             <th>%MEM</th>
             <th>COMMAND</th>
           </tr>
         </thead>
         <tbody>
           {targetNode ? (
             targetNode.services.map((s, i) => {
               const metric = metrics.procMetrics[i]
               const cpuVal = metric ? metric.cpu : 0
               const memVal = metric ? metric.mem : 0
               return (
                 <tr key={s.id} className="text-slate-300 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                   <td className="py-1.5">{1000 + i}</td>
                   <td>root</td>
                   <td className="text-emerald-400 font-bold">{(cpuVal + (s.status === 'running' ? 2 : 0)).toFixed(1)}</td>
                   <td>{(memVal + 1).toFixed(1)}</td>
                   <td className="text-teal-500">{s.type.toLowerCase()}d</td>
                 </tr>
               )
             })
           ) : (
             nodes.filter(n => n.siteId === siteId).slice(0, 12).map((n, i) => {
               const metric = metrics.procMetrics[i]
               const cpuVal = metric ? metric.cpu : 0
               const memVal = metric ? metric.mem : 0
               return (
                 <tr key={n.id} className="text-slate-300 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                   <td className="py-1.5">{2000 + i}</td>
                   <td>system</td>
                   <td className="text-emerald-400 font-bold">{cpuVal.toFixed(1)}</td>
                   <td>{memVal.toFixed(1)}</td>
                   <td className="text-teal-500">{n.name}</td>
                 </tr>
               )
             })
           )}
         </tbody>
      </table>
    </div>
  )
}

export const Terminal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const currentSiteId = useInfraStore(s => s.currentSiteId)
  const selectedNodeId = useInfraStore(s => s.selectedNodeId)
  const siteState = useInfraStore(s => s.terminalStates[currentSiteId])
  const nodes = useInfraStore(s => s.nodes)
  
  const { 
    processCommand, 
    addTerminalSession, 
    closeTerminalSession, 
    setActiveSession, 
    updateTerminalLayout,
    splitTerminalPane,
    setActivePane
  } = useInfraStore()

  const [localLayout, setLocalLayout] = useState({ 
    width: siteState?.layout.width || 850, 
    height: siteState?.layout.height || 550, 
    x: siteState?.layout.x || 100, 
    y: siteState?.layout.y || 120 
  })
  
  const [input, setInput] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [systemLoad, setSystemLoad] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemLoad(Math.random() * 100)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    if (siteState?.layout) {
      timer = setTimeout(() => {
        setLocalLayout({
          width: siteState.layout.width,
          height: siteState.layout.height,
          x: siteState.layout.x,
          y: siteState.layout.y
        })
      }, 0)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [currentSiteId, siteState?.layout])

  // Auto-attach to selected node
  useEffect(() => {
    if (selectedNodeId && siteState?.sessions) {
      const node = nodes.find(n => n.id === selectedNodeId)
      if (node && node.type !== 'rack') {
        const existingSession = siteState.sessions.find(s => s.panes.some(p => p.context.targetId === selectedNodeId))
        if (existingSession) {
          setActiveSession(existingSession.id)
        } else {
          addTerminalSession(`${node.hostname || node.name} CONSOLE`, { mode: 'ssh', targetId: selectedNodeId })
        }
      }
    }
  }, [selectedNodeId, siteState?.sessions, nodes, addTerminalSession, setActiveSession])

  if (!siteState || !siteState.sessions || siteState.sessions.length === 0) return null

  const { sessions, activeSessionId, layout } = siteState
  const firstSession = sessions[0]
  if (!firstSession) return null
  const activeSession = sessions.find(s => s.id === activeSessionId) || firstSession
  const { panes, activePaneId, layout: sessionLayout } = activeSession
  const firstPane = panes[0]
  if (!firstPane) return null
  const activePane = panes.find(p => p.id === activePaneId) || firstPane

  // Auto-scroll logic
  // We use the effect inside Terminal because it needs scrollRef
  // which is tied to the focused pane DOM element.
  // Using a trick: scrollRef is only attached to the focused pane.
  // But wait, useEffect doesn't know which pane is focused unless it's in the dependency array.
  // Actually, it's better to just use a ref and scroll it in useLayoutEffect if possible, 
  // but useEffect is fine.

  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = localLayout.width
    const startHeight = localLayout.height

    const doDrag = (dragEvent: MouseEvent) => {
      const newWidth = Math.max(600, startWidth + (dragEvent.clientX - startX))
      const newHeight = Math.max(450, startHeight + (dragEvent.clientY - startY))
      setLocalLayout(prev => ({ ...prev, width: newWidth, height: newHeight }))
    }

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag)
      document.removeEventListener('mouseup', stopDrag)
      updateTerminalLayout({ width: localLayout.width, height: localLayout.height })
    }

    document.addEventListener('mousemove', doDrag)
    document.addEventListener('mouseup', stopDrag)
  }

  const handleMove = (e: React.MouseEvent) => {
    if (layout.isMaximized) return
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.terminal-tab')) return

    e.preventDefault()
    const startX = e.clientX - localLayout.x
    const startY = e.clientY - localLayout.y

    const doDrag = (dragEvent: MouseEvent) => {
      setLocalLayout(prev => ({ ...prev, x: dragEvent.clientX - startX, y: dragEvent.clientY - startY }))
    }

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag)
      document.removeEventListener('mouseup', stopDrag)
      updateTerminalLayout({ x: localLayout.x, y: localLayout.y })
    }

    document.addEventListener('mousemove', doDrag)
    document.addEventListener('mouseup', stopDrag)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'V') {
      e.preventDefault()
      splitTerminalPane('vertical')
    } else if (e.ctrlKey && e.shiftKey && e.key === 'H') {
      e.preventDefault()
      splitTerminalPane('horizontal')
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault()
      processCommand('clear')
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const commands = ['ls', 'cd', 'cat', 'pwd', 'clear', 'history', 'man', 'top', 'show', 'volume', 'sla', 'ssh', 'ping', 'nmap', 'exit', 'vserver', 'protection_status', 'iptables', 'alias', 'export', 'watch', 'nano']
      const nodeIps = nodes.filter(n => n.siteId === currentSiteId).flatMap(n => n.ports.map(p => p.ip).filter(Boolean))
      const suggestions = [...commands, ...nodeIps] as string[]
      
      const lastPart = input.split(/\s+/).pop()?.toLowerCase() || ''
      const match = suggestions.find(c => c.startsWith(lastPart))
      if (match) setInput(input.slice(0, -lastPart.length) + match + ' ')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (activePane.history.length > 0) {
        const newIndex = historyIndex === -1 ? activePane.history.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        const historyCommand = activePane.history[newIndex]
        if (historyCommand !== undefined) {
          setInput(historyCommand)
        }
      }
    }
  }

  const renderPane = (pane: TerminalPane, isFocused: boolean) => {
    const paneNode = pane.context.targetId ? nodes.find(n => n.id === pane.context.targetId) : null
    
    if (pane.context.mode === 'nano') return <NanoEditor key={pane.id} pane={pane} siteId={currentSiteId} />
    if (pane.context.mode === 'top') return <TopMonitor key={pane.id} nodeId={pane.context.targetId} siteId={currentSiteId} />

    return (
      <div 
        key={pane.id}
        onClick={() => setActivePane(pane.id)}
        className={`flex-1 flex flex-col min-h-0 relative transition-all duration-300 ${isFocused ? 'bg-white/[0.04]' : 'bg-black/20 opacity-60 grayscale-[0.5]'}`}
      >
        <div className="absolute top-2 left-6 flex items-center gap-3 pointer-events-none z-20">
           {paneNode && <span className="text-[8px] font-black uppercase text-teal-400/60 tracking-widest">{paneNode.name}</span>}
           <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">{pane.context.mode}</span>
        </div>

        <div 
          ref={isFocused ? scrollRef : null}
          className="flex-1 overflow-y-auto px-8 pt-10 pb-6 custom-scrollbar font-mono text-[11px] selection:bg-teal-500/30"
        >
          {pane.logs.map((log, i) => (
            <TerminalLine key={i} text={log} />
          ))}

          {isFocused && (
            <form 
              onSubmit={(e) => { e.preventDefault(); if (input.trim()) { processCommand(input); setInput(''); setHistoryIndex(-1); } }}
              className="mt-6 group"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-teal-400 font-black text-xs uppercase tracking-tighter">
                    {paneNode ? `root@${paneNode.hostname || paneNode.id.slice(0,8)}` : 'root@infra'}
                  </span>
                  <span className="text-slate-500 text-xs">:</span>
                  <span className="text-amber-400 text-xs font-black">{pane.cwd}</span>
                  <span className="text-emerald-500 font-black text-[10px] animate-pulse">●</span>
                </div>
                <input 
                  autoFocus
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-none outline-none text-white text-xs font-medium placeholder:text-slate-700 tracking-wider"
                  placeholder="Enter directive..."
                />
              </div>
            </form>
          )}
          <div className="h-4" />
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: layout.isMaximized ? '100vw' : `${localLayout.width}px`, 
        height: layout.isMaximized ? '100vh' : `${localLayout.height}px`,
        left: layout.isMaximized ? '0' : `${localLayout.x}px`,
        top: layout.isMaximized ? '0' : `${localLayout.y}px`,
      }}
      className={`fixed z-[100] bg-[#020617]/90 backdrop-blur-[15px] text-slate-200 shadow-[0_50px_150px_rgba(0,0,0,0.9)] border border-white/10 flex flex-col font-sans overflow-hidden ${layout.isMaximized ? 'rounded-none' : 'rounded-3xl'}`}
    >
      <div 
        onMouseDown={handleMove}
        className={`bg-white/[0.02] flex items-center px-6 h-14 border-b border-white/5 relative z-10 ${layout.isMaximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
      >
        <div className="flex items-center gap-3 mr-6 shrink-0">
           <GripHorizontal size={18} className="text-slate-600 hover:text-teal-400 transition-colors cursor-move" />
           <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.2)]">
              <TerminalIcon size={16} />
           </div>
        </div>
        
        <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {sessions.map(s => (
            <div 
              key={s.id}
              onClick={() => setActiveSession(s.id)}
              onDoubleClick={() => setEditingTabId(s.id)}
              className={`terminal-tab flex items-center gap-4 px-6 py-2 rounded-xl cursor-pointer transition-all min-w-[150px] max-w-[240px] group relative ${s.id === activeSessionId ? 'bg-white/10 text-white border border-white/10' : 'text-slate-500 hover:bg-white/5'}`}
            >
              <Activity size={12} className={s.id === activeSessionId ? 'text-teal-400' : 'text-slate-600'} />
              <span className="text-[10px] font-black uppercase tracking-widest truncate">
                {editingTabId === s.id ? 'RENAME...' : s.title}
              </span>
              {sessions.length > 1 && (
                <X 
                  size={12} 
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all ml-auto" 
                  onClick={(e) => { e.stopPropagation(); closeTerminalSession(s.id) }} 
                />
              )}
            </div>
          ))}
          <button 
            onClick={() => addTerminalSession()}
            className="p-2 text-slate-600 hover:text-teal-400 transition-colors shrink-0 ml-2"
          >
            <Plus size={20} />
          </button>
        </div>
        
        <div className="flex items-center gap-4 ml-6 shrink-0">
          <button onClick={() => updateTerminalLayout({ isMaximized: !layout.isMaximized })} className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-all">
            {layout.isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-500 transition-all">
            <X size={22} />
          </button>
        </div>
      </div>

      <div className={`flex-1 flex min-h-0 relative z-10 ${sessionLayout === 'vertical' ? 'flex-col' : 'flex-row'}`}>
         {panes.map(p => renderPane(p, p.id === activePaneId))}
      </div>

      <div className="h-10 bg-black/40 border-t border-white/5 px-8 flex items-center justify-between relative z-20">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Operator:</span>
               <span className="text-[10px] font-bold text-teal-400 uppercase tracking-tighter">ADMIN@SYSTEM</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
               <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Site:</span>
               <span className={`text-[10px] font-bold uppercase tracking-tighter ${currentSiteId === 'site-1' ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {currentSiteId === 'site-1' ? 'PRIMARY_DC' : 'DISASTER_RECOVERY'}
               </span>
            </div>
         </div>

         <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
               <Cpu size={14} className="text-slate-500" />
               <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">LOAD: {systemLoad.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-3">
               <Shield size={14} className="text-teal-400 animate-pulse" />
               <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Encrypted</span>
            </div>
            <div className="flex items-center gap-3">
               <Activity size={14} className="text-rose-500 animate-[ping_2s_infinite]" />
               <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Heartbeat</span>
            </div>
         </div>
      </div>

      <div className="absolute inset-0 pointer-events-none z-[110] overflow-hidden opacity-[0.03]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      </div>
      <div className="absolute inset-0 pointer-events-none z-[110] bg-white/5 opacity-[0.01] animate-pulse" />

      {!layout.isMaximized && (
        <div 
          onMouseDown={handleResize}
          className="absolute bottom-0 right-0 w-10 h-10 cursor-nwse-resize flex items-end justify-end p-2 group z-[120]"
        >
          <GripHorizontal size={16} className="text-white/10 group-hover:text-teal-400 transition-colors rotate-45" />
        </div>
      )}
    </div>
  )
}
