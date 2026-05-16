import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
    <button 
      className={`${variantClass} ${className} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
      {isLoading && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ml-2" />
      )}
    </button>
  )
}
