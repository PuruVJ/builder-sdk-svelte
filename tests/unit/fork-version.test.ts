// The version says what this is: `<official>-fork.<N>` — a fork of that official release, our Nth
// release. Everything that names the official release must agree with it, so a rebase onto a newer
// official SDK cannot be half done (.changeset/README.md).
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SDK_VERSION } from '../../src/lib/internal/track.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const FORK_RE = /^(\d+\.\d+\.\d+)-fork\.(\d+)$/;
const base = pkg.version.match(FORK_RE)?.[1];

describe('the fork version', () => {
	it('is <official>-fork.<N>', () => {
		expect(pkg.version).toMatch(FORK_RE);
	});
	it('names the official release the dev dependency (and the parity tests) run against', () => {
		expect(pkg.devDependencies['@builder.io/sdk-svelte']).toBe(base);
		const installed = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/@builder.io/sdk-svelte/package.json'), 'utf8')).version;
		expect(installed).toBe(base);
	});
	it('is the version the editor and the Content API are told (sdkInfo, X-Builder-SDK-Version)', () => {
		expect(SDK_VERSION).toBe(base);
	});
	it('is the release the official types were vendored from (scripts/vendor-official-types.mjs)', () => {
		const vendored = fs.readFileSync(path.join(ROOT, 'src/lib/official/types/builder-block.ts'), 'utf8');
		expect(vendored).toContain(`@builder.io/sdk-svelte@${base} `);
	});
	it('stays in changesets pre-release mode with the tag `fork` (each release bumps only N)', () => {
		const pre = JSON.parse(fs.readFileSync(path.join(ROOT, '.changeset/pre.json'), 'utf8'));
		expect(pre).toMatchObject({ mode: 'pre', tag: 'fork' });
	});
});
