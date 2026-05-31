import React from 'react'

interface CardProps {
  children: React.ReactNode
  title?: React.ReactNode
  subtitle?: React.ReactNode
  extra?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  glass?: boolean
  onClick?: () => void
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  title, 
  subtitle, 
  extra, 
  footer, 
  className = '', 
  glass = true,
  onClick
}) => {
  return (
    <div 
      className={`${glass ? 'glass-dark' : 'bg-slate-900'} rounded-xl overflow-hidden flex flex-col ${className}`}
      onClick={onClick}
    >
      {(title || extra) && (
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div>
            {title && <h3 className="font-semibold text-slate-100 uppercase tracking-wider text-xs">{title}</h3>}
            {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {extra && <div>{extra}</div>}
        </div>
      )}
      <div className="flex-1 p-4 custom-scrollbar overflow-y-auto">
        {children}
      </div>
      {footer && (
        <div className="px-4 py-3 border-t border-white/5 bg-black/20">
          {footer}
        </div>
      )}
    </div>
  )
}
