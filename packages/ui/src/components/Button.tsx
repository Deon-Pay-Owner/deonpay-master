import React from 'react';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const baseStyles = 'font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-[var(--color-primary)] hover:bg-[var(--color-primaryHover)] text-white shadow-sm hover:shadow-md',
    outline: 'border-2 border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-textPrimary)]',
    ghost: 'text-[var(--color-textSecondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface)]',
    danger: 'bg-[var(--color-danger)] hover:bg-red-600 text-white shadow-sm hover:shadow-md',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2 text-base rounded-xl',
    lg: 'px-6 py-3 text-lg rounded-xl',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
