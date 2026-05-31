import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "variant"> {
  variant?: 'primary' | 'ghost' | 'danger'
  icon?: React.ReactNode
  isLoading?: boolean
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  icon, 
  isLoading, 
  className = '', 
  ...props 
}) => {
  const variantClass = {
    primary: 'btn-primary',
    ghost: 'btn-ghost',
    danger: 'btn-danger'
  }[variant]

  return (
    <motion.button 
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`${variantClass} ${className} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
      {isLoading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ml-2" />
      )}
    </motion.button>
  )
}
