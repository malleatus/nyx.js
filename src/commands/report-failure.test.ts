import { Octokit } from '@octokit/rest';
import FakeTimers, { FakeClock } from '@sinonjs/fake-timers';
import setupHardRejection from 'hard-rejection';
import { setupPolly } from '../__utils__/polly';
import reportFailure from './report-failure';

const GITHUB_AUTH = process.env.GITHUB_AUTH_MALLEATUS_USER_A;

setupHardRejection();

describe('src/commands/report-failure.ts', function () {
  let github: Octokit;
  let clock: FakeClock;

  beforeEach(() => {
    github = new Octokit({
      auth: GITHUB_AUTH,
      userAgent: '@malleatus/nyx failure reporter',
    });
    clock = FakeTimers.install({
      now: new Date('3 April 1994 13:14 GMT'),
    });
  });

  afterEach(async () => {
    clock.uninstall();
  });

  test('creates an issue', async function () {
    setupPolly('basic-test');

    let issues = await github.issues.listForRepo({
      owner: 'malleatus',
      repo: 'nyx-example',
      labels: 'CI',
      state: 'open',
    });

    expect(issues.data.length).toEqual(0);

    await reportFailure({
      owner: 'malleatus',
      repo: 'nyx-example',
      runId: '123456',
      token: GITHUB_AUTH || 'fake-auth-token',
    });

    issues = await github.issues.listForRepo({
      owner: 'malleatus',
      repo: 'nyx-example',
      labels: 'CI',
      state: 'open',
    });

    // TODO: clean up the cleanup
    for (let issue of issues.data) {
      await github.issues.update({
        owner: 'malleatus',
        repo: 'nyx-example',
        // eslint-disable-next-line @typescript-eslint/camelcase
        issue_number: issue.number,
        state: 'closed',
      });
    }

    expect(issues.data.length).toEqual(1);
    // TODO: update description
    // https://github.com/malleatus/nyx-example/issues/163
    expect(issues.data[0].body).toMatchInlineSnapshot(`
      "
      Nightly run failures since last success:
      |Date | Run|
      |----|:--:|
      | 1994-04-03 | [run 123456](https://github.com/malleatus/nyx-example/actions/runs/123456)|"
    `);
  });

  // TODO: update existing issue for subsequent failure
});
