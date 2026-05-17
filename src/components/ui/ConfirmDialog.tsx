import { AlertTriangle } from 'lucide-react'
import { Modal, Button } from './base'

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

  // Ensure button variants map cleanly to our Design System Button component
  const buttonVariantMap: Record<string, 'danger' | 'primary' | 'ghost'> = {
    danger: 'danger',
    warning: 'primary',
    info: 'primary'
  }

  const iconStyles = {
    danger: 'text-rose-400',
    warning: 'text-amber-400',
    info: 'text-teal-400'
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      width="sm"
      zIndex="z-[2000]"
      title={title}
      icon={<AlertTriangle className={iconStyles[type]} size={20} />}
    >
      <div className="p-8">
        <p className="text-slate-300 text-sm font-medium leading-relaxed">
          {message}
        </p>
      </div>

      <div className="p-6 bg-slate-800/50 border-t border-white/5 flex gap-3">
        <Button 
          onClick={onCancel}
          variant="ghost"
          className="flex-1 justify-center bg-slate-800 border-white/5 shadow-none"
        >
          {cancelText}
        </Button>
        <Button 
          onClick={onConfirm}
          variant={buttonVariantMap[type]}
          className="flex-1 justify-center shadow-lg"
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  )
}
