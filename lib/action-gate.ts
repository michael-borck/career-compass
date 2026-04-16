import { useSessionStore } from './session-store';

export type GatedAction = 'careers' | 'gaps' | 'learn' | 'interview' | 'board' | 'compare';

export type ActionRequirements = {
  needsTarget: boolean;
  needsProfile: boolean;
};

export type GateResult = {
  canProceed: boolean;
  missingTarget: boolean;
  missingProfile: boolean;
};

const REQUIREMENTS: Record<GatedAction, ActionRequirements> = {
  careers: { needsTarget: true, needsProfile: false },
  gaps: { needsTarget: true, needsProfile: true },
  learn: { needsTarget: true, needsProfile: false },
  interview: { needsTarget: true, needsProfile: false },
  board: { needsTarget: false, needsProfile: true },
  compare: { needsTarget: true, needsProfile: false },
};

export function getActionRequirements(action: GatedAction): ActionRequirements {
  return REQUIREMENTS[action];
}

export function checkGate(action: GatedAction): GateResult {
  const reqs = REQUIREMENTS[action];
  const state = useSessionStore.getState();

  const hasTarget =
    !!(state.jobTitle && state.jobTitle.trim()) ||
    !!(state.jobAdvert && state.jobAdvert.trim());

  const hasProfile =
    !!state.resumeText ||
    !!(state.freeText && state.freeText.trim()) ||
    !!state.distilledProfile;

  const missingTarget = reqs.needsTarget && !hasTarget;
  const missingProfile = reqs.needsProfile && !hasProfile;

  return {
    canProceed: !missingTarget && !missingProfile,
    missingTarget,
    missingProfile,
  };
}
