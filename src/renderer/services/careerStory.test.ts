import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the chat client before importing the service so the import wires up
// against the mock. The service imports `chat` from './llm'.
vi.mock('./llm', () => ({
  chat: vi.fn(),
}));

import { chat } from './llm';
import { generateCareerStory } from './careerStory';
import type { CareerStoryInput } from '@/lib/prompts/career-story';

const mockChat = chat as unknown as ReturnType<typeof vi.fn>;

const VALID_STORY_JSON = JSON.stringify({
  themes: [
    {
      name: 'Curiosity-led growth',
      evidence: [
        'resume: taught yourself three frameworks in 18 months',
        'gapAnalysis: identified learning gaps as the top priority',
      ],
      reflectionQuestion: 'What is the next thing you most want to learn?',
    },
    {
      name: 'People before products',
      evidence: [
        'aboutYou: wrote about caring more about users than features',
        'boardReview: mentor flagged your strength with stakeholders',
      ],
      reflectionQuestion: 'When did you last feel proud of a relationship at work?',
    },
  ],
  narrative:
    'I keep coming back to learning.\n\nAnd the people I learn with are the ones who matter most.',
});

function chatReply(content: string) {
  return { content, usage: undefined };
}

beforeEach(() => {
  mockChat.mockReset();
});

describe('generateCareerStory — input handling', () => {
  it('rejects empty input with a clear error message', async () => {
    await expect(generateCareerStory({})).rejects.toThrow(
      /resume or About you/i
    );
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only resume + freeText', async () => {
    await expect(
      generateCareerStory({ resume: '   ', freeText: '\n\t  ' })
    ).rejects.toThrow(/resume or About you/i);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('accepts resume alone', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_STORY_JSON));
    const result = await generateCareerStory({
      resume: 'Software engineer at Acme.',
    });
    expect(result.story.themes.length).toBeGreaterThan(0);
    expect(result.story.narrative).toBeTruthy();
  });

  it('accepts freeText alone', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_STORY_JSON));
    const result = await generateCareerStory({
      freeText: 'I love working on small focused teams.',
    });
    expect(result.story.themes.length).toBeGreaterThan(0);
  });

  it('accepts distilledProfile alone (no resume, no freeText)', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_STORY_JSON));
    const result = await generateCareerStory({
      distilledProfile: {
        background: 'CS student',
        interests: ['data'],
        skills: ['python'],
        constraints: [],
        goals: ['get a job'],
      },
    });
    expect(result.story.themes.length).toBeGreaterThan(0);
  });
});

describe('generateCareerStory — prompt construction', () => {
  it('sends a system prompt + user prompt with json_object response_format', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_STORY_JSON));
    await generateCareerStory({ resume: 'Engineer at Acme.' });

    expect(mockChat).toHaveBeenCalledTimes(1);
    const args = mockChat.mock.calls[0][0];
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect(args.messages).toHaveLength(2);
    expect(args.messages[0].role).toBe('system');
    expect(args.messages[0].content).toMatch(/career themes/i);
    expect(args.messages[0].content).toMatch(/JSON/);
    expect(args.messages[1].role).toBe('user');
    expect(args.messages[1].content).toContain('Engineer at Acme');
  });

  it('passes session outputs (valuesCompass, gapAnalysis) through to the prompt', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_STORY_JSON));
    await generateCareerStory({
      resume: 'Engineer at Acme.',
      valuesCompass: {
        summary: 'You value learning above all.',
        values: [
          {
            name: 'Learning',
            rank: 1,
            description: 'You light up when you grow.',
            evidence: 'Implicit.',
            reflectionQuestion: 'What is next?',
          },
        ],
        tensions: [],
      },
      gapAnalysis: {
        target: 'Data scientist',
        summary: 'You are close.',
        matches: ['Python', 'SQL'],
        gaps: [
          {
            title: 'Statistics',
            severity: 'critical',
            why: 'Needed for ML',
            how: 'Course',
          },
        ],
        realisticTimeline: '6 months',
      },
    });
    const userPrompt = mockChat.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain('Learning');
    expect(userPrompt).toContain('Data scientist');
    expect(userPrompt).toContain('Statistics');
  });
});

