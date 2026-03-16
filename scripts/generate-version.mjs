import { execSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const safeExec = (command) => {
  try {
    return execSync(command, { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};

const getPrNumber = (ref) => {
  if (!ref || !ref.startsWith('refs/pull/')) {
    return '';
  }

  const parts = ref.split('/');
  return parts.length >= 3 ? parts[2] : '';
};

const packageJsonPath = resolve(rootDir, 'package.json');
const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

const fullSha = process.env.GITHUB_SHA || safeExec('git rev-parse HEAD') || 'unknown';
const shortSha = fullSha === 'unknown' ? 'unknown' : fullSha.slice(0, 7);
const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || safeExec('git rev-parse --abbrev-ref HEAD') || 'unknown';
const prNumber = getPrNumber(process.env.GITHUB_REF) || process.env.PR_NUMBER || '';
const event = process.env.GITHUB_EVENT_NAME || '';
const source = process.env.CI ? 'ci' : 'local';
const buildTime = new Date().toISOString();
const channel = prNumber || event === 'pull_request'
  ? 'pr'
  : branch === 'main'
    ? 'main'
    : 'branch';

const suffix = prNumber ? ` PR #${prNumber}` : '';
const versionInfo = {
  version: packageJson.version,
  fullSha,
  shortSha,
  branch,
  prNumber,
  event,
  channel,
  source,
  buildTime,
  displayVersion: `v${packageJson.version} (${shortSha})${suffix}`,
};

const targetPath = resolve(rootDir, 'src/generated/version.js');
await mkdir(dirname(targetPath), { recursive: true });

const fileContent = `export const VERSION_INFO = ${JSON.stringify(versionInfo, null, 2)};\n`;
await writeFile(targetPath, fileContent, 'utf8');

console.log(`Generated src/generated/version.js -> ${versionInfo.displayVersion}`);
