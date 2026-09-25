// Capture real pages of a SvelteKit + Builder site with a headless browser (some CDNs answer plain
// HTTP clients with a 403), then pull the Builder contents out of each page's SvelteKit data
// (scripts/extract-*.mjs). Captures go to fixtures/real, which is gitignored: keep them local.
//   node scripts/grab-real.mjs fixtures/real https://example.com/a https://example.com/b
import { chromium } from 'playwright';
import fs from 'node:fs';
const [, , outdir, ...urls] = process.argv;
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({
	userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
});
const SLUG_RE = /[^a-z0-9]+/gi;
for (const url of urls) {
	const page = await ctx.newPage();
	try {
		const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
		const slug = new URL(url).pathname.replace(SLUG_RE, '-').replace(/^-|-$/g, '') || 'root';
		fs.writeFileSync(`${outdir}/${slug}.html`, await page.content());
		console.log(res?.status(), slug);
	} catch (e) {
		console.log('FAIL', url, e.message);
	}
	await page.close();
}
await b.close();
