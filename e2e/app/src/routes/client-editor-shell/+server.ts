// test-only: tests/client-harness.ts `in_editor` — a blank page to be the editor-shaped parent frame,
// served for real (Chrome's local-network checks block a page Playwright synthesises from framing
// localhost once their origins differ: the untrusted-parent tests serve it from 127.0.0.1)
export const GET = () => new Response('<!doctype html><body style="margin:0"></body>', { headers: { 'content-type': 'text/html' } });
