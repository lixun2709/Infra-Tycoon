import React, { useState, useRef, useEffect } from 'react'
import { useInfraStore } from '../../store/useInfraStore'

export const Terminal: React.FC = () => {
  const [input, setInput] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const { terminalLogs, processCommand, selectedNodeId, nodes, commandHistory: history, terminalContext } = useInfraStore()
  
  const selectedNode = nodes.find(n => n.id === selectedNodeId)
  const isNetwork = selectedNode?.type === 'network'

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [terminalLogs, selectedNodeId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      processCommand(input)
      setInput('')
      setHistoryIndex(-1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setInput(history[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1
        if (newIndex >= history.length) {
          setHistoryIndex(-1)
          setInput('')
        } else {
          setHistoryIndex(newIndex)
          setInput(history[newIndex])
        }
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    processCommand(input)
    setInput('')
    setHistoryIndex(-1)
  }

  if (!selectedNode) return null

  let contextPrompt = '#'
  if (terminalContext.mode === 'config') contextPrompt = '(config)#'
  else if (terminalContext.mode === 'interface') contextPrompt = '(config-if)#'

  const prompt = isNetwork ? `${selectedNode.name}${contextPrompt}` : `[root@${selectedNode.name.toLowerCase().replace(/\s+/g, '-')} ~]#`
  const title = isNetwork ? 'Enterprise Network Console' : 'Secure Compute Shell'

  return (
    <div className="fixed bottom-10 left-10 w-[480px] h-80 z-50 bg-[#020617]/95 border border-teal-500/30 rounded-3xl shadow-[0_30px_100px_rgba(0,0,0,0.9)] backdrop-blur-3xl flex flex-col font-mono overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-700">
      {/* Glossy Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      
      {/* Console Header */}
      <div className="bg-slate-900/40 px-6 py-4 flex justify-between items-center border-b border-white/5 relative z-10">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]" />
            <div className="w-3 h-3 rounded-full bg-amber-500/30 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]" />
          </div>
          <div className="h-4 w-px bg-white/10 mx-1" />
          <span className="text-[10px] text-teal-400 font-black tracking-[0.3em] uppercase drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest hidden sm:block">TTY/0/SSH</div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,1)]" />
        </div>
      </div>
      
      {/* Output Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-4 text-[11px] space-y-2.5 scroll-smooth custom-scrollbar relative z-10"
      >
        <div className="text-slate-600 text-[9px] mb-6 font-bold uppercase tracking-widest opacity-60 flex items-center gap-2">
          <span className="w-8 h-px bg-slate-800" />
          Session Established: {new Date().toLocaleTimeString()}
          <span className="flex-1 h-px bg-slate-800" />
        </div>
        
        {terminalLogs.length === 0 && (
          <div className="text-slate-700 italic opacity-40 py-8 text-center text-[10px]">
             System ready. Awaiting instructions...
          </div>
        )}

        {terminalLogs.map((log, i) => (
          <div key={i} className={`leading-relaxed group transition-all duration-300 ${log.startsWith('>') ? 'text-teal-400 font-black pl-2 border-l-2 border-teal-500/30' : 'text-slate-300 opacity-90'}`}>
            {log}
          </div>
        ))}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 bg-black/60 border-t border-white/10 backdrop-blur-2xl relative z-20">
        <div className="flex gap-4 items-center bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 transition-all focus-within:border-teal-500/40 focus-within:shadow-[0_0_20px_rgba(45,212,191,0.1)]">
          <span className="text-emerald-500 font-black text-xs drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] whitespace-nowrap">{prompt}</span>
          <input 
            autoFocus
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="System call..."
            className="flex-1 bg-transparent border-none outline-none text-teal-100 text-xs font-medium placeholder:text-slate-800 tracking-wide"
          />
          <div className="flex items-center gap-2 text-[8px] text-slate-600 font-black uppercase tracking-tighter opacity-40">
            <span>Enter</span>
            <span className="px-1.5 py-0.5 border border-slate-700 rounded text-[7px]">↵</span>
          </div>
        </div>
      </form>

      {/* Advanced Visual Effects */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-20">
        {/* Scanlines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_3px,3px_100%]" />
        {/* Static Noise */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] brightness-200" />
      </div>
    </div>
  )
}
