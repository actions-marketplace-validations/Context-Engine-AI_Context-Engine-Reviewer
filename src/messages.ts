import { context } from "@actions/github";
import { FileDiff } from "./diff";
import { AIComment, PullRequestSummary } from "./prompts";
import { Context } from "@actions/github/lib/context";
import config from "./config";

export const OVERVIEW_MESSAGE_SIGNATURE =
  "\n<!-- context-engine-reviewer: overview message -->";

export const COMMENT_SIGNATURE = "\n<!-- context-engine-reviewer: comment -->";
export const DOCUMENTATION_SIGNATURE = "\n<!-- context-engine-reviewer: documentation -->";

export const PAYLOAD_TAG_OPEN = "\n<!-- context-engine-reviewer: payload --";
export const PAYLOAD_TAG_CLOSE = "\n-- context-engine-reviewer: payload -->";

function getCommitUrl(
  serverUrl: string,
  owner: string,
  repo: string,
  sha: string
): string {
  // Remove trailing slash if present
  const baseUrl = serverUrl.endsWith("/") ? serverUrl.slice(0, -1) : serverUrl;
  return `${baseUrl}/${owner}/${repo}/commit/${sha}`;
}

export function buildLoadingMessage(
  baseCommit: string,
  commits: {
    sha: string;
    commit: {
      message: string;
    };
  }[],
  fileDiffs: FileDiff[]
): string {
  const { owner, repo } = context.repo;

  let message = `⏳ **Analyzing changes in this PR...** ⏳\n\n`;
  message += `_This might take a few minutes, please wait_\n\n`;

  // Group files by operation
  message += `<details>\n<summary>📥 Commits</summary>\n\n`;
  message += `Analyzing changes from base (\`${baseCommit.slice(
    0,
    7
  )}\`) to latest commit (\`${commits[commits.length - 1].sha.slice(
    0,
    7
  )}\`):\n`;

  for (const commit of commits.reverse()) {
    message += `- [${commit.sha.slice(0, 7)}](${getCommitUrl(
      config.githubServerUrl,
      owner,
      repo,
      commit.sha
    )}): ${commit.commit.message}\n`;
  }

  message += "\n\n</details>\n\n";

  message += `<details>\n<summary>📁 Files being considered (${fileDiffs.length})</summary>\n\n`;
  for (const diff of fileDiffs) {
    let prefix = "🔄"; // Modified
    if (diff.status === "added") prefix = "➕";
    if (diff.status === "removed") prefix = "➖";
    if (diff.status === "renamed") prefix = "📝";

    let fileText = `${prefix} ${diff.filename}`;
    if (diff.status === "renamed") {
      fileText += ` (from ${diff.previous_filename})`;
    }
    fileText += ` _(${diff.hunks.length} ${
      diff.hunks.length === 1 ? "hunk" : "hunks"
    })_`;
    message += `${fileText}\n`;
  }
  message += "\n</details>\n\n";

  // Removed visible footer line to keep comments clean; retain hidden signature below
  message += OVERVIEW_MESSAGE_SIGNATURE;

  return message;
}

export function buildOverviewMessage(
  summary: PullRequestSummary,
  commits: string[],
  fileDiffs: FileDiff[],
  rationale?: string
): string {
  const desc = (summary.description || "").replace(/\s+/g, " ").trim();
  const shortDesc = desc.length > 500 ? desc.slice(0, 497) + "..." : desc;

  const counters: Record<string, number> = {};
  const inc = (k: string) => (counters[k] = (counters[k] || 0) + 1);

  const apiFiles: string[] = [];
  const testsTouched: string[] = [];
  const migrationsTouched: string[] = [];
  const configTouched: string[] = [];
  const docsTouched: string[] = [];

  const pushUnique = (arr: string[], value: string) => {
    if (value && !arr.includes(value)) arr.push(value);
  };

  for (const f of fileDiffs) {
    const n = f.filename;
    const lower = n.toLowerCase();

    if (/(^|\/)(__tests__|tests?|specs?)(\/|$)/.test(lower) || /\.(test|spec)\.[jt]sx?$/.test(lower)) {
      inc("Tests");
      pushUnique(testsTouched, n);
    } else if (lower.includes("/migrations/") || /\.(sql|ddl)$/i.test(n)) {
      inc("Migrations");
      pushUnique(migrationsTouched, n);
    } else if (/\.(md|mdx|rst|txt)$/i.test(n) || lower.includes("/docs/")) {
      inc("Docs");
      pushUnique(docsTouched, n);
    } else if (
      /\.(ya?ml|json|toml|ini|env|hcl)$/i.test(n) ||
      lower.endsWith("dockerfile") ||
      lower.includes("docker-compose") ||
      lower.includes("/.github/")
    ) {
      inc("Config");
      pushUnique(configTouched, n);
    } else if (/(^|\/)(api|routes|controllers|handlers|server|services)(\/|$)/.test(lower)) {
      inc("API");
      pushUnique(apiFiles, n);
    } else if (/\.(ts|tsx|js|jsx|py|go|rs|java|kt|cs|cpp|c|rb|php|swift)$/i.test(n)) {
      inc("Source");
    } else {
      inc("Other");
    }
  }

  const categorySummary = Object.entries(counters)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => `${k}(${v})`)
    .join(", ");

  const list = (arr: string[]) => {
    if (!arr.length) return "";
    return arr.slice(0, 12).join(", ") + (arr.length > 12 ? `, +${arr.length - 12} more` : "");
  };

  let message = `PR Summary: ${shortDesc}\n\n`;
  message += `Scope: ${fileDiffs.length} files changed` + (categorySummary ? `; ${categorySummary}` : "") + `\n\n`;

  const bullets: string[] = [];
  if (apiFiles.length) bullets.push(`API/service files changed: ${list(apiFiles)}`);
  if (migrationsTouched.length) bullets.push(`Migrations changed: ${list(migrationsTouched)}`);
  if (testsTouched.length) bullets.push(`Tests changed: ${list(testsTouched)}`);
  if (configTouched.length) bullets.push(`Configuration changed: ${list(configTouched)}`);
  if (docsTouched.length) bullets.push(`Documentation changed: ${list(docsTouched)}`);

  if (bullets.length) {
    message += `Highlights:\n- ` + bullets.join(`\n- `) + `\n\n`;
  }

  // Optional combined rationale/release-notes block
  if (rationale && rationale.trim().length > 0) {
    let r = rationale.trim();
    // Strip any leading duplicate heading the model may include
    r = r.replace(/^\s*(summary\/rationale|rationale)\s*:\s*/i, "");
    r = r.replace(/^\s*(summary\/rationale|rationale)\s*:?[\r\n]+/i, "");
    message += `Rationale:\n\n${r}\n\n`;
  }

  const payload = { commits: commits };
  // Removed visible footer line; keep hidden signature and payload for upsert/machine parsing
  message += OVERVIEW_MESSAGE_SIGNATURE;
  message += PAYLOAD_TAG_OPEN;
  message += JSON.stringify(payload);
  message += PAYLOAD_TAG_CLOSE;

  return message;
}

export function buildReviewSummary(
  context: Context,
  files: FileDiff[],
  commits: {
    sha: string;
    commit: {
      message: string;
    };
  }[],
  actionableComments: AIComment[],
  skippedComments: AIComment[],
  documentation?: string
) {
  // Minimal review body: prefer documentation block; otherwise note inline comments.
  const doc = documentation && documentation.trim().length > 0 ? documentation.trim() + "\n\n" : "Inline review comments have been posted.\n\n";
  return doc;
}
