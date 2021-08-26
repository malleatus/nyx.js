// https://octokit.github.io/rest.js/v17#issues-list
import { Octokit } from '@octokit/rest';
import m from 'moment';

const IssuePrefix = 'Nightly Run Failure';

function getIssueTitle(runId: string): string {
  return `${IssuePrefix}: ${runId}`;
}

interface CreateIssueArgs {
  github: Octokit;
  runId: string;
  owner: string;
  repo: string;
}

// TODO: make `last success` a link to last successful run
// or say no success if so
function createNightlyRunTable(runFailures: [string, string][]): string {
  return runFailures.reduce(
    (acc, [dateStr, url]) => {
      return `${acc}\n| ${dateStr} | ${url}|`;
    },
    `
Nightly run failures since last success:
|Date | Run|
|----|:--:|`
  );
}

// TODO: report commit range
// TODO: even more betterer bisect commit range (possibly as a separate workflow)
async function createIssue({ github, runId, owner, repo }: CreateIssueArgs): Promise<void> {
  const title = getIssueTitle(runId);
  // TODO: use format instead
  const date = m().toISOString().substring(0, 10);
  const url = `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
  const markdownLink = `[run ${runId}](${url})`;
  const body = createNightlyRunTable([[date, markdownLink]]);

  await github.issues.create({
    owner,
    repo,
    title,
    body,
    labels: ['CI'],
  });
}

interface MainArgs {
  owner: string;
  repo: string;
  runId: string;
  token: string;
}

export default async function reportFailure({
  owner,
  repo,
  token,
  runId,
}: MainArgs): Promise<void> {
  const github = new Octokit({
    auth: token,
    userAgent: '@malleatus/nyx failure reporter',
  });

  // https://help.github.com/en/github/searching-for-information-on-github/searching-issues-and-pull-requests
  const issueSearch = await github.search.issuesAndPullRequests({
    q: `repo:${owner}/${repo} state:open is:issue label:CI in:title "${IssuePrefix}"`,
  });

  if (issueSearch.data.total_count > 0) {
    const issueNumber = issueSearch.data.items[0].number;
    console.log(`Issue ${issueNumber} already exists summarizing nightly failures`);
    return;
  }

  await createIssue({ github, runId, owner, repo });
}
