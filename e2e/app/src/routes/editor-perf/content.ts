// test-only: tests/editor-perf.test.ts — a production-sized page: N sections, each a Card (custom
// component), two Text blocks and a Columns with a Card and a Text per column.
const el = (id: string, rest: Record<string, unknown>) => ({ '@type': '@builder.io/sdk:Element', id, ...rest });

export function perf_content(sections: number) {
	const blocks = [];
	for (let i = 0; i < sections; i++) {
		blocks.push(
			el(`builder-s${i}`, {
				responsiveStyles: { large: { display: 'flex', flexDirection: 'column', marginTop: '4px' } },
				children: [
					el(`builder-c${i}`, { component: { name: 'Card', options: { title: `card ${i}`, items: [{ a: i }, { b: [i, i] }] } } }),
					el(`builder-t${i}`, { component: { name: 'Text', options: { text: `<p>text ${i}</p>` } } }),
					el(`builder-u${i}`, { component: { name: 'Text', options: { text: `<p>more ${i}</p>` } } }),
					el(`builder-col${i}`, {
						component: {
							name: 'Columns',
							options: {
								columns: [0, 1].map((j) => ({
									blocks: [
										el(`builder-cc${i}-${j}`, { component: { name: 'Card', options: { title: `col card ${i}-${j}` } } }),
										el(`builder-ct${i}-${j}`, { component: { name: 'Text', options: { text: `<p>col ${i}-${j}</p>` } } })
									]
								}))
							}
						}
					})
				]
			})
		);
	}
	return { id: 'editor-perf', data: { blocks } };
}
