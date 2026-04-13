import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from './session-store';

describe('session store', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('has empty initial state', () => {
    const s = useSessionStore.getState();
    expect(s.resumeText).toBeNull();
    expect(s.resumeFilename).toBeNull();
    expect(s.freeText).toBe('');
    expect(s.jobTitle).toBe('');
    expect(s.jobAdvert).toBe('');
    expect(s.chatMessages).toEqual([]);
    expect(s.currentFocus).toBeNull();
    expect(s.distilledProfile).toBeNull();
    expect(s.careers).toBeNull();
    expect(s.selectedCareerId).toBeNull();
    expect(s.gapAnalysis).toBeNull();
    expect(s.learningPath).toBeNull();
  });
});

describe('session store actions', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('setResume writes text and filename', () => {
    useSessionStore.getState().setResume('my resume', 'cv.pdf');
    const s = useSessionStore.getState();
    expect(s.resumeText).toBe('my resume');
    expect(s.resumeFilename).toBe('cv.pdf');
  });

  it('clearResume nulls text and filename', () => {
    useSessionStore.getState().setResume('x', 'y.pdf');
    useSessionStore.getState().clearResume();
    const s = useSessionStore.getState();
    expect(s.resumeText).toBeNull();
    expect(s.resumeFilename).toBeNull();
  });

  it('addChatMessage appends with auto id/timestamp/kind', () => {
    useSessionStore.getState().addChatMessage({
      role: 'user',
      content: 'hello',
    });
    const msgs = useSessionStore.getState().chatMessages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe('hello');
    expect(msgs[0].id).toBeTruthy();
    expect(msgs[0].kind).toBe('message');
    expect(typeof msgs[0].timestamp).toBe('number');
  });

  it('addChatMessage respects explicit kind', () => {
    useSessionStore.getState().addChatMessage({
      role: 'system',
      content: '— Now focused on Data Analyst —',
      kind: 'focus-marker',
    });
    expect(useSessionStore.getState().chatMessages[0].kind).toBe('focus-marker');
  });

  it('setFocus updates currentFocus', () => {
    useSessionStore.getState().setFocus('Data Analyst');
    expect(useSessionStore.getState().currentFocus).toBe('Data Analyst');
    useSessionStore.getState().setFocus(null);
    expect(useSessionStore.getState().currentFocus).toBeNull();
  });

  it('reset clears everything', () => {
    const s = useSessionStore.getState();
    s.setResume('a', 'b');
    s.setFreeText('c');
    s.setJobTitle('d');
    s.setJobAdvert('e');
    s.addChatMessage({ role: 'user', content: 'f' });
    s.setFocus('g');
    s.setDistilledProfile({
      background: 'h', interests: [], skills: [], constraints: [], goals: [],
    });
    s.setGapAnalysis({
      target: 'X', summary: 'Y', matches: [], gaps: [{
        title: 't', category: 'technical', severity: 'critical',
        why: 'w', targetLevel: 'tl', currentLevel: null, evidenceIdeas: ['e'],
      }], realisticTimeline: 'Z',
    });
    s.setLearningPath({
      target: 'X', summary: 'Y', prerequisites: [], milestones: [{
        weekRange: 'W1', focus: 'f', activities: ['a'], outcome: 'o',
      }],
      portfolioProject: 'P', totalDuration: 'D', caveats: [],
    });
    s.reset();
    const after = useSessionStore.getState();
    expect(after.resumeText).toBeNull();
    expect(after.freeText).toBe('');
    expect(after.jobTitle).toBe('');
    expect(after.jobAdvert).toBe('');
    expect(after.chatMessages).toEqual([]);
    expect(after.currentFocus).toBeNull();
    expect(after.distilledProfile).toBeNull();
    expect(after.gapAnalysis).toBeNull();
    expect(after.learningPath).toBeNull();
  });

  it('setJobAdvert writes the field', () => {
    useSessionStore.getState().setJobAdvert('a posting');
    expect(useSessionStore.getState().jobAdvert).toBe('a posting');
  });

  it('setGapAnalysis writes the field', () => {
    const g = {
      target: 'Data Analyst',
      summary: 's',
      matches: ['m'],
      gaps: [{
        title: 'SQL', category: 'technical' as const, severity: 'critical' as const,
        why: 'w', targetLevel: 't', currentLevel: null, evidenceIdeas: ['e'],
      }],
      realisticTimeline: '3 months',
    };
    useSessionStore.getState().setGapAnalysis(g);
    expect(useSessionStore.getState().gapAnalysis).toEqual(g);
  });

  it('setLearningPath writes the field', () => {
    const l = {
      target: 'Data Analyst',
      summary: 's',
      prerequisites: ['p'],
      milestones: [{ weekRange: 'W1-2', focus: 'f', activities: ['a'], outcome: 'o' }],
      portfolioProject: 'pp',
      totalDuration: '12 weeks',
      caveats: ['c'],
    };
    useSessionStore.getState().setLearningPath(l);
    expect(useSessionStore.getState().learningPath).toEqual(l);
  });
});
