import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'sage' | 'teal' | 'gold' | 'navy' | 'gray' | 'red';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'sage',
  size = 'md',
  className = '',
}) => {
  const variantStyles = {
    sage: 'bg-clario-sage-light/70 text-clario-navy border border-clario-sage',
    teal: 'bg-clario-teal/10 text-clario-teal border border-clario-teal/30',
    gold: 'bg-clario-gold-light/60 text-clario-gold-dark border border-clario-gold/40',
    navy: 'bg-clario-navy text-white border border-clario-navy',
    gray: 'bg-clario-ivory text-clario-text-secondary border border-clario-border',
    red: 'bg-rose-50 text-rose-700 border border-rose-200',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
