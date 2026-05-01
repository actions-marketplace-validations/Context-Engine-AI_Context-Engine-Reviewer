import {
  buildLoadingMessage,
  buildOverviewMessage,
  buildReviewSummary,
  OVERVIEW_MESSAGE_SIGNATURE,
  PAYLOAD_TAG_OPEN,
  PAYLOAD_TAG_CLOSE
} from '../messages';
import { FileDiff } from '../diff';
import { GitHubContext } from '../types';
import { AIComment, PullRequestSummary } from '../prompts';
import config from '../config';

// Mock the GitHub context
jest.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo'
    }
  }
}));

jest.mock('../config', () => ({
  __esModule: true,
  default: {
    githubToken: 'mock-token',
    llmApiKey: 'mock-api-key',
    llmModel: 'mock-model',
    styleGuideRules: '',
    githubApiUrl: 'https://api.github.com',
    githubServerUrl: 'https://github.com',
    loadInputs: jest.fn()
  }
}));

describe('Messages', () => {
  const mockContext = {
    repo: { owner: 'test-owner', repo: 'test-repo' }
  } as GitHubContext;

  const mockFileDiffs: FileDiff[] = [
    {
      filename: 'src/test1.ts',
      status: 'modified',
      hunks: [{ startLine: 1, endLine: 5, diff: '@@ -1,3 +1,5 @@\n test\n+added\n+more' }]
    },
    {
      filename: 'src/test2.ts',
      status: 'added',
      hunks: [{ startLine: 1, endLine: 3, diff: '@@ -0,0 +1,3 @@\n+new file\n+content\n+here' }]
    }
  ];

  const mockCommits = [
    { sha: 'abc123', commit: { message: 'First commit' } },
    { sha: 'def456', commit: { message: 'Second commit' } }
  ];

  test('buildLoadingMessage formats correctly', () => {
    const message = buildLoadingMessage('base-sha', mockCommits, mockFileDiffs);

    expect(message).toContain('Analyzing changes in this PR');
    expect(message).toContain('base-sh');
    expect(message).toContain('abc123');
    expect(message).toContain('def456');
    expect(message).toContain('First commit');
    expect(message).toContain('Second commit');
    expect(message).toContain('src/test1.ts');
    expect(message).toContain('src/test2.ts');
    expect(message).toContain(OVERVIEW_MESSAGE_SIGNATURE);
    expect(message).toContain('https://github.com/test-owner/test-repo/commit/');
  });

  test('buildOverviewMessage formats correctly', () => {
    const mockSummary: PullRequestSummary = {
      title: 'Test PR',
      description: 'This is a test PR',
      files: [
        { filename: 'src/test1.ts', summary: 'Modified test file', title: 'Test 1' },
        { filename: 'src/test2.ts', summary: 'Added new file', title: 'Test 2' }
      ],
      type: ['ENHANCEMENT']
    };

    // Updated signature now accepts commits and fileDiffs
    const message = buildOverviewMessage(mockSummary, ['commit1', 'commit2'], mockFileDiffs);

    // Minimal summary now uses 'Summary' and 'Scope' sections with payload tags
    expect(message).toContain('PR Summary:');
    expect(message).toContain('Scope:');
    expect(message).toContain(OVERVIEW_MESSAGE_SIGNATURE);
    expect(message).toContain(PAYLOAD_TAG_OPEN);
    expect(message).toContain(PAYLOAD_TAG_CLOSE);
    expect(message).toContain('"commits":["commit1","commit2"]');
  });

  test('buildReviewSummary formats correctly with comments', () => {
    const mockActionableComments: AIComment[] = [
      {
        file: 'src/test1.ts',
        start_line: 2,
        end_line: 3,
        highlighted_code: '+added',
        header: 'Potential issue',
        content: 'This might cause a problem',
        label: 'possible bug',
        critical: true
      }
    ];

    const mockSkippedComments: AIComment[] = [
      {
        file: 'src/test2.ts',
        start_line: 1,
        end_line: 1,
        highlighted_code: '+new file',
        header: 'Style suggestion',
        content: 'Consider using a different style',
        label: 'style',
        critical: false
      }
    ];

    const summary = buildReviewSummary(
      mockContext,
      mockFileDiffs,
      mockCommits,
      mockActionableComments,
      mockSkippedComments
    );

    // Minimal review summary now simply indicates inline comments were posted
    expect(summary).toContain('Inline review comments have been posted.');
  });

  test('buildReviewSummary formats correctly with no comments', () => {
    const summary = buildReviewSummary(
      mockContext,
      mockFileDiffs,
      mockCommits,
      [],
      []
    );

    // Minimal review summary now simply indicates inline comments were posted
    expect(summary).toContain('Inline review comments have been posted.');
  });

  test('buildLoadingMessage uses custom GitHub server URL', () => {
    // Temporarily override the githubServerUrl
    const originalServerUrl = config.githubServerUrl;
    Object.defineProperty(config, 'githubServerUrl', {
      value: 'https://github.example.com',
      writable: true
    });

    const message = buildLoadingMessage('base-sha', mockCommits, mockFileDiffs);

    expect(message).toContain('https://github.example.com/test-owner/test-repo/commit/');

    // Restore the original value
    Object.defineProperty(config, 'githubServerUrl', {
      value: originalServerUrl,
      writable: true
    });
  });
});

  test('buildOverviewMessage sanitizes rationale heading', () => {
    const mockSummary: PullRequestSummary = {
      title: 'Test PR',
      description: 'Desc',
      files: [],
      type: []
    };
    const rationale = 'Summary/Rationale:\nThis is the reason.';
    const msg = buildOverviewMessage(mockSummary, [], [], rationale);
    const matches = msg.match(/Rationale:/g) || [];
    expect(matches.length).toBe(1);
    expect(msg).not.toContain('Summary/Rationale:');
    expect(msg).toContain('This is the reason.');
  });




