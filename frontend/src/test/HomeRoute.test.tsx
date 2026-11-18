import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { App } from '../App';

it('opens the landing page directly and enters the workspace', () => {
  window.history.replaceState(null, '', '/home');
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('down to the clause');
  fireEvent.click(screen.getByRole('link', { name: 'Open workspace' }));
  expect(window.location.pathname).toBe('/');
  expect(screen.getByRole('link', { name: 'About Clario' }).getAttribute('href')).toBe('/home');
});
