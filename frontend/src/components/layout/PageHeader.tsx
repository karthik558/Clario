import React from 'react';

export function PageHeader({ title, description, children }: React.PropsWithChildren<{ title: string; description: string }>) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </header>
  );
}
