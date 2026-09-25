// Every shipped .svelte must compile as PLAIN JS (no lang="ts"): the consumer compiles it as-is.
import { globSync, readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';
let bad = 0;
for (const file of globSync('dist/**/*.svelte')) {
	for (const generate of ['server', 'client']) {
		try {
			compile(readFileSync(file, 'utf8'), { filename: file, generate });
		} catch (e) {
			bad++;
			console.log(`${file} (${generate}): ${e.message.split('\n')[0]}`);
			break;
		}
	}
}
if (bad) process.exit(1);
console.log('all shipped .svelte files compile as plain JS');
