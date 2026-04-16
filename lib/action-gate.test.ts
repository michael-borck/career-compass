import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from './session-store';
import { getActionRequirements, checkGate } from './action-gate';

describe('getActionRequirements', () => {
  it('gaps needs target and profile', () => {
    expect(getActionRequirements('gaps')).toEqual({ needsTarget: true, needsProfile: true });
  });

  it('interview needs target only', () => {
    expect(getActionRequirements('interview')).toEqual({ needsTarget: true, needsProfile: false });
  });

  it('learn needs target only', () => {
    expect(getActionRequirements('learn')).toEqual({ needsTarget: true, needsProfile: false });
  });

  it('board needs profile only', () => {
    expect(getActionRequirements('board')).toEqual({ needsTarget: false, needsProfile: true });
  });

  it('compare needs target only', () => {
    expect(getActionRequirements('compare')).toEqual({ needsTarget: true, needsProfile: false });
  });

  it('careers needs target only', () => {
    expect(getActionRequirements('careers')).toEqual({ needsTarget: true, needsProfile: false });
  });
});

describe('checkGate', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('gaps with nothing returns all missing', () => {
    const result = checkGate('gaps');
    expect(result.canProceed).toBe(false);
    expect(result.missingTarget).toBe(true);
    expect(result.missingProfile).toBe(true);
  });

  it('gaps with jobTitle + resume can proceed', () => {
    useSessionStore.getState().setJobTitle('Data analyst');
    useSessionStore.getState().setResume('Resume text', 'resume.pdf');
    const result = checkGate('gaps');
    expect(result.canProceed).toBe(true);
    expect(result.missingTarget).toBe(false);
    expect(result.missingProfile).toBe(false);
  });

  it('gaps with jobAdvert + freeText can proceed', () => {
    useSessionStore.getState().setJobAdvert('We are hiring...');
    useSessionStore.getState().setFreeText('I am a student...');
    const result = checkGate('gaps');
    expect(result.canProceed).toBe(true);
  });

  it('gaps with distilledProfile as profile source can proceed', () => {
    useSessionStore.getState().setJobTitle('Analyst');
    useSessionStore.getState().setDistilledProfile({
      background: 'bg', interests: [], skills: [], constraints: [], goals: [],
    });
    const result = checkGate('gaps');
    expect(result.canProceed).toBe(true);
    expect(result.missingProfile).toBe(false);
  });

  it('gaps with only jobTitle (no profile) cannot proceed', () => {
    useSessionStore.getState().setJobTitle('Data analyst');
    const result = checkGate('gaps');
    expect(result.canProceed).toBe(false);
    expect(result.missingTarget).toBe(false);
    expect(result.missingProfile).toBe(true);
  });

  it('interview with jobTitle can proceed', () => {
    useSessionStore.getState().setJobTitle('Data analyst');
    expect(checkGate('interview').canProceed).toBe(true);
  });

  it('interview with nothing cannot proceed', () => {
    expect(checkGate('interview').canProceed).toBe(false);
    expect(checkGate('interview').missingTarget).toBe(true);
  });

  it('board with resume can proceed', () => {
    useSessionStore.getState().setResume('text', 'r.pdf');
    expect(checkGate('board').canProceed).toBe(true);
  });

  it('board with nothing cannot proceed', () => {
    expect(checkGate('board').canProceed).toBe(false);
    expect(checkGate('board').missingProfile).toBe(true);
  });

  it('board ignores target requirement', () => {
    useSessionStore.getState().setResume('text', 'r.pdf');
    const result = checkGate('board');
    expect(result.missingTarget).toBe(false);
  });

  it('compare with jobAdvert can proceed', () => {
    useSessionStore.getState().setJobAdvert('Hiring...');
    expect(checkGate('compare').canProceed).toBe(true);
  });
});
