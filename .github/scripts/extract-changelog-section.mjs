#!/usr/bin/env node
// Prints the body (heading stripped) of the "## [VERSION] ..." section from
// CHANGELOG.md, for use as GitHub Release notes. Used by
// .github/workflows/release-publish.yml.
import { readFileSync } from 'node:fs';

const [, , changelogPath, version] = process.argv;
if (!changelogPath || !version) {
  console.error('Usage: extract-changelog-section.mjs <CHANGELOG.md> <version>');
  process.exit(1);
}

const lines = readFileSync(changelogPath, 'utf8').split('\n');
const startPattern = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`);

const start = lines.findIndex((l) => startPattern.test(l));
if (start === -1) {
  console.error(`Could not find a "## [${version}]" heading in ${changelogPath}.`);
  process.exit(1);
}

let end = lines.findIndex((l, i) => i > start && (l.startsWith('## [') || /^\[\d/.test(l)));
if (end === -1) end = lines.length;

const body = lines
  .slice(start + 1, end)
  .join('\n')
  .trim();

process.stdout.write(body + '\n');
