import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed shadow-xs';

  const variants = {
    primary: 'bg-clario-navy text-white hover:bg-clario-navy-light active:bg-clario-navy-dark',
    secondary: 'bg-clario-teal text-white hover:bg-clario-teal-light',
    outline: 'border border-clario-border bg-white text-clario-text hover:bg-clario-ivory hover:border-clario-teal/50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    ghost: 'text-clario-text-secondary hover:text-clario-text hover:bg-clario-ivory shadow-none',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 space-x-1.5',
    md: 'text-sm px-4 py-2 space-x-2',
    lg: 'text-base px-5 py-2.5 space-x-2.5',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      )}
      {children}
    </button>
  );
};
