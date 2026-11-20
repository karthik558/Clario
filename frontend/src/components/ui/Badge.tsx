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
    sage: 'bg-slate-100 text-slate-700 border border-slate-200',
    teal: 'bg-slate-100 text-slate-800 border border-slate-200',
    gold: 'bg-amber-50 text-amber-800 border border-amber-200',
    navy: 'bg-slate-900 text-white border border-slate-900',
    gray: 'bg-slate-100 text-slate-700 border border-slate-200',
    red: 'bg-rose-50 text-rose-700 border border-rose-200',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 leading-normal',
    md: 'text-xs px-2.5 py-1.5 leading-normal',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
