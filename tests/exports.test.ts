// Every name the official SDK exports, ours exports too: an app aliasing one to the other must not lose an import.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '..');

/** The value and type names a module file exports, following `export *`. */
function exported(file: string, seen = new Set<string>()): Set<string> {
	const names = new Set<string>();
	if (seen.has(file)) return names;
	seen.add(file);
	const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
	const resolve = (spec: string) => {
		const base = path.resolve(path.dirname(file), spec);
		const tries = file.endsWith('.d.ts')
			? [base.replace(/\.js$/, '.d.ts'), base + '.d.ts', path.join(base, 'index.d.ts')]
			: [base, base + '.js', path.join(base, 'index.js')];
		for (const f of tries) if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
		throw new Error(`cannot resolve ${spec} from ${file}`);
	};
	for (const node of source.statements) {
		if (ts.isExportDeclaration(node)) {
			if (!node.exportClause && node.moduleSpecifier) {
				for (const n of exported(resolve((node.moduleSpecifier as ts.StringLiteral).text), seen)) names.add(n);
			} else if (node.exportClause && ts.isNamedExports(node.exportClause)) {
				for (const el of node.exportClause.elements) names.add(el.name.text);
			}
		} else if (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
			if (ts.isVariableStatement(node)) for (const d of node.declarationList.declarations) names.add((d.name as ts.Identifier).text);
			else if ('name' in node && node.name) names.add((node.name as ts.Identifier).text);
		}
	}
	return names;
}

describe('exports', () => {
	it('ours exports every value the official SDK does', () => {
		const official = exported(path.join(ROOT, 'node_modules/@builder.io/sdk-svelte/lib/browser/index.js'));
		const ours = exported(path.join(ROOT, 'dist/index.js'));
		official.delete('default');
		expect(official).toContain('setEditorSettings');
		expect(official).toContain('Content');
		expect([...official].filter((n) => !ours.has(n))).toEqual([]);
	});

	it('ours exports every type the official SDK does', () => {
		const official = exported(path.join(ROOT, 'node_modules/@builder.io/sdk-svelte/lib/browser/index.d.ts'));
		const ours = exported(path.join(ROOT, 'dist/index.d.ts'));
		official.delete('default');
		expect(official).toContain('RegisteredComponent');
		expect([...official].filter((n) => !ours.has(n)).sort()).toEqual([]);
	});
});
