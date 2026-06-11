// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileReviewModal from './ProfileReviewModal';
import type { StudentProfile } from '@/lib/session-store';

function profile(background: string): StudentProfile {
  return { background, interests: [], skills: [], constraints: [], goals: [] };
}

const noop = () => {};
const baseProps = {
  open: true,
  trimmed: false,
  onAccept: noop,
  onRedistill: noop,
  onCancel: noop,
};

const GUIDANCE_PLACEHOLDER = 'e.g., focus on the data analyst thread, ignore teaching';

describe('ProfileReviewModal', () => {
  it('renders nothing when closed or without a profile', () => {
    const { container } = render(
      <ProfileReviewModal {...baseProps} open={false} profile={profile('a')} />
    );
    expect(container.innerHTML).toBe('');
    const { container: noProfile } = render(<ProfileReviewModal {...baseProps} profile={null} />);
    expect(noProfile.innerHTML).toBe('');
  });

  it('resets local edits and guidance when a fresh profile arrives', () => {
    const { rerender } = render(<ProfileReviewModal {...baseProps} profile={profile('first')} />);
    const guidance = screen.getByPlaceholderText(GUIDANCE_PLACEHOLDER) as HTMLInputElement;
    fireEvent.change(guidance, { target: { value: 'tighten it up' } });
    expect(guidance.value).toBe('tighten it up');

    rerender(<ProfileReviewModal {...baseProps} profile={profile('second')} />);
    expect((screen.getByPlaceholderText(GUIDANCE_PLACEHOLDER) as HTMLInputElement).value).toBe('');
  });

  it('accept passes the locally edited profile', () => {
    const onAccept = vi.fn();
    render(<ProfileReviewModal {...baseProps} onAccept={onAccept} profile={profile('keep me')} />);
    fireEvent.click(screen.getByText('Accept & generate'));
    expect(onAccept).toHaveBeenCalledWith(expect.objectContaining({ background: 'keep me' }));
  });

  it('redistill is disabled until guidance is entered, then passes it through', () => {
    const onRedistill = vi.fn();
    render(
      <ProfileReviewModal {...baseProps} onRedistill={onRedistill} profile={profile('x')} />
    );
    const button = screen.getByText('Redistill').closest('button')!;
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(GUIDANCE_PLACEHOLDER), {
      target: { value: 'focus on data' },
    });
    fireEvent.click(button);
    expect(onRedistill).toHaveBeenCalledWith('focus on data');
  });
});
