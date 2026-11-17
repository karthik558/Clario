import React from 'react';

interface CardProps {
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
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-md border border-clario-border p-5 shadow-subtle ${
        hoverEffect ? 'hover:border-clario-teal/40 hover:shadow-card transition-all cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
