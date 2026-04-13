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
    expect(s.interviewMessages).toEqual([]);
    expect(s.interviewTarget).toBeNull();
    expect(s.interviewDifficulty).toBe('standard');
    expect(s.interviewPhase).toBeNull();
    expect(s.interviewTurnInPhase).toBe(0);
    expect(s.interviewFeedback).toBeNull();
    expect(s.urlInput).toBe('');
    expect(s.urlFetchedTitle).toBeNull();
    expect(s.gapAnalysisSources).toBeNull();
    expect(s.learningPathSources).toBeNull();
    expect(s.interviewSources).toEqual([]);
    expect(s.chatSources).toEqual({});
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
    s.setInterviewSession('Z', 'friendly');
    s.addInterviewMessage({ role: 'user', content: 'm' });
    s.setInterviewFeedback({
      target: 'Z', difficulty: 'friendly',
      summary: 's', strengths: [], improvements: [],
      perPhase: [], overallRating: 'developing', nextSteps: [],
    });
    s.setUrlInput('http://x');
    s.setUrlFetchedTitle('T');
    s.setGapAnalysisSources([{ title: 'A', url: 'u', domain: 'd' }]);
    s.setLearningPathSources([{ title: 'A', url: 'u', domain: 'd' }]);
    s.addInterviewSources([{ title: 'A', url: 'u2', domain: 'd' }]);
    s.setChatSourcesForMessage('m', [{ title: 'A', url: 'u3', domain: 'd' }]);
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
    expect(after.interviewMessages).toEqual([]);
    expect(after.interviewTarget).toBeNull();
    expect(after.interviewDifficulty).toBe('standard');
    expect(after.interviewPhase).toBeNull();
    expect(after.interviewTurnInPhase).toBe(0);
    expect(after.interviewFeedback).toBeNull();
    expect(after.urlInput).toBe('');
    expect(after.urlFetchedTitle).toBeNull();
    expect(after.gapAnalysisSources).toBeNull();
    expect(after.learningPathSources).toBeNull();
    expect(after.interviewSources).toEqual([]);
    expect(after.chatSources).toEqual({});
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

  it('setInterviewSession primes a fresh interview', () => {
    const s = useSessionStore.getState();
    s.addInterviewMessage({ role: 'user', content: 'old message' });
    s.setInterviewSession('Data Analyst', 'tough');
    const after = useSessionStore.getState();
    expect(after.interviewTarget).toBe('Data Analyst');
    expect(after.interviewDifficulty).toBe('tough');
    expect(after.interviewMessages).toEqual([]);
    expect(after.interviewPhase).toBe('warm-up');
    expect(after.interviewTurnInPhase).toBe(0);
    expect(after.interviewFeedback).toBeNull();
  });

  it('addInterviewMessage appends with auto id/timestamp/kind', () => {
    useSessionStore.getState().addInterviewMessage({
      role: 'assistant',
      content: 'first question',
    });
    const msgs = useSessionStore.getState().interviewMessages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('assistant');
    expect(msgs[0].content).toBe('first question');
    expect(msgs[0].id).toBeTruthy();
    expect(msgs[0].kind).toBe('message');
    expect(typeof msgs[0].timestamp).toBe('number');
  });

  it('advanceInterviewPhase updates phase and turn counter', () => {
    useSessionStore.getState().advanceInterviewPhase('behavioural', 0);
    const s = useSessionStore.getState();
    expect(s.interviewPhase).toBe('behavioural');
    expect(s.interviewTurnInPhase).toBe(0);
  });

  it('setInterviewFeedback writes the field', () => {
    const fb = {
      target: 'Data Analyst',
      difficulty: 'standard' as const,
      summary: 's',
      strengths: ['a'],
      improvements: [{ area: 'x', why: 'y', example: 'z' }],
      perPhase: [],
      overallRating: 'on-track' as const,
      nextSteps: ['n'],
    };
    useSessionStore.getState().setInterviewFeedback(fb);
    expect(useSessionStore.getState().interviewFeedback).toEqual(fb);
  });

  it('resetInterview clears interview state but not other state', () => {
    const s = useSessionStore.getState();
    s.setResume('a', 'b');
    s.setInterviewSession('X', 'tough');
    s.addInterviewMessage({ role: 'user', content: 'c' });
    s.resetInterview();
    const after = useSessionStore.getState();
    expect(after.resumeText).toBe('a'); // preserved
    expect(after.interviewTarget).toBeNull();
    expect(after.interviewMessages).toEqual([]);
    expect(after.interviewDifficulty).toBe('standard');
    expect(after.interviewPhase).toBeNull();
  });

  it('setUrlInput and setUrlFetchedTitle write fields', () => {
    const s = useSessionStore.getState();
    s.setUrlInput('https://example.com/job');
    s.setUrlFetchedTitle('Data Analyst — Example');
    const after = useSessionStore.getState();
    expect(after.urlInput).toBe('https://example.com/job');
    expect(after.urlFetchedTitle).toBe('Data Analyst — Example');
  });

  it('setGapAnalysisSources writes the field', () => {
    useSessionStore.getState().setGapAnalysisSources([
      { title: 'Glassdoor', url: 'https://glassdoor.com/x', domain: 'glassdoor.com' },
    ]);
    expect(useSessionStore.getState().gapAnalysisSources).toHaveLength(1);
  });

  it('addInterviewSources dedupes by URL', () => {
    const s = useSessionStore.getState();
    s.addInterviewSources([
      { title: 'A', url: 'https://a.com', domain: 'a.com' },
      { title: 'B', url: 'https://b.com', domain: 'b.com' },
    ]);
    s.addInterviewSources([
      { title: 'A duplicate', url: 'https://a.com', domain: 'a.com' },
      { title: 'C', url: 'https://c.com', domain: 'c.com' },
    ]);
    const sources = useSessionStore.getState().interviewSources;
    expect(sources).toHaveLength(3);
    expect(sources.map((x) => x.url)).toEqual([
      'https://a.com',
      'https://b.com',
      'https://c.com',
    ]);
  });

  it('setChatSourcesForMessage stores sources under the message id', () => {
    useSessionStore.getState().setChatSourcesForMessage('msg-1', [
      { title: 'A', url: 'https://a.com', domain: 'a.com' },
    ]);
    useSessionStore.getState().setChatSourcesForMessage('msg-2', [
      { title: 'B', url: 'https://b.com', domain: 'b.com' },
    ]);
    const cs = useSessionStore.getState().chatSources;
    expect(cs['msg-1']).toHaveLength(1);
    expect(cs['msg-2']).toHaveLength(1);
  });

  it('resetInterview clears interviewSources', () => {
    const s = useSessionStore.getState();
    s.addInterviewSources([{ title: 'A', url: 'https://a.com', domain: 'a.com' }]);
    s.resetInterview();
    expect(useSessionStore.getState().interviewSources).toEqual([]);
  });
});
