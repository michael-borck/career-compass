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

describe('odyssey lives', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('initialises three empty life slots keyed by type', () => {
    const { odysseyLives } = useSessionStore.getState();
    expect(Object.keys(odysseyLives).sort()).toEqual(['current', 'pivot', 'wildcard']);
    for (const type of ['current', 'pivot', 'wildcard'] as const) {
      const life = odysseyLives[type];
      expect(life.type).toBe(type);
      expect(life.label).toBe('');
      expect(life.seed).toBe('');
      expect(life.headline).toBeNull();
      expect(life.dayInTheLife).toBeNull();
      expect(life.typicalWeek).toEqual([]);
      expect(life.toolsAndSkills).toEqual([]);
      expect(life.whoYouWorkWith).toBeNull();
      expect(life.challenges).toEqual([]);
      expect(life.questionsToExplore).toEqual([]);
      expect(life.dashboard).toEqual({
        resources: null,
        likability: null,
        confidence: null,
        coherence: null,
      });
    }
  });

  it('setOdysseySeed writes label and seed for a specific slot', () => {
    useSessionStore.getState().setOdysseySeed('pivot', 'Teacher', 'I become a high school teacher.');
    const life = useSessionStore.getState().odysseyLives.pivot;
    expect(life.label).toBe('Teacher');
    expect(life.seed).toBe('I become a high school teacher.');
    expect(useSessionStore.getState().odysseyLives.current.label).toBe('');
  });

  it('setOdysseyElaboration merges partial elaboration fields', () => {
    useSessionStore.getState().setOdysseyElaboration('wildcard', {
      headline: 'Living off-grid building furniture',
      dayInTheLife: 'Wake at 6, work in the shed until lunch...',
      typicalWeek: ['3 days in the workshop', '2 days delivering orders'],
      toolsAndSkills: ['hand tools', 'CAD basics'],
      whoYouWorkWith: 'Mostly solo, occasional clients.',
      challenges: ['Unstable income'],
      questionsToExplore: ['Where would I live?'],
    });
    const life = useSessionStore.getState().odysseyLives.wildcard;
    expect(life.headline).toBe('Living off-grid building furniture');
    expect(life.typicalWeek).toHaveLength(2);
    expect(life.challenges).toEqual(['Unstable income']);
  });

  it('setOdysseyDashboard sets and clears ratings', () => {
    useSessionStore.getState().setOdysseyDashboard('current', 'resources', 4);
    expect(useSessionStore.getState().odysseyLives.current.dashboard.resources).toBe(4);
    useSessionStore.getState().setOdysseyDashboard('current', 'resources', null);
    expect(useSessionStore.getState().odysseyLives.current.dashboard.resources).toBeNull();
  });

  it('resetOdysseyLife clears one slot without touching others', () => {
    useSessionStore.getState().setOdysseySeed('current', 'A', 'a');
    useSessionStore.getState().setOdysseySeed('pivot', 'B', 'b');
    useSessionStore.getState().resetOdysseyLife('current');
    expect(useSessionStore.getState().odysseyLives.current.label).toBe('');
    expect(useSessionStore.getState().odysseyLives.pivot.label).toBe('B');
  });

  it('reset() clears all three odyssey slots', () => {
    useSessionStore.getState().setOdysseySeed('current', 'A', 'a');
    useSessionStore.getState().setOdysseyDashboard('current', 'confidence', 5);
    useSessionStore.getState().reset();
    const { odysseyLives } = useSessionStore.getState();
    expect(odysseyLives.current.label).toBe('');
    expect(odysseyLives.current.dashboard.confidence).toBeNull();
  });
});

