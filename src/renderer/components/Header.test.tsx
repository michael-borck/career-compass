// @vitest-environment jsdom
//
// Uses a real MemoryRouter (not a mocked useNavigate) because the behaviour
// under test is location-driven: the mobile menu must close when the route
// changes.

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';

beforeEach(() => {
  document.body.classList.remove('overflow-hidden');
});

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Header />
    </MemoryRouter>
  );
}

describe('Header mobile menu', () => {
  it('toggling the menu locks and unlocks body scroll', () => {
    renderHeader();
    const toggle = screen.getByLabelText('Open the menu');
    fireEvent.click(toggle);
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    fireEvent.click(toggle);
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('closes the menu and unlocks scroll when the route changes', () => {
    renderHeader();
    fireEvent.click(screen.getByLabelText('Open the menu'));
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);

    fireEvent.click(screen.getByText('About'));
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('highlights the active route', () => {
    renderHeader();
    const home = screen.getByText('Home');
    const about = screen.getByText('About');
    expect(home.className).toContain('border-accent');
    expect(about.className).not.toContain('border-accent');
  });
});
