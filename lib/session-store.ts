import { create } from 'zustand';
import type { finalCareerInfo } from '@/lib/types';

export type GapSeverity = 'critical' | 'important' | 'nice-to-have';
export type GapCategory = 'technical' | 'experience' | 'qualification' | 'soft' | 'domain';

export type Gap = {
  title: string;
  category: GapCategory;
  severity: GapSeverity;
  why: string;
  targetLevel: string;
  currentLevel: string | null;
  evidenceIdeas: string[];
};

export type GapAnalysis = {
  target: string;
  summary: string;
  matches: string[];
  gaps: Gap[];
  realisticTimeline: string;
};

export type LearningMilestone = {
  weekRange: string;
  focus: string;
  activities: string[];
  outcome: string;
};

export type LearningPath = {
  target: string;
  summary: string;
  prerequisites: string[];
  milestones: LearningMilestone[];
  portfolioProject: string;
  totalDuration: string;
  caveats: string[];
};

export type InterviewDifficulty = 'friendly' | 'standard' | 'tough';

export type InterviewPhase =
  | 'warm-up'
  | 'behavioural'
  | 'role-specific'
  | 'your-questions'
  | 'wrap-up';

export type InterviewImprovement = {
  area: string;
  why: string;
  example: string;
};

export type InterviewFeedback = {
  target: string;
  difficulty: InterviewDifficulty;
  summary: string;
  strengths: string[];
  improvements: InterviewImprovement[];
  perPhase: { phase: InterviewPhase; note: string }[];
  overallRating: 'developing' | 'on-track' | 'strong';
  nextSteps: string[];
};

export type SourceRef = {
  title: string;
  url: string;
  domain: string;
};

export type StudentProfile = {
  background: string;
  interests: string[];
  skills: string[];
  constraints: string[];
  goals: string[];
};

export type ChatMessageKind =
  | 'message'
  | 'focus-marker'
  | 'attachment-summary'
  | 'notice';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  kind: ChatMessageKind;
};

export type OdysseyLifeType = 'current' | 'pivot' | 'wildcard';

export type OdysseyDashboard = {
  resources: number | null;
  likability: number | null;
  confidence: number | null;
  coherence: number | null;
};

export type OdysseyLife = {
  type: OdysseyLifeType;
  label: string;
  seed: string;
  headline: string | null;
  dayInTheLife: string | null;
  typicalWeek: string[];
  toolsAndSkills: string[];
  whoYouWorkWith: string | null;
  challenges: string[];
  questionsToExplore: string[];
  dashboard: OdysseyDashboard;
};

export type BoardAdvisorRole = 'recruiter' | 'hr' | 'manager' | 'mentor';

export type BoardAdvisorVoice = {
  role: BoardAdvisorRole;
  name: string;
  response: string;
};

export type BoardSynthesis = {
  agreements: string[];
  disagreements: string[];
  topPriorities: string[];
};

export type BoardReview = {
  framing: string;
  focusRole: string | null;
  voices: BoardAdvisorVoice[];
  synthesis: BoardSynthesis;
};

export type BoardPrefill = {
  framing?: string;
  focusRole?: string;
};

export type ComparisonDimension =
  | 'typicalDay'
  | 'coreSkills'
  | 'trainingNeeded'
  | 'salaryRange'
  | 'workSetting'
  | 'whoItSuits'
  | 'mainChallenge';

export type ComparisonRole = {
  label: string;
  cells: Record<ComparisonDimension, string>;
};

export type Comparison = {
  mode: 'quick' | 'rich';
  roles: ComparisonRole[];
};

export type ComparePrefill = {
  seedTarget?: string;
  richCareerTitles?: string[];
};

export type ElevatorPitch = {
  target: string | null;
  hook: string;
  body: string;
  close: string;
  fullScript: string;
};

export type CoverLetter = {
  target: string;
  greeting: string;
  body: string;
  closing: string;
};

export type ResumeReviewItem = {
  section: string;
  suggestion: string;
  why: string;
  example: string;
};

export type ResumeReview = {
  target: string | null;
  overallImpression: string;
  strengths: string[];
  improvements: ResumeReviewItem[];
  keywordsToAdd: string[];
  structuralNotes: string[];
};

