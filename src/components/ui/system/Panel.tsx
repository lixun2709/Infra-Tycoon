import React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'

interface PanelProps extends HTMLMotionProps<'div'> {
  title?: string
  icon?: React.ReactNode
  variant?: 'default' | 'alert' | 'success' | 'cyber'
  children: React.ReactNode
}

export function Panel({ title, icon, variant = 'default', children, className = '', ...props }: PanelProps) {
  let bgClass = 'bg-slate-900/80 border-slate-700/50'
  let headerClass = 'text-slate-300'
  
  if (variant === 'alert') {
    bgClass = 'bg-rose-950/80 border-rose-500/30'
    headerClass = 'text-rose-400'
  } else if (variant === 'success') {
    bgClass = 'bg-emerald-950/80 border-emerald-500/30'
    headerClass = 'text-emerald-400'
  } else if (variant === 'cyber') {
    bgClass = 'bg-slate-900/90 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
    headerClass = 'text-cyan-400'
  }

  return (
    <motion.div 
      className={`rounded-xl border backdrop-blur-md overflow-hidden ${bgClass} ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      {...props}
    >
      {title && (
        <div className={`px-4 py-3 border-b border-white/5 flex items-center gap-2 ${headerClass}`}>
          {icon && <span className="opacity-80">{icon}</span>}
          <h3 className="font-bold tracking-widest uppercase text-xs">{title}</h3>
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </motion.div>
  )
}

export function DataWidget({ label, value, subtext, highlight = false }: { label: string, value: React.ReactNode, subtext?: string, highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${highlight ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-slate-800/40 border-slate-700/50'}`}>
      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-xl font-black ${highlight ? 'text-indigo-400' : 'text-slate-200'}`}>{value}</div>
      {subtext && <div className="text-[10px] text-slate-400 mt-1">{subtext}</div>}
    </div>
  )
}
