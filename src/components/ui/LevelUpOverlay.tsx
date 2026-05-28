import { useState, useEffect } from 'react'
import { Trophy, ArrowUpCircle, X } from 'lucide-react'
import { audioManager } from '../../utils/AudioManager'

export function LevelUpOverlay() {
  const [isOpen, setIsOpen] = useState(false)
  const [level, setLevel] = useState(1)

  useEffect(() => {
    const handleLevelUp = (e: Event) => {
      const customEvent = e as CustomEvent<{ level: number }>
      setLevel(customEvent.detail.level)
      setIsOpen(true)
      audioManager.playEffect('success')
    }

    window.addEventListener('enterprise-level-up', handleLevelUp)
    return () => window.removeEventListener('enterprise-level-up', handleLevelUp)
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg glass-panel rounded-[2rem] p-10 flex flex-col items-center text-center shadow-[0_0_50px_rgba(45,212,191,0.2)] animate-in zoom-in-95 duration-500 border border-teal-500/30">
        
        {/* Decorative background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-teal-500/10 to-transparent rounded-[2rem] pointer-events-none" />
        
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="w-24 h-24 bg-gradient-to-br from-teal-400 to-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(45,212,191,0.4)]">
          <Trophy size={48} className="text-[#020617]" />
        </div>

        <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">
          Enterprise Tier <span className="text-teal-400">{level}</span>
        </h2>
        
        <p className="text-slate-400 text-sm font-bold max-w-sm mx-auto mb-8">
          Congratulations! Your operational excellence and infrastructure expansion have elevated your company's market position.
        </p>

        <div className="w-full bg-slate-900/50 rounded-2xl p-6 border border-white/5 mb-8 text-left">
          <h3 className="text-[10px] font-black text-teal-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <ArrowUpCircle size={14} />
            New Capabilities Unlocked
          </h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">Advanced Hardware Procurement</p>
                <p className="text-[10px] text-slate-500">Check the catalog for newly unlocked high-density servers and cooling solutions.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">High-Tier Contracts</p>
                <p className="text-[10px] text-slate-500">Larger enterprise and government contracts are now available in the economy dashboard.</p>
              </div>
            </li>
          </ul>
        </div>

        <button 
          onClick={() => setIsOpen(false)}
          className="w-full py-4 bg-teal-500 text-[#020617] rounded-xl text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_10px_20px_rgba(20,184,166,0.3)]"
        >
          Acknowledge & Continue
        </button>
      </div>
    </div>
  )
}
