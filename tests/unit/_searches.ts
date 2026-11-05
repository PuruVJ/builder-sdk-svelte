/** Search inputs for the env tests (server and browser). */
export const SEARCHES: unknown[] = [
	undefined,
	'',
	'?builder.preview=page',
	'builder.preview=',
	'?x=1&builder.frameEditing=page',
	'?builder.previewx=1',
	'?builderpreview=1',
	new URLSearchParams('builder.preview=page'),
	new URLSearchParams('builder.frameEditing=page&a=1'),
	new URLSearchParams(''),
	{ 'builder.preview': 'page' },
	{ 'builder.frameEditing': ['a', 'b'] },
	{ other: '1' },
	{},
	{ 'builder.preview': '' },
	{ '✓': 'ü', 'builder.preview': 'x y' }
];
