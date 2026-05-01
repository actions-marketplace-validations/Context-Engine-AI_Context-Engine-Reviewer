# Context Engine Reviewer

Context Engine Reviewer is a GitHub PR reviewer that runs as a standalone AI code reviewer and is designed for Context Engine workflows.

This repository starts from the reviewer shell we proved in the DOJ reviewer: GitHub PR plumbing, diff parsing, batching, LLM provider adapters, local dry-run CLI, inline review posting, comment upserts, and follow-up replies. Domain-specific reviewer logic has been removed so the product is useful for normal software repositories.

## What It Does

- Reviews pull requests and posts high-signal inline comments.
- Writes a compact PR overview with scope, highlights, and summary.
- Tracks reviewed commits so follow-up runs can review incrementally.
- Batches large diffs by context size instead of sending one oversized prompt.
- Supports local dry runs against real GitHub PRs.
- Supports OpenAI, Anthropic, Google, and AWS Bedrock through AI SDK adapters.
- Keeps the existing `custom_mode` review behavior for deeper senior-engineer analysis.

## Status

This repository currently works as a normal AI reviewer without requiring Context Engine credentials.

## GitHub Action Usage

Create `.github/workflows/context-engine-reviewer.yml`:

```yaml
name: context-engine-reviewer

permissions:
  contents: read
  pull-requests: write
  issues: write

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: Context-Engine-AI/context-engine-reviewer@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          LLM_PROVIDER: ai-sdk
          LLM_MODEL: gpt-5-mini
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
```

Add this event only if you want the reviewer to answer follow-up questions in existing review comment threads:

```yaml
on:
  pull_request_review_comment:
    types: [created]
```

For fork-heavy public repositories, review your event choice carefully. `pull_request` is safer by default. Use `pull_request_target` only when you understand the security tradeoffs and do not execute untrusted PR code.

## Configuration

Required:

- `GITHUB_TOKEN`: GitHub token with pull request comment permissions.
- `LLM_MODEL`: model name.
- `LLM_API_KEY`: model API key, unless using a provider that authenticates another way.

Common optional settings:

- `LLM_PROVIDER`: `ai-sdk`. Defaults to `ai-sdk`.
- `CUSTOM_MODE`: `on`, `off`, or `auto`. Defaults to `auto`.
- `REVIEW_SCOPES`: comma-separated labels used by review configuration.
- `REVIEW_MAX_COMMENTS`: maximum inline comments per run. Defaults to `40`.
- `REVIEW_MAX_CODEBLOCK_LINES`: maximum lines retained in fenced code blocks. Defaults to `60`.
- `REVIEW_MAX_REVIEW_CHARS`: maximum diff characters per LLM review batch. Defaults to `725000`.
- `STYLE_GUIDE_RULES`: additional rules to enforce.
- `ALLOW_TITLE_UPDATE`: set to `true` to allow title rewriting when the PR title explicitly asks for it.
- `GITHUB_API_URL`: GitHub Enterprise API URL.
- `GITHUB_SERVER_URL`: GitHub Enterprise web URL.

The action input names mirror the environment variables where applicable, for example `custom_mode`, `llm_model`, `llm_provider`, `github_api_url`, and `github_server_url`.

## Providers

The reviewer uses the AI SDK provider surface. Direct API providers use `LLM_API_KEY`; AWS Bedrock can use AWS credentials instead.

OpenAI:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  LLM_PROVIDER: ai-sdk
  LLM_MODEL: gpt-5-mini
  LLM_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Anthropic:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  LLM_PROVIDER: ai-sdk
  LLM_MODEL: claude-3-5-sonnet-20241022
  LLM_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Google:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  LLM_PROVIDER: ai-sdk
  LLM_MODEL: gemini-2.0-flash-001
  LLM_API_KEY: ${{ secrets.GOOGLE_GENERATIVE_AI_API_KEY }}
```

AWS Bedrock:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  LLM_PROVIDER: ai-sdk
  LLM_MODEL: us.anthropic.claude-sonnet-4-5-20250929-v1:0
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  AWS_REGION: us-east-1
```

Bedrock model IDs use inference profiles where required, for example `us.anthropic.claude-sonnet-4-5-20250929-v1:0`. Make sure model access is enabled in the Bedrock console for the AWS account and region you use.

## Local Dry Run

Prerequisites:

- Node.js 20+
- GitHub CLI authenticated with `gh auth login`
- `.env` with model credentials

Build:

```bash
npm ci
npm run build
```

List pull requests:

```bash
npm run review -- --list-prs --owner <owner> --repo <repo> --state open --limit 5
```

Dry-run a review:

```bash
npm run review -- --pr 123 --owner <owner> --repo <repo> --dry-run --full --out
```

Dry-run mode prints the overview and inline comments instead of writing to GitHub. With `--out`, output is saved under `dry/` unless you provide a path.

Example `.env` for direct API access:

```bash
GITHUB_TOKEN=
LLM_PROVIDER=ai-sdk
LLM_MODEL=gpt-5-mini
LLM_API_KEY=
```

Example `.env` for Bedrock:

```bash
GITHUB_TOKEN=
LLM_PROVIDER=ai-sdk
LLM_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

## Review Behavior

The reviewer prioritizes bugs, security issues, behavior changes, API contract risks, missing tests, migration risks, and performance problems. It avoids posting low-confidence comments and caps comment volume with `REVIEW_MAX_COMMENTS`.

`custom_mode` keeps the enhanced senior-engineer review path:

- `auto`: enable deeper review for complex code, backend, infra, and configuration changes.
- `on`: always use enhanced review.
- `off`: use the standard review prompt.

Review scopes default to `security,performance,best-practices` and can be changed with `REVIEW_SCOPES`.

## Batching

Large PRs are split into review batches by estimated diff size. This preserves useful context without exceeding model limits, then combines comments from each batch into a single GitHub review. Tune `REVIEW_MAX_REVIEW_CHARS` lower for smaller-context models or higher for models with larger context windows.

## Review Controls

The reviewer recognizes these PR body phrases:

- `@context-engine-reviewer ignore`
- `@context-engine-reviewer skip`
- `@ce-reviewer ignore`
- `@ce-reviewer skip`

New documentation should use the Context Engine Reviewer names.

If `ALLOW_TITLE_UPDATE=true`, the reviewer can update a PR title when the title explicitly mentions `@context-engine-reviewer` or `@ce-reviewer`.

## GitHub Enterprise

Use these settings for GitHub Enterprise Server:

```yaml
env:
  GITHUB_API_URL: https://github.example.com/api/v3
  GITHUB_SERVER_URL: https://github.example.com
```

## Development

```bash
npm ci
npm test
npm run build
npx tsc --noEmit
```

The built GitHub Action entrypoints are emitted into `dist/`.

## License

AGPL-3.0. See [LICENSE](LICENSE).
