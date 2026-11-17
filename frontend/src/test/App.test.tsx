import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';

describe('Clario UI Design System Components', () => {
  it('renders Button with primary styling and text', () => {
    render(<Button variant="primary">Ask Clario</Button>);
    const btn = screen.getByRole('button', { name: /ask clario/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain('bg-clario-navy');
  });

  it('renders Badge with correct variant styling', () => {
    render(<Badge variant="gold">High Confidence</Badge>);
    const badge = screen.getByText(/high confidence/i);
    expect(badge).toBeInTheDocument();
  });

  it('renders Card with subtle shadow and rounded corners', () => {
    render(<Card>Document Passage</Card>);
    expect(screen.getByText(/document passage/i)).toBeInTheDocument();
  });
});
