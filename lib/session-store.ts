import { create } from 'zustand';
import type { finalCareerInfo } from '@/lib/types';

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

export type SessionState = {
  // Inputs
  resumeText: string | null;
  resumeFilename: string | null;
  freeText: string;
  jobTitle: string;

  // Chat
  chatMessages: ChatMessage[];
  currentFocus: string | null;

  // Outputs
  distilledProfile: StudentProfile | null;
  careers: finalCareerInfo[] | null;
  selectedCareerId: string | null;

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
  reset: () => void;
};

const initialState = {
  resumeText: null,
  resumeFilename: null,
  freeText: '',
  jobTitle: '',
  chatMessages: [],
  currentFocus: null,
  distilledProfile: null,
  careers: null,
  selectedCareerId: null,
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useSessionStore = create<SessionState>((set) => ({
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

  reset: () => set({ ...initialState }),
}));
