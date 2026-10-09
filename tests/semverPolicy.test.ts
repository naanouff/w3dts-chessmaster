/**
 * @file semverPolicy.test.ts
 * @description Release version and release-note rules.
 */

import { describe, expect, it } from 'vitest';
import { githubReleasePlan, semverProblems } from '../scripts/semverPolicy.mjs';

describe('semver policy', () => {
  it('accepts a strict version and rejects a suffix or a short number', () => {
    expect(semverProblems('develop', '0.1.0', null)).toEqual([]);
    expect(semverProblems('develop', '0.1.0-dev', null).join(' ')).toMatch(/0\.1\.0-dev/);
    expect(semverProblems('develop', '1.2', null).join(' ')).toMatch(/1\.2/);
  });

  it('requires the release branch name to match package.json', () => {
    expect(semverProblems('release/0.2.0', '0.2.0', 'Notes.')).toEqual([]);
    expect(semverProblems('release/0.2.0', '0.1.0', 'Notes.').join(' ')).toMatch(/0\.2\.0/);
  });

  it('requires a non-empty release note only on a release branch', () => {
    expect(semverProblems('release/0.2.0', '0.2.0', null).join(' ')).toMatch(/docs\/releases\/0\.2\.0\.md/);
    expect(semverProblems('release/0.2.0', '0.2.0', '   ').join(' ')).toMatch(/empty/);
    expect(semverProblems('develop', '0.1.0', null)).toEqual([]);
    expect(semverProblems('main', '0.1.0', null)).toEqual([]);
    expect(semverProblems('feature/chess-b13', '0.1.0', null)).toEqual([]);
  });

  it('publishes the installer on main when that tag does not exist yet', () => {
    expect(githubReleasePlan('main', '0.2.0', 'Première note.', false)).toEqual({
      publish: true,
      problems: [],
    });
  });

  it('does not publish a second release when the tag already exists', () => {
    expect(githubReleasePlan('main', '0.1.0', 'Première note.', true)).toEqual({
      publish: false,
      problems: [],
    });
  });

  it('does not publish from a release branch or from develop', () => {
    expect(githubReleasePlan('release/0.2.0', '0.2.0', 'Notes.', false).publish).toBe(false);
    expect(githubReleasePlan('develop', '0.1.0', null, false).publish).toBe(false);
  });

  it('refuses to publish main without a strict version and a non-empty note', () => {
    expect(githubReleasePlan('main', '0.2.0', null, false).problems.join(' ')).toMatch(/docs\/releases\/0\.2\.0\.md/);
    expect(githubReleasePlan('main', '0.2.0', '   ', false).problems.join(' ')).toMatch(/empty/);
    expect(githubReleasePlan('main', '0.2', 'Notes.', false).publish).toBe(false);
  });
});
