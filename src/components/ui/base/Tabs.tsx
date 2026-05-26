import React from 'react'

export interface TabItem {
  id: string
  label: string
  icon?: React.ReactNode
}

export interface TabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (id: string) => void
  variant?: 'pills' | 'underline' | 'sidebar'
  className?: string
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
  className = ''
}) => {
  if (variant === 'sidebar') {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
              activeTab === tab.id
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30 shadow-[0_0_15px_rgba(45,212,191,0.1)]'
                : 'text-slate-400 hover:bg-slate-800 border border-transparent hover:text-white'
            }`}
          >
            {tab.icon && <span className="w-5 h-5">{tab.icon}</span>}
            <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </div>
    )
  }

  if (variant === 'underline') {
    return (
      <div className={`flex w-full ${className}`}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 min-w-max py-3 px-2 text-[8px] sm:text-[9px] uppercase tracking-[0.1em] sm:tracking-[0.2em] font-black transition-all border-b-2 flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-teal-400 border-teal-500 bg-teal-500/5'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
    )
  }

  // pills
  return (
    <div className={`flex gap-2 ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === tab.id
              ? 'bg-teal-500/20 text-teal-400 border border-teal-500/50'
              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white'
          }`}
        >
          {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