export type Portfolio = { html: string; target: string | null; };

export type FrameworkLevel = { name: string; level: string; description: string } | null;

export type SkillFrameworkMapping = {
  skill: string;
  sfia: FrameworkLevel;
  onet: FrameworkLevel;
  esco: FrameworkLevel;
  aqf: FrameworkLevel;
  professionalPhrase: string;
  nextLevel: string;
};

export type SkillsMapping = {
  mappings: SkillFrameworkMapping[];
  summary: string;
  frameworkNotes: string;
};

export type CareerTheme = { name: string; evidence: string[]; reflectionQuestion: string };
export type CareerStory = { themes: CareerTheme[]; narrative: string };

export type SessionState = {
  // Inputs
  resumeText: string | null;
  resumeFilename: string | null;
  freeText: string;
  jobTitle: string;
  jobAdvert: string;
  urlInput: string;
  urlFetchedTitle: string | null;

  // Chat
  chatMessages: ChatMessage[];
  currentFocus: string | null;

  // Outputs
  distilledProfile: StudentProfile | null;
  careers: finalCareerInfo[] | null;
  selectedCareerId: string | null;
  gapAnalysis: GapAnalysis | null;
  learningPath: LearningPath | null;

  // Odyssey
  odysseyLives: Record<OdysseyLifeType, OdysseyLife>;

  // Interview
  interviewMessages: ChatMessage[];
  interviewTarget: string | null;
  interviewDifficulty: InterviewDifficulty;
  interviewPhase: InterviewPhase | null;
  interviewTurnInPhase: number;
  interviewFeedback: InterviewFeedback | null;

  // Board
  boardReview: BoardReview | null;
  boardPrefill: BoardPrefill | null;

  // Comparison
  comparison: Comparison | null;
  comparePrefill: ComparePrefill | null;
  comparing: string[];

  // Portfolio
  portfolio: Portfolio | null;

  // Career story
  careerStory: CareerStory | null;

  // Skills mapping
  skillsMapping: SkillsMapping | null;

  // Career materials
  elevatorPitch: ElevatorPitch | null;
  coverLetter: CoverLetter | null;
  resumeReview: ResumeReview | null;

  // Grounding sources
  gapAnalysisSources: SourceRef[] | null;
  learningPathSources: SourceRef[] | null;
  interviewSources: SourceRef[];
  chatSources: Record<string, SourceRef[]>;

  // Actions
  setResume: (text: string, filename: string) => void;
  clearResume: () => void;
  setFreeText: (text: string) => void;
  setJobTitle: (title: string) => void;
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp' | 'kind'> & Partial<Pick<ChatMessage, 'id' | 'timestamp' | 'kind'>>) => void;
  replaceChatMessages: (msgs: ChatMessage[]) => void;
  setFocus: (career: string | null) => void;
  setDistilledProfile: (profile: StudentProfile | null) => void;
  setCareers: (careers: finalCareerInfo[] | null) => void;
  setJobAdvert: (text: string) => void;
  setGapAnalysis: (g: GapAnalysis | null) => void;
  setLearningPath: (l: LearningPath | null) => void;
  setInterviewSession: (target: string, difficulty: InterviewDifficulty) => void;
  addInterviewMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp' | 'kind'> & Partial<Pick<ChatMessage, 'id' | 'timestamp' | 'kind'>>) => void;
  advanceInterviewPhase: (phase: InterviewPhase | null, turnInPhase: number) => void;
  setInterviewDifficulty: (d: InterviewDifficulty) => void;
  setInterviewTarget: (t: string | null) => void;
  setInterviewFeedback: (f: InterviewFeedback | null) => void;
  resetInterview: () => void;
  setOdysseySeed: (type: OdysseyLifeType, label: string, seed: string) => void;
  setOdysseyElaboration: (type: OdysseyLifeType, elaboration: Partial<OdysseyLife>) => void;
  setOdysseyDashboard: (type: OdysseyLifeType, field: keyof OdysseyDashboard, value: number | null) => void;
  resetOdysseyLife: (type: OdysseyLifeType) => void;
  setUrlInput: (url: string) => void;
  setUrlFetchedTitle: (title: string | null) => void;
  setGapAnalysisSources: (s: SourceRef[] | null) => void;
  setLearningPathSources: (s: SourceRef[] | null) => void;
  addInterviewSources: (sources: SourceRef[]) => void;
  setChatSourcesForMessage: (messageId: string, sources: SourceRef[]) => void;
  setBoardReview: (r: BoardReview | null) => void;
  setBoardPrefill: (p: BoardPrefill | null) => void;
  consumeBoardPrefill: () => BoardPrefill | null;
  setComparison: (c: Comparison | null) => void;
  setComparePrefill: (p: ComparePrefill | null) => void;
  consumeComparePrefill: () => ComparePrefill | null;
  toggleComparing: (careerTitle: string) => void;
  clearComparing: () => void;
  setPortfolio: (p: Portfolio | null) => void;
  setCareerStory: (s: CareerStory | null) => void;
  setElevatorPitch: (p: ElevatorPitch | null) => void;
  setCoverLetter: (l: CoverLetter | null) => void;
  setResumeReview: (r: ResumeReview | null) => void;
  setSkillsMapping: (m: SkillsMapping | null) => void;
  resetOutputs: () => void;
  reset: () => void;
};

