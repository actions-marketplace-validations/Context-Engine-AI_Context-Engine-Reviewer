import { jest } from '@jest/globals';

const mockRunPrompt = jest.fn().mockResolvedValue({
  review: { estimated_effort_to_review: 1, score: 100, has_relevant_tests: true, security_concerns: 'None' },
  documentation: '',
  comments: [],
});

describe('prompts.custom.ts', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockRunPrompt.mockClear();
  });

  test('enables Context Engine tools for custom per-batch review prompts', async () => {
    jest.doMock('../ai', () => ({ __esModule: true, runPrompt: mockRunPrompt }));

    const { runReviewPrompt } = await import('../prompts.custom');
    await runReviewPrompt({
      prTitle: 'T',
      prDescription: 'D',
      prSummary: 'S',
      files: [{ filename: 'src/x.ts', status: 'modified', hunks: [{ startLine: 1, endLine: 1, diff: '@@ -1,1 +1,1 @@\n+X' }] }] as any,
    });

    expect(mockRunPrompt).toHaveBeenCalledTimes(1);
    expect(mockRunPrompt.mock.calls[0][0].enableContextEngineTools).toBe(true);
  });
});