describe('Messages - review highlights', () => {
  function h(diff: string = '@@ -1,1 +1,1 @@\n+'): any { return { startLine: 1, endLine: 1, diff }; }

  test('buildOverviewMessage includes generic highlight bullets', () => {
    const files = [
      { filename: 'src/api/users.ts', status: 'modified', hunks: [h()] },
      { filename: 'db/migrations/001_add_users.sql', status: 'added', hunks: [h()] },
      { filename: 'src/users.test.ts', status: 'modified', hunks: [h()] },
      { filename: '.github/workflows/ci.yml', status: 'modified', hunks: [h()] },
      { filename: 'docs/usage.md', status: 'modified', hunks: [h()] },
    ] as any;

    const summary: PullRequestSummary = {
      title: 't', description: 'd', files: [], type: []
    };

    const msg = buildOverviewMessage(summary, ['c1'], files);

    expect(msg).toContain('API/service files changed: src/api/users.ts');
    expect(msg).toContain('Migrations changed: db/migrations/001_add_users.sql');
    expect(msg).toContain('Tests changed: src/users.test.ts');
    expect(msg).toContain('Configuration changed: .github/workflows/ci.yml');
    expect(msg).toContain('Documentation changed: docs/usage.md');
  });
});



describe('Messages - additional branches', () => {
  test('buildLoadingMessage shows renamed from and pluralization', () => {
    const files: any = [
      { filename: 'src/fileA.ts', status: 'renamed', previous_filename: 'src/oldFileA.ts', hunks: [{ startLine: 1, endLine: 1, diff: '@@ -1,1 +1,1 @@\n+X' }] },
      { filename: 'src/fileB.ts', status: 'modified', hunks: [ { startLine: 1, endLine: 1, diff: '@@ -1,1 +1,1 @@\n+Y' }, { startLine: 2, endLine: 2, diff: '@@ -2,2 +2,2 @@\n+Z' } ] },
    ];
    const commits = [ { sha: 'c1', commit: { message: 'm1' } } ];
    const msg = buildLoadingMessage('b1', commits as any, files as any);
    expect(msg).toContain('(from src/oldFileA.ts)');
    // fileB has 2 hunks -> plural
    expect(msg).toContain('2 hunks');
  });

  test('buildOverviewMessage counts source category', () => {
    const files: any = [
      { filename: 'src/reviewer.ts', status: 'modified', hunks: [{ startLine: 1, endLine: 1, diff: '@@ -1,1 +1,1 @@\n+X' }] },
    ];
    const summary: any = { title: 't', description: 'd', files: [], type: [] };
    const msg = buildOverviewMessage(summary, ['c1'], files);
    expect(msg).toContain('Scope: 1 files changed');
    expect(msg).toMatch(/Source\(1\)/);
  });
});
