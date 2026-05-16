import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'warning' | 'error' | 'info' | 'ghost'
  glow?: boolean
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'info', 
  glow = false, 
  className = '' 
}) => {
  const styles = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    error: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    ghost: 'bg-slate-500/10 text-slate-400 border-slate-500/10'
  }[variant]

  return (
    <span className={`
      px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter border
      ${styles}
      ${glow ? 'shadow-[0_0_8px_rgba(0,0,0,0.5)]' : ''}
      ${className}
    `}>
      {children}
    </span>
  )
}
