/**
 * DOM test helpers. Node 26 defines its own `localStorage` global (undefined without
 * `--localstorage-file`), which shadows happy-dom's: tests install an in-memory one.
 */
export class MemoryStorage {
	#items = new Map<string, string>();
	get length() {
		return this.#items.size;
	}
	key(i: number) {
		return [...this.#items.keys()][i] ?? null;
	}
	getItem(key: string) {
		return this.#items.has(key) ? this.#items.get(key)! : null;
	}
	setItem(key: string, value: string) {
		this.#items.set(key, String(value));
	}
	removeItem(key: string) {
		this.#items.delete(key);
	}
	clear() {
		this.#items.clear();
	}
}

export function install_local_storage(): MemoryStorage {
	const storage = new MemoryStorage();
	Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => storage });
	return storage;
}

export const set_url = (path: string) => window.history.replaceState({}, '', path);

export function clear_cookies(): void {
	for (const c of document.cookie.split('; ')) if (c) document.cookie = c.split('=')[0] + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

/** Make the page look framed (`window.top !== window.self`) while `fn` runs. */
export async function in_iframe<T>(fn: () => T | Promise<T>): Promise<T> {
	const top = Object.getOwnPropertyDescriptor(window, 'top');
	Object.defineProperty(window, 'top', { configurable: true, get: () => ({}) });
	try {
		return await fn();
	} finally {
		if (top) Object.defineProperty(window, 'top', top);
		else delete (window as { top?: unknown }).top;
	}
}
