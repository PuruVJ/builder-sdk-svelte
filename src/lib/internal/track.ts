/**
 * Tracking — the official protocol (functions/track), browser only: impressions and conversions POST
 * to `${apiHost}/api/v1/track` with the session cookie and visitor id the official SDK uses, so the
 * numbers in Builder keep adding up.
 */
import { is_browser, is_editing } from './env.js';

export const SDK_VERSION = '5.2.0';
export const sdk_headers = () => ({
	'X-Builder-SDK': 'svelte',
	'X-Builder-SDK-GEN': '2',
	'X-Builder-SDK-Version': SDK_VERSION
});

const SESSION_KEY = 'builderSessionId';
const VISITOR_KEY = 'builderVisitorId';

const UUID_TEMPLATE_RE = /[xy]/g;
const DASH_RE = /-/g;
const MOBILE_UA_RE = /Android|BlackBerry|iPhone|iPod|Opera Mini|IEMobile|WPDesktop/i;
const TABLET_UA_RE = /Tablet|iPad/i;

/** A dashless v4 uuid (the official format). */
const uuid = (): string =>
	typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
		? crypto.randomUUID().replace(DASH_RE, '')
		: 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(UUID_TEMPLATE_RE, (c) => {
				const r = (Math.random() * 16) | 0;
				return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
			});

export function get_cookie(name: string, can_track: boolean): string | undefined {
	try {
		if (!can_track) return undefined;
		return document.cookie
			.split('; ')
			.find((row) => row.startsWith(`${name}=`))
			?.split('=')[1];
	} catch {
		return undefined;
	}
}

function top_level_domain(host: string): string {
	if (host === 'localhost' || host === '127.0.0.1') return host;
	const parts = host.split('.');
	return parts.length > 2 ? parts.slice(1).join('.') : host;
}

export function set_cookie(name: string, value: string, can_track: boolean, expires?: Date): void {
	try {
		if (!can_track) return;
		const secure = is_browser() ? location.protocol === 'https:' : true;
		const parts = [
			`${name}=${value}`,
			...(expires ? [`expires=${expires.toUTCString()}`] : []),
			'path=/',
			`domain=${top_level_domain(window.location.hostname)}`,
			...(secure ? ['secure', 'SameSite=None'] : [])
		];
		document.cookie = parts.join('; ');
	} catch {
		/* cookies unavailable */
	}
}

function session_id(can_track: boolean): string | undefined {
	if (!can_track) return undefined;
	const existing = get_cookie(SESSION_KEY, can_track);
	if (existing != null) return existing;
	const id = uuid();
	set_cookie(SESSION_KEY, id, can_track);
	return id;
}

function visitor_id(can_track: boolean): string | undefined {
	if (!can_track) return undefined;
	try {
		const existing = localStorage.getItem(VISITOR_KEY);
		if (existing != null) return existing;
		const id = uuid();
		localStorage.setItem(VISITOR_KEY, id);
		return id;
	} catch {
		return undefined;
	}
}

/** The tracking user attributes (official functions/track/helpers `getUserAttributes`). */
export function get_user_attributes(): Record<string, unknown> {
	const ua = typeof navigator === 'object' ? navigator.userAgent || '' : '';
	const mobile = MOBILE_UA_RE.test(ua);
	const tablet = TABLET_UA_RE.test(ua);
	let url: URL | null = null;
	if (is_browser()) {
		url = new URL(location.href);
		if (url.pathname === '') url.pathname = '/';
	}
	return {
		urlPath: url?.pathname,
		host: url?.host || url?.hostname,
		device: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop'
	};
}

export interface TrackEvent {
	type: string;
	apiKey: string;
	canTrack?: boolean;
	contentId?: string;
	variationId?: string;
	metadata?: Record<string, unknown>;
	apiHost?: string;
	[k: string]: unknown;
}

export async function track({ apiHost, type, canTrack, apiKey, metadata, ...properties }: TrackEvent): Promise<void> {
	if (!apiKey) {
		console.error('[Builder.io]: Missing API key for track call. Please provide your API key.');
		return;
	}
	if (!canTrack || is_editing() || !is_browser()) return;
	const event = {
		type,
		data: {
			...properties,
			metadata: { url: location.href, ...metadata },
			sessionId: session_id(canTrack),
			visitorId: visitor_id(canTrack),
			userAttributes: get_user_attributes(),
			ownerId: apiKey
		}
	};
	await fetch(`${apiHost || 'https://cdn.builder.io'}/api/v1/track`, {
		method: 'POST',
		body: JSON.stringify({ events: [event] }),
		headers: { 'content-type': 'application/json', ...sdk_headers() },
		mode: 'cors'
	}).catch((err) => console.error('Failed to track: ', err));
}

// ── click interactions (official functions/track/interaction.ts) ─────────────────────────────────
const round3 = (n: number) => Math.round(n * 1000) / 1000;

function builder_parent(target: HTMLElement): HTMLElement | null {
	for (let el: HTMLElement | null = target; el; el = el.parentElement) {
		const id = el.getAttribute('builder-id') || el.id;
		if (id && id.indexOf('builder-') === 0) return el;
	}
	return null;
}

function offset(event: MouseEvent, target: HTMLElement) {
	const r = target.getBoundingClientRect();
	return { x: round3((event.clientX - r.left) / r.width), y: round3((event.clientY - r.top) / r.height) };
}

export function interaction_properties(event: MouseEvent) {
	const target = event.target instanceof HTMLElement ? event.target : null;
	const builder_el = target && builder_parent(target);
	const builder_id = builder_el?.getAttribute('builder-id') || builder_el?.id;
	return {
		targetBuilderElement: builder_id || undefined,
		metadata: {
			targetOffset: target ? offset(event, target) : undefined,
			builderTargetOffset: builder_el ? offset(event, builder_el) : undefined,
			builderElementIndex:
				builder_el && builder_id
					? Array.prototype.indexOf.call(document.getElementsByClassName(builder_id), builder_el)
					: undefined
		}
	};
}
