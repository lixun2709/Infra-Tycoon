import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const typeStyles = {
    danger: 'bg-red-500 hover:bg-red-600 shadow-red-500/20 text-white border-red-400',
    warning: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 text-white border-amber-400',
    info: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20 text-white border-blue-400'
  }

  const iconStyles = {
    danger: 'text-red-400 bg-red-400/10 border-red-500/30',
    warning: 'text-amber-400 bg-amber-400/10 border-amber-500/30',
    info: 'text-blue-400 bg-blue-400/10 border-blue-500/30'
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${iconStyles[type]}`}>
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-lg font-black text-white tracking-tight uppercase">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-8">
          <p className="text-slate-300 text-sm font-medium leading-relaxed">
            {message}
          </p>
        </div>

        <div className="p-6 bg-slate-800/50 border-t border-white/5 flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-white/5 text-slate-400 text-xs font-black uppercase hover:bg-slate-700 hover:text-white transition-all"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={`flex-1 px-4 py-3 rounded-xl border text-xs font-black uppercase transition-all shadow-lg ${typeStyles[type]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
