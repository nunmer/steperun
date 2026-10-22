/**
 * The daily scrape runs as a GitHub Actions workflow. With GITHUB_ACTIONS_TOKEN
 * (fine-grained, this repo, Actions: read & write) set on the Vercel project,
 * the admin overview lists recent runs and can start one.
 */

const WORKFLOW = "scrape-results.yml";
const API = "https://api.github.com";

export function githubRepo(): string {
  return process.env.GITHUB_REPO || "nunmer/steperun";
}

export function githubEnabled(): boolean {
  return !!process.env.GITHUB_ACTIONS_TOKEN;
}

function headers(): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${process.env.GITHUB_ACTIONS_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  event: string;
  created_at: string;
  html_url: string;
}

export async function recentScrapeRuns(limit = 5): Promise<WorkflowRun[]> {
  const res = await fetch(`${API}/repos/${githubRepo()}/actions/workflows/${WORKFLOW}/runs?per_page=${limit}`, {
    headers: headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const body = (await res.json()) as { workflow_runs?: WorkflowRun[] };
  return body.workflow_runs ?? [];
}

export async function dispatchScrape(inputs: { min_year?: string; athletex_backfill_from?: string }): Promise<void> {
  const res = await fetch(`${API}/repos/${githubRepo()}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs }),
    signal: AbortSignal.timeout(8000),
  });
  if (res.status !== 204) throw new Error(`GitHub refused the run (${res.status}).`);
}
