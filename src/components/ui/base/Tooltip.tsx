import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement<{
    'aria-describedby'?: string
    tabIndex?: number
    onMouseEnter?: React.MouseEventHandler<any>
    onMouseLeave?: React.MouseEventHandler<any>
    onFocus?: React.FocusEventHandler<any>
    onBlur?: React.FocusEventHandler<any>
    onKeyDown?: React.KeyboardEventHandler<any>
  }>
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipId = React.useId()

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsVisible(false)
  }

  // Keyboard Event Handlers
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideTooltip()
    }
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  }[position]

  // Clone child to apply ARIA properties and event listeners dynamically
  const trigger = React.cloneElement(children, {
    'aria-describedby': tooltipId,
    tabIndex: children.props.tabIndex ?? 0,
    onMouseEnter: showTooltip,
    onMouseLeave: hideTooltip,
    onFocus: showTooltip,
    onBlur: hideTooltip,
    onKeyDown: handleKeyDown
  })

  return (
    <div className="relative inline-block w-max">
      {trigger}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            id={tooltipId}
            role="tooltip"
            aria-hidden={!isVisible}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`
              absolute z-[9999] pointer-events-none px-3 py-1.5 
              bg-[#0b132b]/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl
              text-[9px] font-bold text-slate-200 uppercase tracking-wider leading-relaxed max-w-xs w-max
              ${positionClasses}
            `}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
