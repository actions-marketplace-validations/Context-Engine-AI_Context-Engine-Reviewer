import config from '../config';
import { ContextEngineMcpClient, appendContextEngineToolInstructions, createContextEngineTools } from '../context_engine_mcp';

jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  getInput: jest.fn(() => ''),
  getMultilineInput: jest.fn(() => []),
}));

describe('Context Engine MCP integration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    (config as any).contextEngineApiKey = 'ce-key';
    (config as any).contextEngineMcpUrl = 'https://dev.context-engine.ai/indexer/mcp';
    (config as any).contextEngineCollection = 'repo-collection';
    (config as any).contextEngineTools = ['repo_search', 'batch_search'];
    (config as any).contextEngineMaxTools = 9;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function jsonResponse(body: unknown, headers?: Record<string, string>): Response {
    return new Response(JSON.stringify(body), { status: 200, headers });
  }

  test('lists remote MCP tools with bearer auth and session reuse', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ result: {} }, { 'mcp-session-id': 'session-1' }))
      .mockResolvedValueOnce(new Response('', { status: 202 }))
      .mockResolvedValueOnce(jsonResponse({ result: { tools: [{ name: 'search', description: 'Search code' }] } }));
    global.fetch = fetchMock as any;

    const client = new ContextEngineMcpClient({
      url: 'https://dev.context-engine.ai/indexer/mcp',
      apiKey: 'ce-key',
      collection: 'repo-collection',
    });

    const tools = await client.listTools();

    expect(tools).toEqual([{ name: 'search', description: 'Search code' }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer ce-key');
    expect(fetchMock.mock.calls[0][1].headers['x-collection']).toBe('repo-collection');
    expect(fetchMock.mock.calls[2][1].headers['mcp-session-id']).toBe('session-1');
  });

  test('tool calls add reviewer-safe compact defaults and collection', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ result: {} }, { 'mcp-session-id': 'session-1' }))
      .mockResolvedValueOnce(new Response('', { status: 202 }))
      .mockResolvedValueOnce(jsonResponse({ result: { content: [{ type: 'text', text: 'ok' }] } }));
    global.fetch = fetchMock as any;

    const client = new ContextEngineMcpClient({
      url: 'https://dev.context-engine.ai/indexer/mcp',
      apiKey: 'ce-key',
      collection: 'repo-collection',
    });

    await client.callTool('repo_search', { query: 'authentication' });

    const callBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(callBody.method).toBe('tools/call');
    expect(callBody.params.name).toBe('repo_search');
    expect(callBody.params.arguments).toEqual(expect.objectContaining({
      query: 'authentication',
      collection: 'repo-collection',
      limit: 5,
      compact: true,
      include_snippet: true,
      output_format: 'toon',
    }));
  });

  test('creates AI SDK tools from the configured remote MCP allow-list', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ result: {} }, { 'mcp-session-id': 'session-1' }))
      .mockResolvedValueOnce(new Response('', { status: 202 }))
      .mockResolvedValueOnce(jsonResponse({ result: { tools: [
        { name: 'search', description: 'Noisy router', inputSchema: { type: 'object' } },
        { name: 'repo_search', description: 'Search code', inputSchema: { type: 'object' } },
        { name: 'batch_search', description: 'Batch search code', inputSchema: { type: 'object' } },
        { name: 'memory_store', description: 'Do not expose by default', inputSchema: { type: 'object' } },
      ] } }));
    global.fetch = fetchMock as any;

    const tools = await createContextEngineTools();

    expect(Object.keys(tools || {})).toEqual(['repo_search', 'batch_search']);
  });

  test('default allow-list excludes unified search router and memory tools', async () => {
    (config as any).contextEngineTools = [];
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ result: {} }, { 'mcp-session-id': 'session-1' }))
      .mockResolvedValueOnce(new Response('', { status: 202 }))
      .mockResolvedValueOnce(jsonResponse({ result: { tools: [
        { name: 'search', description: 'Noisy router', inputSchema: { type: 'object' } },
        { name: 'repo_search', description: 'Repo search', inputSchema: { type: 'object' } },
        { name: 'batch_search', description: 'Batch repo search', inputSchema: { type: 'object' } },
        { name: 'symbol_graph', description: 'Symbol graph', inputSchema: { type: 'object' } },
        { name: 'batch_symbol_graph', description: 'Batch symbol graph', inputSchema: { type: 'object' } },
        { name: 'graph_query', description: 'Graph query', inputSchema: { type: 'object' } },
        { name: 'batch_graph_query', description: 'Batch graph query', inputSchema: { type: 'object' } },
        { name: 'search_tests_for', description: 'Tests', inputSchema: { type: 'object' } },
        { name: 'search_config_for', description: 'Config', inputSchema: { type: 'object' } },
        { name: 'search_commits_for', description: 'Git history', inputSchema: { type: 'object' } },
        { name: 'memory_find', description: 'Memory', inputSchema: { type: 'object' } },
      ] } }));
    global.fetch = fetchMock as any;

    const tools = await createContextEngineTools();

    expect(Object.keys(tools || {})).toEqual([
      'repo_search',
      'batch_search',
      'symbol_graph',
      'batch_symbol_graph',
      'graph_query',
      'batch_graph_query',
      'search_tests_for',
      'search_config_for',
      'search_commits_for',
    ]);
  });

  test('does not add snippet defaults to graph tools', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ result: {} }, { 'mcp-session-id': 'session-1' }))
      .mockResolvedValueOnce(new Response('', { status: 202 }))
      .mockResolvedValueOnce(jsonResponse({ result: { content: [{ type: 'text', text: 'ok' }] } }));
    global.fetch = fetchMock as any;

    const client = new ContextEngineMcpClient({
      url: 'https://dev.context-engine.ai/indexer/mcp',
      apiKey: 'ce-key',
      collection: 'repo-collection',
    });

    await client.callTool('symbol_graph', { symbol: 'authenticate', query_type: 'callers' });

    const callBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(callBody.params.arguments).toEqual(expect.objectContaining({
      symbol: 'authenticate',
      query_type: 'callers',
      collection: 'repo-collection',
      limit: 5,
      output_format: 'toon',
    }));
    expect(callBody.params.arguments).not.toHaveProperty('compact');
    expect(callBody.params.arguments).not.toHaveProperty('include_snippet');
  });

  test('does not add output-format defaults to git history tools', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ result: {} }, { 'mcp-session-id': 'session-1' }))
      .mockResolvedValueOnce(new Response('', { status: 202 }))
      .mockResolvedValueOnce(jsonResponse({ result: { content: [{ type: 'text', text: 'ok' }] } }));
    global.fetch = fetchMock as any;

    const client = new ContextEngineMcpClient({
      url: 'https://dev.context-engine.ai/indexer/mcp',
      apiKey: 'ce-key',
      collection: 'repo-collection',
    });

    await client.callTool('search_commits_for', { query: 'authentication bug' });

    const callBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(callBody.params.arguments).toEqual(expect.objectContaining({
      query: 'authentication bug',
      collection: 'repo-collection',
      limit: 5,
    }));
    expect(callBody.params.arguments).not.toHaveProperty('output_format');
    expect(callBody.params.arguments).not.toHaveProperty('include_snippet');
  });

  test('does not alter system prompt when Context Engine is not configured', () => {
    (config as any).contextEngineApiKey = undefined;
    expect(appendContextEngineToolInstructions('sys')).toBe('sys');
  });
});