import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverEffect = false,
  ...props
}) => {
  const hasBg = className.includes('bg-');
  const hasBorder = className.includes('border');
  return (
    <div
      onClick={onClick}
      {...props}
      className={`${hasBg ? '' : 'bg-white'} rounded-md ${
        hasBorder ? '' : 'border border-clario-border'
      } p-5 shadow-subtle ${
        hoverEffect ? 'hover:border-slate-300 hover:shadow-card transition-all cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
