import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldAlert, Info, AlertTriangle } from 'lucide-react'
import { useInfraStore } from '../../../store/useInfraStore'

interface ToastItemProps {
  toast: {
    id: string
    message: string
    severity: 'info' | 'warning' | 'critical'
    timestamp: number
    isAcknowledged: boolean
  }
  acknowledgeAlert: (id: string) => void
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, acknowledgeAlert }) => {
  // Auto-dismiss notification after 5 seconds of active display
  useEffect(() => {
    const timer = setTimeout(() => {
      acknowledgeAlert(toast.id)
    }, 5000)
    return () => clearTimeout(timer)
  }, [toast.id, acknowledgeAlert])

  const isCritical = toast.severity === 'critical'
  const isWarning = toast.severity === 'warning'
  
  let borderClass = 'border-sky-500/30'
  let bgClass = 'bg-[#0c1e36]/95'
  let icon = <Info className="w-4 h-4 text-sky-400" />
  let label = 'SYSTEM INFO'
  let textClass = 'text-sky-400'

  if (isCritical) {
    borderClass = 'border-rose-500/40 animate-pulse'
    bgClass = 'bg-[#290810]/95'
    icon = <ShieldAlert className="w-4.5 h-4.5 text-rose-400" />
    label = 'CRITICAL ALERT'
    textClass = 'text-rose-400'
  } else if (isWarning) {
    borderClass = 'border-amber-500/30'
    bgClass = 'bg-[#241202]/95'
    icon = <AlertTriangle className="w-4 h-4 text-amber-400" />
    label = 'WARNING DETECTED'
    textClass = 'text-amber-400'
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`
        pointer-events-auto border rounded-xl p-4 shadow-2xl backdrop-blur-xl flex items-start gap-3
        ${borderClass} ${bgClass}
      `}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      
      <div className="flex-1">
        <span className={`text-[8px] font-black tracking-widest block uppercase mb-0.5 ${textClass}`}>
          {label}
        </span>
        <p className="text-[10px] font-bold text-slate-200 leading-normal">
          {toast.message}
        </p>
      </div>

      <button
        onClick={() => acknowledgeAlert(toast.id)}
        className="text-slate-500 hover:text-slate-300 p-0.5 hover:bg-white/5 rounded transition-all shrink-0"
        aria-label="Dismiss Alert"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  )
}

export const ToastProvider: React.FC = () => {
  const alerts = useInfraStore(s => s.alerts)
  const acknowledgeAlert = useInfraStore(s => s.acknowledgeAlert)

  // Display up to 3 latest active, unacknowledged notifications
  const visibleAlerts = React.useMemo(() => {
    return alerts.filter(a => !a.isAcknowledged).slice(0, 3)
  }, [alerts])

  return (
    <div 
      aria-live="polite"
      role="status"
      className="fixed bottom-8 right-8 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {visibleAlerts.map(toast => (
          <ToastItem 
            key={toast.id} 
            toast={toast} 
            acknowledgeAlert={acknowledgeAlert} 
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
