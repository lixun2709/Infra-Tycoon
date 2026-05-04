import React, { useState, useRef, useEffect } from 'react'
import { useInfraStore } from '../../store/useInfraStore'
import type { TerminalPane, TerminalSession } from '../../store/terminalTypes'
import { X, Plus, Maximize2, Minimize2, Terminal as TerminalIcon, GripHorizontal, Activity, Cpu, Shield, Database } from 'lucide-react'

export const Terminal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const currentSiteId = useInfraStore(s => s.currentSiteId)
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  if (!siteState || !siteState.sessions || siteState.sessions.length === 0) return null

  const { sessions, activeSessionId, layout } = siteState
  const activeSession = sessions?.find(s => s.id === activeSessionId) || sessions[0]
  const { panes, activePaneId, layout: sessionLayout } = activeSession
  const activePane = panes.find(p => p.id === activePaneId) || panes[0]
  
  useEffect(() => {
    if (siteState?.layout) {
      setLocalLayout({
        width: siteState.layout.width,
        height: siteState.layout.height,
        x: siteState.layout.x,
        y: siteState.layout.y
      })
    }
  }, [currentSiteId])

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activePane.logs])

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
    // v1.3 Shortcuts
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
        setInput(activePane.history[newIndex])
      }
    }
  }

  const TerminalLine: React.FC<{ text: string }> = ({ text }) => {
    if (text.startsWith('>')) {
      return (
        <div className="text-teal-400 font-black flex items-center gap-2 mb-2 mt-4">
          <span className="text-[10px] opacity-40">#</span>
          {text.slice(1)}
        </div>
      )
    }

    // Color Engine Regex
    const parts = text.split(/(\[\[[A-Z]+\]\])/)
    let currentColor = 'text-slate-300'

    return (
      <div className={`leading-relaxed break-words ${currentColor} opacity-90 mb-0.5`}>
        {parts.map((part, i) => {
          if (part === '[[GREEN]]') { currentColor = 'text-[#4AF626] font-bold'; return null }
          if (part === '[[RED]]') { currentColor = 'text-[#FF3131] font-bold'; return null }
          if (part === '[[BLUE]]') { currentColor = 'text-[#1E90FF] font-bold'; return null }
          if (part === '[[YELLOW]]') { currentColor = 'text-[#FFFF00] font-bold'; return null }
          if (part === '[[RESET]]') { currentColor = 'text-slate-300'; return null }
          
          return <span key={i} className={currentColor}>{part}</span>
        })}
      </div>
    )
  }

  const NanoEditor: React.FC<{ pane: TerminalPane }> = ({ pane }) => {
    const filePath = pane.context.targetId || 'unknown'
    const initialContent = siteState.storedFiles[filePath] || ''
    const [content, setContent] = useState(initialContent)
    const { writeTerminalFile, processCommand } = useInfraStore()

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

  const TopMonitor: React.FC<{ pane: TerminalPane }> = ({ pane }) => {
    const [tick, setTick] = useState(0)
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
    }, [])

    const renderBar = (val: number, color: string) => {
      const filled = Math.floor(val / 5)
      return (
        <span className="font-mono">
          [<span className={color}>{'#'.repeat(filled)}{' '.repeat(20 - filled)}</span>] {val.toFixed(1)}%
        </span>
      )
    }

    return (
      <div className="flex-1 bg-black p-8 font-mono text-[10px] space-y-4 overflow-hidden selection:bg-teal-500/20">
        <div className="flex justify-between items-start border-b border-white/10 pb-4">
          <div>
            <div className="text-teal-400 font-black text-xs mb-1">PROD-INFRA-TOP - v1.3.4</div>
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
              {renderBar(Math.random() * 20 + 5, 'text-emerald-400')}
           </div>
           <div className="flex items-center gap-4">
              <span className="w-12 text-slate-500 uppercase">MEM:</span>
              {renderBar(Math.random() * 15 + 40, 'text-teal-400')}
           </div>
           <div className="flex items-center gap-4">
              <span className="w-12 text-slate-500 uppercase">SWP:</span>
              {renderBar(Math.random() * 2, 'text-rose-400')}
           </div>
        </div>

        <table className="w-full text-left mt-8 border-collapse">
           <thead>
             <tr className="text-slate-500 border-b border-white/5 uppercase text-[9px]">
               <th className="py-2">PID</th>
               <th>USER</th>
               <th>PR</th>
               <th>VIRT</th>
               <th>RES</th>
               <th>%CPU</th>
               <th>%MEM</th>
               <th>COMMAND</th>
             </tr>
           </thead>
           <tbody>
             {nodes.filter(n => n.siteId === currentSiteId).slice(0, 12).map((n, i) => (
               <tr key={n.id} className="text-slate-300 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                 <td className="py-1.5">{1000 + i}</td>
                 <td>root</td>
                 <td>20</td>
                 <td>1.2g</td>
                 <td>{(Math.random()*256+128).toFixed(0)}m</td>
                 <td className="text-emerald-400 font-bold">{(Math.random()*12).toFixed(1)}</td>
                 <td>{(Math.random()*5).toFixed(1)}</td>
                 <td className="text-teal-500">{n.name}</td>
               </tr>
             ))}
           </tbody>
        </table>
      </div>
    )
  }

  const renderPane = (pane: TerminalPane, isFocused: boolean) => {
    const paneNode = pane.context.targetId ? nodes.find(n => n.id === pane.context.targetId) : null
    
    if (pane.context.mode === 'nano') return <NanoEditor pane={pane} />
    if (pane.context.mode === 'top') return <TopMonitor pane={pane} />

    return (
      <div 
        key={pane.id}
        onClick={() => setActivePane(pane.id)}
        className={`flex-1 flex flex-col min-h-0 relative transition-all duration-300 ${isFocused ? 'bg-white/[0.04]' : 'bg-black/20 opacity-60 grayscale-[0.5]'}`}
      >
        {/* Pane Label Area */}
        <div className="absolute top-2 left-6 flex items-center gap-3 pointer-events-none z-20">
           {paneNode && <span className="text-[8px] font-black uppercase text-teal-400/60 tracking-widest">{paneNode.name}</span>}
           <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">{pane.context.mode}</span>
        </div>

        {/* Chronological Scrollable Area */}
        <div 
          ref={isFocused ? scrollRef : null}
          className="flex-1 overflow-y-auto px-8 pt-10 pb-6 custom-scrollbar font-mono text-[11px] selection:bg-teal-500/30"
        >
          {pane.logs.map((log, i) => (
            <TerminalLine key={i} text={log} />
          ))}

          {/* Bottom-Up Input Prompt */}
          {isFocused && (
            <form 
              onSubmit={(e) => { e.preventDefault(); if (input.trim()) { processCommand(input); setInput(''); setHistoryIndex(-1); } }}
              className="mt-6 group"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-teal-400 font-black text-xs uppercase tracking-tighter">root@infra</span>
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
      {/* Header / Tab Bar */}
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

      {/* Main Split-Pane Area */}
      <div className={`flex-1 flex min-h-0 relative z-10 ${sessionLayout === 'vertical' ? 'flex-col' : 'flex-row'}`}>
         {panes.map(p => renderPane(p, p.id === activePaneId))}
      </div>

      {/* Powerline Status Bar */}
      <div className="h-10 bg-black/40 border-t border-white/5 px-8 flex items-center justify-between relative z-20">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Operator:</span>
               <span className="text-[10px] font-bold text-teal-400 uppercase tracking-tighter">ADMIN@SYSTEM</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Site:</span>
               <span className={`text-[10px] font-bold uppercase tracking-tighter ${currentSiteId === 'site-1' ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {currentSiteId === 'site-1' ? 'PRIMARY_DC' : 'DISASTER_RECOVERY'}
               </span>
            </div>
         </div>

         <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
               <Cpu size={14} className="text-slate-500" />
               <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">LOAD: {(Math.random()*100).toFixed(1)}%</span>
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

      {/* Resize Handle */}
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
