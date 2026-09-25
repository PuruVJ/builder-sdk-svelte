/** Run the `<script>`s inside injected HTML (official CustomCode / Embed `runScripts`), once each. */
const JS_TYPES = new Set(['text/javascript', 'application/javascript', 'application/ecmascript']);

export function run_scripts(el: HTMLElement | undefined, inserted: string[], run: string[], label: string): void {
	if (!el?.getElementsByTagName || typeof window === 'undefined') return;
	const scripts = el.getElementsByTagName('script');
	for (let i = 0; i < scripts.length; i++) {
		const script = scripts[i];
		if (script.src) {
			if (inserted.includes(script.src)) continue;
			inserted.push(script.src);
			const s = document.createElement('script');
			s.async = true;
			s.src = script.src;
			document.head.appendChild(s);
		} else if (!script.type || JS_TYPES.has(script.type)) {
			if (run.includes(script.innerText)) continue;
			try {
				run.push(script.innerText);
				new Function(script.innerText)();
			} catch (error) {
				console.warn(`[Builder.io]: [BUILDER.IO] \`${label}\`: Error running script:`, error);
			}
		}
	}
}
