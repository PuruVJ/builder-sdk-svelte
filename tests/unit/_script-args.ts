/**
 * The calls an inline script makes: run it against a stub `window` that records every call.
 * For comparing a script made safe for its tag (tags.ts `script_safe`, JSON-quoted ids) with the
 * official text it means: the same calls with the same arguments.
 */
export function script_calls(js: string): unknown[][] {
	const calls: unknown[][] = [];
	const window = new Proxy({}, { get: (_t, name) => (...args: unknown[]) => void calls.push([name, ...args]) });
	new Function('window', js)(window);
	return calls;
}

/** A plain id / locale / content: the official bytes apply as they are. */
export const is_plain = (...parts: unknown[]) =>
	parts.every((p) => p === undefined || !/["\\  ]|<\/script|<!--/i.test(typeof p === 'string' ? p : JSON.stringify(p)));

const S = 'script';
/** No `</script` or `<!--` that would end or confuse the tag. */
export const breaks_tag = (js: string) => new RegExp('</' + S + '|<!--', 'i').test(js);
