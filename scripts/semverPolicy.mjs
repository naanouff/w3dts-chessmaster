/**
 * @file semverPolicy.mjs
 * @project w3dts
 * @author Cyril TARRIET
 * @description Release version and release-note checks for GitFlow.
 */

import { readFileSync } from 'node:fs';

const STRICT_VERSION = /^\d+\.\d+\.\d+$/;
const RELEASE_BRANCH = /^release\/(\d+\.\d+\.\d+)$/;

/**
 * Problems that block a ref. Empty when the version is strict and, on a release branch, the note matches.
 * @param {string} refName - Branch name, such as `release/0.2.0` or `develop`.
 * @param {string} version - `package.json` version.
 * @param {string | null} releaseNote - Note body. `null` when the file is absent. Ignored off release branches.
 * @returns {string[]}
 */
export function semverProblems(refName, version, releaseNote) {
  /** @type {string[]} */
  const problems = [];
  if (!STRICT_VERSION.test(version)) {
    problems.push(`version ${version} is not MAJOR.MINOR.PATCH`);
  }
  const release = RELEASE_BRANCH.exec(refName);
  if (!release) return problems;
  const expected = release[1];
  if (version !== expected) {
    problems.push(`release/${expected} requires version ${expected}`);
  }
  const notePath = `docs/releases/${expected}.md`;
  if (releaseNote === null) problems.push(`${notePath} is missing`);
  else if (releaseNote.trim() === '') problems.push(`${notePath} is empty`);
  return problems;
}

/**
 * Whether a push to `main` should open the GitHub release for this version.
 * A release or feature branch never publishes. An existing tag is left as it is.
 * @param {string} refName - Branch name, such as `main`.
 * @param {string} version - `package.json` version.
 * @param {string | null} releaseNote - Note body. `null` when the file is absent.
 * @param {boolean} tagExists - True when `v` + version is already on the remote.
 * @returns {{ publish: boolean, problems: string[] }}
 */
export function githubReleasePlan(refName, version, releaseNote, tagExists) {
  if (refName !== 'main') return { publish: false, problems: [] };
  /** @type {string[]} */
  const problems = [];
  if (!STRICT_VERSION.test(version)) {
    problems.push(`version ${version} is not MAJOR.MINOR.PATCH`);
    return { publish: false, problems };
  }
  const notePath = `docs/releases/${version}.md`;
  if (releaseNote === null) problems.push(`${notePath} is missing`);
  else if (releaseNote.trim() === '') problems.push(`${notePath} is empty`);
  if (problems.length > 0 || tagExists) return { publish: false, problems };
  return { publish: true, problems: [] };
}

/**
 * Read `package.json` and, on a release branch, the matching note, then print problems.
 * @param {string} refName - Branch name passed by CI.
 * @param {string} [root] - Repository root. Defaults to the process working directory.
 * @returns {number} Process status, `0` when the ref is allowed.
 */
export function checkSemverRef(refName, root = process.cwd()) {
  const pkg = JSON.parse(readFileSync(`${root}/package.json`, 'utf8'));
  const release = RELEASE_BRANCH.exec(refName);
  /** @type {string | null} */
  let releaseNote = null;
  if (release) {
    try {
      releaseNote = readFileSync(`${root}/docs/releases/${release[1]}.md`, 'utf8');
    } catch {
      releaseNote = null;
    }
  }
  const problems = semverProblems(refName, pkg.version, releaseNote);
  for (const problem of problems) console.error(problem);
  return problems.length === 0 ? 0 : 1;
}

/**
 * Print `publish` or `skip` for a push to main. Problems go to stderr.
 * @param {string} refName - Branch name passed by CI.
 * @param {boolean} tagExists - True when the version tag is already on the remote.
 * @param {string} [root] - Repository root.
 * @returns {number} Process status, `0` when the plan is usable.
 */
export function checkGithubRelease(refName, tagExists, root = process.cwd()) {
  const pkg = JSON.parse(readFileSync(`${root}/package.json`, 'utf8'));
  let releaseNote = null;
  if (STRICT_VERSION.test(pkg.version)) {
    try {
      releaseNote = readFileSync(`${root}/docs/releases/${pkg.version}.md`, 'utf8');
    } catch {
      releaseNote = null;
    }
  }
  const plan = githubReleasePlan(refName, pkg.version, releaseNote, tagExists);
  for (const problem of plan.problems) console.error(problem);
  if (plan.problems.length > 0) return 1;
  console.log(plan.publish ? 'publish' : 'skip');
  return 0;
}

const invoked = process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/semverPolicy.mjs');
if (invoked) {
  if (process.argv[2] === '--publish') {
    const status = checkGithubRelease(process.argv[3] ?? '', process.argv[4] === 'yes');
    process.exit(status);
  }
  const status = checkSemverRef(process.argv[2] ?? '');
  process.exit(status);
}
