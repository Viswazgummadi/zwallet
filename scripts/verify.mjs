#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Canonical quality-gate runner (ADR 0011). Same gates locally (Windows) and in CI (Linux).
//
//   node scripts/verify.mjs all|contracts|web|android [--only <gate-substring>] [--keep-going]
//
// Every gate is spawned with an argument array (the repo path contains a space). Output goes to
// a log file under os.tmpdir(); on failure the log tail is printed. Exits non-zero if any gate
// fails.

import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = path.join(ROOT, 'apps', 'android');
const isWin = process.platform === 'win32';

// --fail-if-no-match: a filter that matches nothing must fail, not pass vacuously.
const pnpm = (...args) => ({
  cmd: 'pnpm',
  args: args[0] === '--filter' ? ['--fail-if-no-match', ...args] : args,
  cwd: ROOT,
});
const gradle = (...args) => ({
  cmd: isWin ? 'gradlew.bat' : './gradlew',
  args: ['--console=plain', ...args],
  cwd: ANDROID,
  requires: path.join(ANDROID, 'settings.gradle.kts'),
});

/** @type {Record<string, Array<{name: string} & ReturnType<typeof pnpm>>>} */
const TRACKS = {
  contracts: [
    { name: 'contracts: schema, merge groups, seeds, vectors', ...pnpm('--filter', '@zwallet/contracts', 'test') },
    { name: 'contracts: generated code up to date', ...pnpm('--filter', '@zwallet/contracts', 'codegen:check') },
    { name: 'contracts: vectors up to date', ...pnpm('--filter', '@zwallet/contracts', 'vectors:check') },
    { name: 'design-tokens: tests', ...pnpm('--filter', '@zwallet/design-tokens', 'test') },
    { name: 'design-tokens: generated output up to date', ...pnpm('--filter', '@zwallet/design-tokens', 'build:check') },
  ],
  web: [
    { name: 'web: lint', ...pnpm('--filter', 'web', 'lint') },
    { name: 'web: typecheck', ...pnpm('--filter', 'web', 'typecheck') },
    { name: 'web: unit tests', ...pnpm('--filter', 'web', 'test') },
    { name: 'web: build', ...pnpm('--filter', 'web', 'build') },
    { name: 'web: bundle budget (≤ 180 KB gzip initial JS)', ...pnpm('--filter', 'web', 'size') },
    { name: 'web: e2e (screens, zero egress, CSP)', ...pnpm('--filter', 'web', 'e2e') },
  ],
  android: [
    { name: 'android: ktlint', ...gradle('ktlintCheck') },
    { name: 'android: unit tests', ...gradle('test') },
    { name: 'android: screenshot tests (Roborazzi)', ...gradle('verifyRoborazziDebug') },
    { name: 'android: assemble debug + release', ...gradle(':app:assembleDebug', ':app:assembleRelease') },
    { name: 'android: no network permission', ...gradle(':app:checkNoNetworkPermission') },
    { name: 'android: APK size budget', ...gradle(':app:checkApkSize') },
  ],
};

const argv = process.argv.slice(2);
const track = argv[0] ?? 'all';
const onlyIdx = argv.indexOf('--only');
const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : undefined;
const keepGoing = argv.includes('--keep-going') || process.env.CI === 'true';

const selected =
  track === 'all'
    ? ['contracts', 'web', 'android']
    : track.split(',').filter((t) => {
        if (!TRACKS[t]) {
          console.error(`Unknown track "${t}". Use: all | ${Object.keys(TRACKS).join(' | ')}`);
          process.exit(2);
        }
        return true;
      });

function androidEnv() {
  const env = { ...process.env };
  if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT) {
    const guess = isWin
      ? path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
      : path.join(os.homedir(), 'Android', 'Sdk');
    if (existsSync(guess)) env.ANDROID_HOME = guess;
  }
  return env;
}

const logDir = mkdtempSync(path.join(os.tmpdir(), 'zwallet-verify-'));

function run(gate, index) {
  return new Promise((resolve) => {
    const logFile = path.join(logDir, `${String(index).padStart(2, '0')}.log`);
    const out = createWriteStream(logFile);
    const started = Date.now();
    // .cmd/.bat need a shell on Windows; our args never contain spaces (cwd is passed separately).
    const child = spawn(gate.cmd, gate.args, {
      cwd: gate.cwd,
      env: gate.cwd === ANDROID ? androidEnv() : process.env,
      shell: isWin,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(out, { end: false });
    child.stderr.pipe(out, { end: false });
    child.on('error', (err) => {
      out.write(String(err));
    });
    child.on('close', (code) => {
      out.end(() => resolve({ code: code ?? 1, ms: Date.now() - started, logFile }));
    });
  });
}

function tail(file, lines = 40) {
  try {
    return readFileSync(file, 'utf8').trimEnd().split(/\r?\n/).slice(-lines).join('\n');
  } catch {
    return '(no log)';
  }
}

async function ensureInstalled(results) {
  if (existsSync(path.join(ROOT, 'node_modules', '.modules.yaml'))) return true;
  const gate = { name: 'pnpm install --frozen-lockfile', ...pnpm('install', '--frozen-lockfile') };
  process.stdout.write(`▶ ${gate.name}\n`);
  const r = await run(gate, 0);
  results.push({ name: gate.name, ...r });
  return r.code === 0;
}

const results = [];
let failed = false;
const needsNode = selected.some((t) => t !== 'android');
if (needsNode && !(await ensureInstalled(results))) failed = true;

let i = 1;
for (const t of selected) {
  for (const gate of TRACKS[t]) {
    if (only && !gate.name.includes(only)) continue;
    if (failed && !keepGoing) {
      results.push({ name: gate.name, code: null, ms: 0 });
      continue;
    }
    if (gate.requires && !existsSync(gate.requires)) {
      results.push({ name: gate.name, code: 'missing', ms: 0 });
      failed = true;
      continue;
    }
    process.stdout.write(`▶ ${gate.name}\n`);
    const r = await run(gate, i++);
    results.push({ name: gate.name, ...r });
    if (r.code !== 0) {
      failed = true;
      console.log(`\n✗ ${gate.name} failed (exit ${r.code}). Last lines of ${r.logFile}:\n`);
      console.log(tail(r.logFile));
      console.log('');
    }
  }
}

const label = (r) =>
  r.code === 0 ? 'PASS' : r.code === null ? 'SKIP' : r.code === 'missing' ? 'MISSING' : 'FAIL';
const width = Math.max(...results.map((r) => r.name.length), 4);
console.log(`\n${'gate'.padEnd(width)}  result  time`);
console.log(`${'-'.repeat(width)}  ------  ------`);
for (const r of results) {
  console.log(`${r.name.padEnd(width)}  ${label(r).padEnd(6)}  ${(r.ms / 1000).toFixed(1)}s`);
}
console.log(`\nlogs: ${logDir}`);
process.exit(failed ? 1 : 0);
