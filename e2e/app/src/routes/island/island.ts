import { render } from 'svelte/server';
import type { Component } from 'svelte';

/** The component's server HTML as its own root, inheriting the contexts it renders in — how an island renders. */
export function island_html(component: Component<any>, props: Record<string, unknown>, context: Map<unknown, unknown>): string {
	return render(component, { props, context }).body;
}