describe('board review', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('boardReview and boardPrefill initialise null', () => {
    expect(useSessionStore.getState().boardReview).toBeNull();
    expect(useSessionStore.getState().boardPrefill).toBeNull();
  });

  it('setBoardReview writes and clears', () => {
    const review = {
      framing: 'I want to know if my profile reads industry-ready.',
      focusRole: 'Data analyst',
      voices: [
        { role: 'recruiter' as const, name: 'The Recruiter', response: 'r' },
        { role: 'hr' as const, name: 'The HR Partner', response: 'h' },
        { role: 'manager' as const, name: 'The Hiring Manager', response: 'm' },
        { role: 'mentor' as const, name: 'The Mentor', response: 'me' },
      ],
      synthesis: {
        agreements: ['a1'],
        disagreements: ['d1'],
        topPriorities: ['p1', 'p2'],
      },
    };
    useSessionStore.getState().setBoardReview(review);
    expect(useSessionStore.getState().boardReview).toEqual(review);
    useSessionStore.getState().setBoardReview(null);
    expect(useSessionStore.getState().boardReview).toBeNull();
  });

  it('setBoardPrefill writes', () => {
    useSessionStore.getState().setBoardPrefill({ framing: 'F', focusRole: 'R' });
    expect(useSessionStore.getState().boardPrefill).toEqual({ framing: 'F', focusRole: 'R' });
  });

  it('consumeBoardPrefill reads and clears atomically', () => {
    useSessionStore.getState().setBoardPrefill({ framing: 'Read me' });
    const first = useSessionStore.getState().consumeBoardPrefill();
    expect(first).toEqual({ framing: 'Read me' });
    const second = useSessionStore.getState().consumeBoardPrefill();
    expect(second).toBeNull();
    expect(useSessionStore.getState().boardPrefill).toBeNull();
  });

  it('consumeBoardPrefill returns null when nothing set', () => {
    expect(useSessionStore.getState().consumeBoardPrefill()).toBeNull();
  });

  it('reset() clears boardReview and boardPrefill', () => {
    useSessionStore.getState().setBoardReview({
      framing: 'x',
      focusRole: null,
      voices: [
        { role: 'recruiter', name: 'The Recruiter', response: 'r' },
        { role: 'hr', name: 'The HR Partner', response: 'h' },
        { role: 'manager', name: 'The Hiring Manager', response: 'm' },
        { role: 'mentor', name: 'The Mentor', response: 'me' },
      ],
      synthesis: { agreements: ['a'], disagreements: [], topPriorities: [] },
    });
    useSessionStore.getState().setBoardPrefill({ framing: 'F' });
    useSessionStore.getState().reset();
    expect(useSessionStore.getState().boardReview).toBeNull();
    expect(useSessionStore.getState().boardPrefill).toBeNull();
  });
});

