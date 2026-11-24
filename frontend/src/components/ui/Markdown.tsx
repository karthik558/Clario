import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({ children, className, invert }: { children: string; className?: string; invert?: boolean }) {
  return <div className={`document-prose ${invert ? 'document-prose-invert' : ''} ${className || ''}`}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    img: ({ alt }) => <span>{alt}</span>,
    table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
  }}>{children}</ReactMarkdown></div>;
}