function makeEmptyLife(type: OdysseyLifeType): OdysseyLife {
  return {
    type,
    label: '',
    seed: '',
    headline: null,
    dayInTheLife: null,
    typicalWeek: [],
    toolsAndSkills: [],
    whoYouWorkWith: null,
    challenges: [],
    questionsToExplore: [],
    dashboard: {
      resources: null,
      likability: null,
      confidence: null,
      coherence: null,
    },
  };
}

const initialState = {
  resumeText: null,
  resumeFilename: null,
  freeText: '',
  jobTitle: '',
  jobAdvert: '',
  chatMessages: [],
  currentFocus: null,
  distilledProfile: null,
  careers: null,
  selectedCareerId: null,
  gapAnalysis: null,
  learningPath: null,
  odysseyLives: {
    current: makeEmptyLife('current'),
    pivot: makeEmptyLife('pivot'),
    wildcard: makeEmptyLife('wildcard'),
  },
  interviewMessages: [],
  interviewTarget: null,
  interviewDifficulty: 'standard' as InterviewDifficulty,
  interviewPhase: null,
  interviewTurnInPhase: 0,
  interviewFeedback: null,
  urlInput: '',
  urlFetchedTitle: null,
  gapAnalysisSources: null,
  learningPathSources: null,
  interviewSources: [],
  chatSources: {},
  portfolio: null,
  careerStory: null,
  skillsMapping: null,
  elevatorPitch: null,
  coverLetter: null,
  resumeReview: null,
  boardReview: null,
  boardPrefill: null,
  comparison: null,
  comparePrefill: null,
  comparing: [],
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,

  setResume: (text, filename) =>
    set({ resumeText: text, resumeFilename: filename }),
  clearResume: () => set({ resumeText: null, resumeFilename: null }),
  setFreeText: (text) => set({ freeText: text }),
  setJobTitle: (title) => set({ jobTitle: title }),

  addChatMessage: (msg) =>
    set((s) => ({
      chatMessages: [
        ...s.chatMessages,
        {
          id: msg.id ?? makeId(),
          timestamp: msg.timestamp ?? Date.now(),
          kind: msg.kind ?? 'message',
          role: msg.role,
          content: msg.content,
        },
      ],
    })),

  replaceChatMessages: (msgs) => set({ chatMessages: msgs }),

  setFocus: (career) => set({ currentFocus: career }),
  setDistilledProfile: (profile) => set({ distilledProfile: profile }),
  setCareers: (careers) => set({ careers }),
  setJobAdvert: (text) => set({ jobAdvert: text }),
  setGapAnalysis: (g) => set({ gapAnalysis: g }),
  setLearningPath: (l) => set({ learningPath: l }),

  setInterviewSession: (target, difficulty) =>
    set({
      interviewTarget: target,
      interviewDifficulty: difficulty,
      interviewMessages: [],
      interviewPhase: 'warm-up',
      interviewTurnInPhase: 0,
      interviewFeedback: null,
    }),

  addInterviewMessage: (msg) =>
    set((s) => ({
      interviewMessages: [
        ...s.interviewMessages,
        {
          id: msg.id ?? makeId(),
          timestamp: msg.timestamp ?? Date.now(),
          kind: msg.kind ?? 'message',
          role: msg.role,
          content: msg.content,
        },
      ],
    })),

  advanceInterviewPhase: (phase, turnInPhase) =>
    set({ interviewPhase: phase, interviewTurnInPhase: turnInPhase }),

  setInterviewDifficulty: (d) => set({ interviewDifficulty: d }),
  setInterviewTarget: (t) => set({ interviewTarget: t }),
  setInterviewFeedback: (f) => set({ interviewFeedback: f }),

  resetInterview: () =>
    set({
      interviewMessages: [],
      interviewTarget: null,
      interviewDifficulty: 'standard',
      interviewPhase: null,
      interviewTurnInPhase: 0,
      interviewFeedback: null,
      interviewSources: [],
    }),

  setOdysseySeed: (type, label, seed) =>
    set((s) => ({
      odysseyLives: {
        ...s.odysseyLives,
        [type]: { ...s.odysseyLives[type], label, seed },
      },
    })),

  setOdysseyElaboration: (type, elaboration) =>
    set((s) => ({
      odysseyLives: {
        ...s.odysseyLives,
        [type]: { ...s.odysseyLives[type], ...elaboration },
      },
    })),

  setOdysseyDashboard: (type, field, value) =>
    set((s) => ({
      odysseyLives: {
        ...s.odysseyLives,
        [type]: {
          ...s.odysseyLives[type],
          dashboard: { ...s.odysseyLives[type].dashboard, [field]: value },
        },
      },
    })),

  resetOdysseyLife: (type) =>
    set((s) => ({
      odysseyLives: { ...s.odysseyLives, [type]: makeEmptyLife(type) },
    })),

  setUrlInput: (url) => set({ urlInput: url }),
  setUrlFetchedTitle: (title) => set({ urlFetchedTitle: title }),
  setGapAnalysisSources: (s) => set({ gapAnalysisSources: s }),
  setLearningPathSources: (s) => set({ learningPathSources: s }),

  addInterviewSources: (sources) =>
    set((state) => {
      const existing = new Set(state.interviewSources.map((s) => s.url));
      const fresh = sources.filter((s) => !existing.has(s.url));
      return { interviewSources: [...state.interviewSources, ...fresh] };
    }),

  setChatSourcesForMessage: (messageId, sources) =>
    set((state) => ({
      chatSources: { ...state.chatSources, [messageId]: sources },
    })),

  setBoardReview: (r) => set({ boardReview: r }),
  setBoardPrefill: (p) => set({ boardPrefill: p }),
  consumeBoardPrefill: () => {
    const current = get().boardPrefill;
    if (current) set({ boardPrefill: null });
    return current;
  },

  setComparison: (c) => set({ comparison: c }),
  setComparePrefill: (p) => set({ comparePrefill: p }),
  consumeComparePrefill: () => {
    const current = get().comparePrefill;
    if (current) set({ comparePrefill: null });
    return current;
  },
  toggleComparing: (title) =>
    set((state) => {
      if (state.comparing.includes(title)) {
        return { comparing: state.comparing.filter((t) => t !== title) };
      }
      if (state.comparing.length >= 3) {
        return state;
      }
      return { comparing: [...state.comparing, title] };
    }),
  clearComparing: () => set({ comparing: [] }),

  setPortfolio: (p) => set({ portfolio: p }),
  setCareerStory: (s) => set({ careerStory: s }),
  setElevatorPitch: (p) => set({ elevatorPitch: p }),
  setCoverLetter: (l) => set({ coverLetter: l }),
  setResumeReview: (r) => set({ resumeReview: r }),
  setSkillsMapping: (m) => set({ skillsMapping: m }),

  resetOutputs: () => {
    const s = get();
    set({
      ...initialState,
      resumeText: s.resumeText,
      resumeFilename: s.resumeFilename,
      freeText: s.freeText,
      jobTitle: s.jobTitle,
      jobAdvert: s.jobAdvert,
      urlInput: s.urlInput,
      urlFetchedTitle: s.urlFetchedTitle,
    });
  },

  reset: () => set({ ...initialState }),
}));