describe('generateCareerStory — output shape', () => {
  it('returns parsed story + trimmed=false on first-try success', async () => {
    mockChat.mockResolvedValueOnce(chatReply(VALID_STORY_JSON));
    const result = await generateCareerStory({ resume: 'Engineer.' });
    expect(result.trimmed).toBe(false);
    expect(result.story.themes.length).toBe(2);
    expect(result.story.themes[0].name).toBe('Curiosity-led growth');
    expect(result.story.narrative).toContain('learning');
  });

  it('throws a clear error when the model returns invalid JSON', async () => {
    mockChat.mockResolvedValueOnce(chatReply('not valid json'));
    await expect(
      generateCareerStory({ resume: 'Engineer.' })
    ).rejects.toThrow();
  });

  it('throws when the model returns JSON with no themes', async () => {
    const noThemes = JSON.stringify({ themes: [], narrative: 'A story.' });
    mockChat.mockResolvedValueOnce(chatReply(noThemes));
    await expect(
      generateCareerStory({ resume: 'Engineer.' })
    ).rejects.toThrow(/theme/i);
  });
});

describe('generateCareerStory — token-limit retry ladder', () => {
  it('first retry drops session outputs, keeps profile', async () => {
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_STORY_JSON));

    const input: CareerStoryInput = {
      resume: 'Engineer at Acme.',
      valuesCompass: {
        summary: 'You value learning.',
        values: [
          {
            name: 'Learning',
            rank: 1,
            description: 'desc',
            evidence: 'ev',
            reflectionQuestion: 'q',
          },
        ],
        tensions: [],
      },
    };
    const result = await generateCareerStory(input);
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(2);

    // The retry prompt should still mention the resume but NOT the values
    // compass content (since session outputs were dropped).
    const retryPrompt = mockChat.mock.calls[1][0].messages[1].content;
    expect(retryPrompt).toContain('Engineer at Acme');
    expect(retryPrompt).not.toContain('You value learning');
  });

  it('second retry also trims jobAdvert and resume to 4000 chars', async () => {
    const longResume = 'R'.repeat(5000);
    const longAdvert = 'A'.repeat(5000);
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockResolvedValueOnce(chatReply(VALID_STORY_JSON));

    const result = await generateCareerStory({
      resume: longResume,
      jobAdvert: longAdvert,
    });
    expect(result.trimmed).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(3);

    const thirdPrompt = mockChat.mock.calls[2][0].messages[1].content;
    expect(thirdPrompt).not.toMatch(/R{5000}/);
    expect(thirdPrompt).not.toMatch(/A{5000}/);
  });

  it('surrenders with a helpful error after three token-limit failures', async () => {
    mockChat.mockRejectedValue(new Error('maximum context length'));
    await expect(
      generateCareerStory({ resume: 'R'.repeat(5000) })
    ).rejects.toThrow(/too much session data/i);
    expect(mockChat).toHaveBeenCalledTimes(3);
  });

  it('rethrows non-token-limit errors immediately without retrying', async () => {
    mockChat.mockRejectedValueOnce(new Error('API key not configured'));
    await expect(
      generateCareerStory({ resume: 'Engineer.' })
    ).rejects.toThrow(/API key not configured/);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('rethrows non-token-limit errors during the first retry', async () => {
    mockChat
      .mockRejectedValueOnce(new Error('context length exceeded'))
      .mockRejectedValueOnce(new Error('network failed'));
    await expect(
      generateCareerStory({ resume: 'Engineer.' })
    ).rejects.toThrow(/network failed/);
    expect(mockChat).toHaveBeenCalledTimes(2);
  });
});
