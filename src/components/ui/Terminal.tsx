import React, { useState, useRef, useEffect } from 'react'
import { useInfraStore } from '../../store/useInfraStore'

export const Terminal: React.FC = () => {
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const { terminalLogs, processCommand } = useInfraStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [terminalLogs, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    processCommand(input)
    setInput('')
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[100] bg-slate-900/90 border border-teal-500/30 p-3 rounded-full shadow-[0_0_20px_rgba(45,212,191,0.2)] hover:scale-110 transition-all text-teal-400"
      >
        <span className="text-xl font-mono">{'>_'}</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-64 z-[100] bg-black/90 border border-teal-500/50 rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.8)] flex flex-col font-mono overflow-hidden">
      <div className="bg-slate-900 px-3 py-1.5 flex justify-between items-center border-b border-teal-500/30">
        <span className="text-[10px] text-teal-500 font-bold tracking-widest uppercase">Live Terminal v1.0.0</span>
        <button onClick={() => setIsOpen(false)} className="text-teal-500 hover:text-white">×</button>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 text-[11px] space-y-1"
      >
        {terminalLogs.map((log, i) => (
          <div key={i} className={log.startsWith('>') ? 'text-teal-400' : 'text-emerald-500/80 italic'}>
            {log}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-2 bg-slate-950 border-t border-teal-500/20">
        <div className="flex gap-2 items-center">
          <span className="text-teal-500 font-bold">{'>'}</span>
          <input 
            autoFocus
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type 'help'..."
            className="flex-1 bg-transparent border-none outline-none text-teal-300 text-[11px]"
          />
        </div>
      </form>
    </div>
  )
}
