import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const source = resolve('cloudflare/_redirects.pages');
const target = resolve('dist/_redirects');

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);

console.log('Prepared dist/_redirects for Cloudflare Pages deploy.');
