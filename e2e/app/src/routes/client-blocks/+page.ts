// test-only: tests/client-interactions.test.ts
import { PAGES } from '@sdk/tests';
import { CONTENTS } from './contents';

export function load({ url }) {
	const name = url.searchParams.get('c') ?? '';
	if (name === 'tabs-collapsible') {
		const tabs = JSON.parse(JSON.stringify(PAGES['/tabs'].content));
		const walk = (v: any) => {
			if (!v || typeof v !== 'object') return;
			if (v.component?.name === 'Builder: Tabs') v.component.options.collapsible = true;
			for (const k in v) walk(v[k]);
		};
		walk(tabs);
		return { content: { ...tabs, id: 'client-tabs-collapsible' } };
	}
	return { content: CONTENTS[name] ?? null };
}
