import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, beforeEach } from 'vitest';
import { App } from '../App';

beforeEach(() => {
  sessionStorage.clear();
});

it('opens the landing page directly and enters the workspace', () => {
  window.history.replaceState(null, '', '/home');
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('down to the clause');
  fireEvent.click(screen.getByRole('link', { name: 'Open workspace' }));
  expect(window.location.pathname).toBe('/');
  expect(screen.getByRole('link', { name: 'About Clario' }).getAttribute('href')).toBe('/home');
});

it('redirects from root / to /home when workspace has not been entered yet', () => {
  window.history.replaceState(null, '', '/');
  render(<App />);
  expect(window.location.pathname).toBe('/home');
  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('down to the clause');
});

it('stays on root / when workspace was previously entered', () => {
  sessionStorage.setItem('clario_workspace_entered', 'true');
  window.history.replaceState(null, '', '/');
  render(<App />);
  expect(window.location.pathname).toBe('/');
  expect(screen.getByRole('link', { name: 'About Clario' })).toBeInTheDocument();
});

it('renders legal policy pages in website layout', () => {
  window.history.replaceState(null, '', '/terms');
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Terms of Service');
  expect(screen.getByText('Permitted Document Processing')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Workspace' })).toBeInTheDocument();
});

it('redirects /docs to /documents and renders redesigned document library', async () => {
  sessionStorage.setItem('clario_workspace_entered', 'true');
  window.history.replaceState(null, '', '/docs');
  render(<App />);
  expect(window.location.pathname).toBe('/documents');
  expect(await screen.findByRole('heading', { level: 1, name: 'Document library' })).toBeInTheDocument();
  expect(screen.getByText('Total Documents')).toBeInTheDocument();
  expect(screen.getByText('Indexed Passages')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Upload Documents/i })).toBeInTheDocument();
});

it('renders redesigned homepage with interactive contract review and sample breakdown', () => {
  window.history.replaceState(null, '', '/home');
  render(<App />);

  // Verify headers and key titles
  expect(screen.getByText('Why Clario, and how teams use it')).toBeInTheDocument();
  expect(screen.getByText('Sample document breakdown')).toBeInTheDocument();

  // Test interactive hero contract review
  expect(screen.getByText('When do we need to give notice?')).toBeInTheDocument();

  const liabilityBtn = screen.getByRole('button', { name: 'Liability cap' });
  fireEvent.click(liabilityBtn);
  expect(screen.getByText('What is the liability cap?')).toBeInTheDocument();
  expect(screen.getByText(/capped at twelve months of fees/i)).toBeInTheDocument();

  const incidentBtn = screen.getByRole('button', { name: 'Incident notice' });
  fireEvent.click(incidentBtn);
  expect(screen.getByText('What is the breach notification window?')).toBeInTheDocument();
  expect(screen.getAllByText(/within 48 hours of confirmation/i)[0]).toBeInTheDocument();
});
