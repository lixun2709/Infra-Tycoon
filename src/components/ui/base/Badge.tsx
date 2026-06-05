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
    success: 'bg-emerald-500/20 text-emerald-300 border-transparent',
    warning: 'bg-amber-500/20 text-amber-300 border-transparent',
    error: 'bg-rose-500/20 text-rose-300 border-transparent',
    info: 'bg-blue-500/20 text-blue-300 border-transparent',
    ghost: 'bg-slate-500/20 text-slate-300 border-transparent'
  }

  return (
    <span className={`
      px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border
      ${styles[variant]} 
      ${glow ? 'shadow-[0_0_10px_rgba(255,255,255,0.1)]' : ''} 
      ${className}
    `}>
      {children}
    </span>
  )
}
