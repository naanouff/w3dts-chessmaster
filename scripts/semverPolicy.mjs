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

const invoked = process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/semverPolicy.mjs');
if (invoked) {
  const status = checkSemverRef(process.argv[2] ?? '');
  process.exit(status);
}
