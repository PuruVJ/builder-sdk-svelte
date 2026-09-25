// CPU PROFILE of a whole field-shaped page (bench/app-page.mjs shape) rendered from the SAME
// content objects over and over — the fixed per-request cost, without JSON.parse.
//   node --cpu-prof --cpu-prof-dir=bench/prof bench/profile-app.mjs <sdk> <page> [renders]
import fs from 'node:fs';
import path from 'node:path';
import { render_app_page, app_components } from './dist/entry.js';
const ROOT = path.resolve(import.meta.dirname, '..');
const [, , sdk = 'ours', page = 'fr-fr', n = '20000'] = process.argv;
const dir = fs.existsSync(path.join(ROOT, 'fixtures/real')) ? path.join(ROOT, 'fixtures/real') : path.join(ROOT, 'fixtures/pages');
const kinds = ['accessibilityContent', 'pageContent', 'content', 'getFooterContent'];
const contents = kinds.map((k) => path.join(dir, `${page}.${k}.json`)).filter(fs.existsSync).map((f) => { const s = JSON.parse(fs.readFileSync(f, 'utf8')); return s.content ?? s; });
const names = new Set();
const st = [contents];
while (st.length) { const v = st.pop(); if (!v || typeof v !== 'object') continue; if (v['@type'] === '@builder.io/sdk:Element' && v.component?.name) names.add(v.component.name); for (const k in v) st.push(v[k]); }
const list = app_components(sdk, { names: [...names].sort(), size: 230 });
const roots = contents.map((content) => ({ model: 'page', content, components: list }));
for (let i = 0; i < 200; i++) render_app_page(sdk, roots);
const t = performance.now();
for (let i = 0; i < Number(n); i++) render_app_page(sdk, roots);
console.log(sdk, page, ((performance.now() - t) / Number(n)).toFixed(4), 'ms/render (same content)');
