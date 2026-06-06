import React from 'react'
import { motion } from 'framer-motion'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = ''
}) => {
  const toggle = () => {
    if (!disabled) {
      onChange(!checked)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      toggle()
    }
  }

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {label && (
        <span 
          onClick={toggle}
          className={`text-[9px] font-black uppercase tracking-widest cursor-pointer ${
            disabled ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {label}
        </span>
      )}
      
      <div
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={`
          w-10 h-5.5 rounded-full p-0.5 cursor-pointer flex items-center transition-all relative border
          ${disabled ? 'opacity-30 cursor-not-allowed border-slate-700 bg-slate-800' : ''}
          ${!disabled && checked 
            ? 'bg-teal-500/25 border-teal-500/50 shadow-[0_0_10px_rgba(45,212,191,0.15)]' 
            : 'bg-slate-950 border-white/10 hover:border-white/20'
          }
        `}
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`
            w-4.5 h-4.5 rounded-full shadow-md flex items-center justify-center
            ${checked ? 'bg-teal-400' : 'bg-slate-500'}
          `}
          style={{
            x: checked ? '18px' : '2px'
          }}
        />
      </div>
    </div>
  )
}