describe('comparison', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('comparison, comparePrefill, and comparing initialise', () => {
    const s = useSessionStore.getState();
    expect(s.comparison).toBeNull();
    expect(s.comparePrefill).toBeNull();
    expect(s.comparing).toEqual([]);
  });

  it('setComparison writes and clears', () => {
    const comparison = {
      mode: 'quick' as const,
      roles: [
        {
          label: 'Data analyst',
          cells: {
            typicalDay: 'a', coreSkills: 'b', trainingNeeded: 'c',
            salaryRange: 'd', workSetting: 'e', whoItSuits: 'f', mainChallenge: 'g',
          },
        },
        {
          label: 'UX researcher',
          cells: {
            typicalDay: 'h', coreSkills: 'i', trainingNeeded: 'j',
            salaryRange: 'k', workSetting: 'l', whoItSuits: 'm', mainChallenge: 'n',
          },
        },
      ],
    };
    useSessionStore.getState().setComparison(comparison);
    expect(useSessionStore.getState().comparison).toEqual(comparison);
    useSessionStore.getState().setComparison(null);
    expect(useSessionStore.getState().comparison).toBeNull();
  });

  it('setComparePrefill and consumeComparePrefill are atomic', () => {
    useSessionStore.getState().setComparePrefill({ seedTarget: 'Data analyst' });
    const first = useSessionStore.getState().consumeComparePrefill();
    expect(first).toEqual({ seedTarget: 'Data analyst' });
    expect(useSessionStore.getState().consumeComparePrefill()).toBeNull();
    expect(useSessionStore.getState().comparePrefill).toBeNull();
  });

  it('toggleComparing adds a title when absent', () => {
    useSessionStore.getState().toggleComparing('Data analyst');
    expect(useSessionStore.getState().comparing).toEqual(['Data analyst']);
  });

  it('toggleComparing removes a title when present', () => {
    useSessionStore.getState().toggleComparing('Data analyst');
    useSessionStore.getState().toggleComparing('UX researcher');
    useSessionStore.getState().toggleComparing('Data analyst');
    expect(useSessionStore.getState().comparing).toEqual(['UX researcher']);
  });

  it('toggleComparing silently no-ops when already at 3', () => {
    useSessionStore.getState().toggleComparing('A');
    useSessionStore.getState().toggleComparing('B');
    useSessionStore.getState().toggleComparing('C');
    useSessionStore.getState().toggleComparing('D');
    expect(useSessionStore.getState().comparing).toEqual(['A', 'B', 'C']);
  });

  it('clearComparing empties the list', () => {
    useSessionStore.getState().toggleComparing('A');
    useSessionStore.getState().toggleComparing('B');
    useSessionStore.getState().clearComparing();
    expect(useSessionStore.getState().comparing).toEqual([]);
  });

  it('reset() clears comparison, comparePrefill, and comparing', () => {
    useSessionStore.getState().setComparison({
      mode: 'quick',
      roles: [
        { label: 'A', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x', mainChallenge: 'x' } },
        { label: 'B', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x', mainChallenge: 'x' } },
      ],
    });
    useSessionStore.getState().setComparePrefill({ seedTarget: 'X' });
    useSessionStore.getState().toggleComparing('A');
    useSessionStore.getState().reset();
    const s = useSessionStore.getState();
    expect(s.comparison).toBeNull();
    expect(s.comparePrefill).toBeNull();
    expect(s.comparing).toEqual([]);
  });
});

describe('resetOutputs', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('preserves input fields', () => {
    useSessionStore.getState().setResume('resume text', 'resume.pdf');
    useSessionStore.getState().setFreeText('I am a student');
    useSessionStore.getState().setJobTitle('Data analyst');
    useSessionStore.getState().setJobAdvert('We are hiring...');
    useSessionStore.getState().setUrlInput('https://example.com');
    useSessionStore.getState().setUrlFetchedTitle('Example');

    useSessionStore.getState().resetOutputs();

    const s = useSessionStore.getState();
    expect(s.resumeText).toBe('resume text');
    expect(s.resumeFilename).toBe('resume.pdf');
    expect(s.freeText).toBe('I am a student');
    expect(s.jobTitle).toBe('Data analyst');
    expect(s.jobAdvert).toBe('We are hiring...');
    expect(s.urlInput).toBe('https://example.com');
    expect(s.urlFetchedTitle).toBe('Example');
  });

  it('clears all output fields', () => {
    useSessionStore.getState().setJobTitle('Analyst');
    useSessionStore.getState().setCareers([{
      jobTitle: 'Test', jobDescription: 'd', timeline: 't', salary: 's',
      difficulty: 'd', workRequired: 'w', aboutTheRole: 'a',
      whyItsagoodfit: [], roadmap: [],
    }]);
    useSessionStore.getState().addChatMessage({ role: 'user', content: 'hi' });
    useSessionStore.getState().setGapAnalysis({
      target: 't', summary: 's', matches: [], gaps: [], realisticTimeline: 'r',
    });
    useSessionStore.getState().setLearningPath({
      target: 't', summary: 's', prerequisites: [], milestones: [],
      portfolioProject: '', totalDuration: '', caveats: [],
    });
    useSessionStore.getState().setInterviewFeedback({
      target: 't', difficulty: 'standard', summary: 's', strengths: [],
      improvements: [], perPhase: [], overallRating: 'on-track', nextSteps: [],
    });
    useSessionStore.getState().setBoardReview({
      framing: 'f', focusRole: null,
      voices: [
        { role: 'recruiter', name: 'R', response: 'r' },
        { role: 'hr', name: 'H', response: 'h' },
        { role: 'manager', name: 'M', response: 'm' },
        { role: 'mentor', name: 'Me', response: 'me' },
      ],
      synthesis: { agreements: ['a'], disagreements: [], topPriorities: [] },
    });
    useSessionStore.getState().setComparison({
      mode: 'quick',
      roles: [
        { label: 'A', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x', mainChallenge: 'x' } },
        { label: 'B', cells: { typicalDay: 'x', coreSkills: 'x', trainingNeeded: 'x', salaryRange: 'x', workSetting: 'x', whoItSuits: 'x', mainChallenge: 'x' } },
      ],
    });
    useSessionStore.getState().setOdysseySeed('current', 'L', 'seed');
    useSessionStore.getState().setDistilledProfile({
      background: 'b', interests: [], skills: [], constraints: [], goals: [],
    });
    useSessionStore.getState().toggleComparing('A');
    useSessionStore.getState().setBoardPrefill({ framing: 'f' });
    useSessionStore.getState().setComparePrefill({ seedTarget: 's' });

    useSessionStore.getState().resetOutputs();

    const s = useSessionStore.getState();
    expect(s.careers).toBeNull();
    expect(s.chatMessages).toEqual([]);
    expect(s.currentFocus).toBeNull();
    expect(s.distilledProfile).toBeNull();
    expect(s.selectedCareerId).toBeNull();
    expect(s.gapAnalysis).toBeNull();
    expect(s.learningPath).toBeNull();
    expect(s.interviewMessages).toEqual([]);
    expect(s.interviewTarget).toBeNull();
    expect(s.interviewPhase).toBeNull();
    expect(s.interviewFeedback).toBeNull();
    expect(s.boardReview).toBeNull();
    expect(s.boardPrefill).toBeNull();
    expect(s.comparison).toBeNull();
    expect(s.comparePrefill).toBeNull();
    expect(s.comparing).toEqual([]);
    expect(s.odysseyLives.current.label).toBe('');
    expect(s.odysseyLives.current.seed).toBe('');
    expect(s.gapAnalysisSources).toBeNull();
    expect(s.learningPathSources).toBeNull();
    expect(s.interviewSources).toEqual([]);
    expect(s.chatSources).toEqual({});
  });
});

describe('career materials', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('elevatorPitch, coverLetter, resumeReview initialise null', () => {
    const s = useSessionStore.getState();
    expect(s.elevatorPitch).toBeNull();
    expect(s.coverLetter).toBeNull();
    expect(s.resumeReview).toBeNull();
  });

  it('setElevatorPitch writes and clears', () => {
    const pitch = { target: 'Data analyst', hook: 'h', body: 'b', close: 'c', fullScript: 'h b c' };
    useSessionStore.getState().setElevatorPitch(pitch);
    expect(useSessionStore.getState().elevatorPitch).toEqual(pitch);
    useSessionStore.getState().setElevatorPitch(null);
    expect(useSessionStore.getState().elevatorPitch).toBeNull();
  });

  it('setCoverLetter writes and clears', () => {
    const letter = { target: 'Analyst', greeting: 'Dear Hiring Manager,', body: 'I am writing...', closing: 'Sincerely, Student' };
    useSessionStore.getState().setCoverLetter(letter);
    expect(useSessionStore.getState().coverLetter).toEqual(letter);
    useSessionStore.getState().setCoverLetter(null);
    expect(useSessionStore.getState().coverLetter).toBeNull();
  });

  it('setResumeReview writes and clears', () => {
    const review = {
      target: 'Analyst', overallImpression: 'Solid foundation.',
      strengths: ['Clear structure'],
      improvements: [{ section: 'Summary', suggestion: 'Add a target', why: 'Focus', example: 'Aspiring data analyst...' }],
      keywordsToAdd: ['SQL'], structuralNotes: ['Move projects above education'],
    };
    useSessionStore.getState().setResumeReview(review);
    expect(useSessionStore.getState().resumeReview).toEqual(review);
    useSessionStore.getState().setResumeReview(null);
    expect(useSessionStore.getState().resumeReview).toBeNull();
  });

  it('reset() clears all three materials', () => {
    useSessionStore.getState().setElevatorPitch({ target: null, hook: 'h', body: 'b', close: 'c', fullScript: 'f' });
    useSessionStore.getState().setCoverLetter({ target: 't', greeting: 'g', body: 'b', closing: 'c' });
    useSessionStore.getState().setResumeReview({
      target: null, overallImpression: 'o', strengths: [], improvements: [],
      keywordsToAdd: [], structuralNotes: [],
    });
    useSessionStore.getState().reset();
    const s = useSessionStore.getState();
    expect(s.elevatorPitch).toBeNull();
    expect(s.coverLetter).toBeNull();
    expect(s.resumeReview).toBeNull();
  });

  it('resetOutputs() clears all three materials but preserves inputs', () => {
    useSessionStore.getState().setElevatorPitch({ target: null, hook: 'h', body: 'b', close: 'c', fullScript: 'f' });
    useSessionStore.getState().setCoverLetter({ target: 't', greeting: 'g', body: 'b', closing: 'c' });
    useSessionStore.getState().setResumeReview({
      target: null, overallImpression: 'o', strengths: [], improvements: [],
      keywordsToAdd: [], structuralNotes: [],
    });
    useSessionStore.getState().setResume('r', 'r.pdf');
    useSessionStore.getState().resetOutputs();
    const s = useSessionStore.getState();
    expect(s.elevatorPitch).toBeNull();
    expect(s.coverLetter).toBeNull();
    expect(s.resumeReview).toBeNull();
    expect(s.resumeText).toBe('r');
  });
});
