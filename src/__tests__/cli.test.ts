import { applyContextEngineCliOptions, parseArgs } from '../cli';

describe('dry-run CLI Context Engine options', () => {
  beforeEach(() => {
    delete process.env.CONTEXT_ENGINE_API_KEY;
    delete process.env.CONTEXT_ENGINE_MCP_URL;
    delete process.env.CONTEXT_ENGINE_COLLECTION;
    delete process.env.CONTEXT_ENGINE_TOOLS;
    delete process.env.CONTEXT_ENGINE_MAX_TOOLS;
  });

  test('parses and applies Context Engine dry-run flags', () => {
    const args = parseArgs([
      '--pr', '42',
      '--dry-run',
      '--context-engine-api-key', 'ce-key',
      '--context-engine-mcp-url', 'https://dev.context-engine.ai/indexer/mcp',
      '--context-engine-collection', 'repo-col',
      '--context-engine-tools', 'repo_search,batch_search',
      '--context-engine-max-tools', '2',
    ]);

    expect(args.pr).toBe(42);
    expect(args.dryRun).toBe(true);

    applyContextEngineCliOptions(args);

    expect(process.env.CONTEXT_ENGINE_API_KEY).toBe('ce-key');
    expect(process.env.CONTEXT_ENGINE_MCP_URL).toBe('https://dev.context-engine.ai/indexer/mcp');
    expect(process.env.CONTEXT_ENGINE_COLLECTION).toBe('repo-col');
    expect(process.env.CONTEXT_ENGINE_TOOLS).toBe('repo_search,batch_search');
    expect(process.env.CONTEXT_ENGINE_MAX_TOOLS).toBe('2');
  });
});