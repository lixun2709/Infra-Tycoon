import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  headerExtra?: React.ReactNode
  hideHeader?: boolean
  zIndex?: string
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  icon, 
  children, 
  className = '', 
  width = 'md',
  headerExtra,
  hideHeader = false,
  zIndex = 'z-[1000]'
}) => {
  const widthClass = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-5xl',
    xl: 'max-w-7xl',
    full: 'max-w-[95vw]'
  }[width]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`fixed inset-0 ${zIndex} flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md`}
          onClick={onClose}
        >
          <motion.div 
            className={`w-full ${widthClass} glass-dark border border-white/10 rounded-3xl shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh] ${className}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            {!hideHeader && (
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900/20 shrink-0">
                <div className="flex items-center gap-4">
                  {icon && (
                    <div className="p-3 bg-teal-500/10 rounded-xl border border-teal-500/20 text-teal-400">
                      {icon}
                    </div>
                  )}
                  {title && (
                    <h1 className="text-xl font-black text-white uppercase tracking-tighter">{title}</h1>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {headerExtra}
                  <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
            
            {/* Body */}
            <div className="flex-1 overflow-hidden flex flex-col relative">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
