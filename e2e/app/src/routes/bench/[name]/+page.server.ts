// BENCH-ONLY route (not part of the official e2e app): serves a fixture as page data, the way an app
// passes fetched Builder content to <Content>. FIXTURES_DIR is set by bench/client.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { error } from '@sveltejs/kit';

const ELEMENT = '@builder.io/sdk:Element';

export function load({ params }) {
	const dir = process.env.FIXTURES_DIR;
	if (!dir) error(500, 'FIXTURES_DIR not set');
	// `real__fr-fr.pageContent` → <FIXTURES_DIR>/real/fr-fr.pageContent.json
	const file = path.join(dir, params.name.replaceAll('..', '').replace('__', '/') + '.json');
	if (!fs.existsSync(file)) error(404, 'no fixture');
	const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
	const content = spec.content ?? spec;
	const names = new Set<string>();
	(function walk(v: any) {
		if (!v || typeof v !== 'object') return;
		if (v['@type'] === ELEMENT && v.component?.name) names.add(v.component.name);
		for (const k in v) walk(v[k]);
	})(content);
	// render props only from a generated spec { content, data, locale } (a captured content's .data is its own)
	return { content, names: [...names].sort(), data: spec.content ? spec.data : undefined, locale: spec.content ? spec.locale : undefined };
}
