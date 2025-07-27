import React, { ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  fullWidth?: boolean;
  isActive?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth = false,
  isActive = false,
  className,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 ease-in-out rounded-full focus:outline-none';
  
  const variantClasses = {
    primary: 'bg-v1z3r-primary text-black hover:bg-opacity-80',
    secondary: 'bg-v1z3r-secondary text-white hover:bg-opacity-80',
    outline: 'border border-v1z3r-primary text-v1z3r-primary hover:bg-v1z3r-primary hover:bg-opacity-10',
    ghost: 'text-v1z3r-light hover:bg-v1z3r-primary hover:bg-opacity-10'
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };
  
  
  const buttonClasses = clsx(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    {
      'ring-2 ring-v1z3r-primary ring-opacity-50': isActive,
      'w-full': fullWidth,
    },
    className
  );
  
  return (
    <button
      className={buttonClasses}
      {...props}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};

// Default export for backward compatibility
export default Button;