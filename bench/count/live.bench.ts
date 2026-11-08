/**
 * COUNTED LIVE EDITING, the data side: inside the editor every keystroke posts the whole content
 * again (a structured clone), and ContentView merges it over the current content and reconciles it
 * (src/lib/internal/live.ts), so untouched blocks keep their identity and stay cache hits. This
 * counts that step for one text edit; bench/count/client.bench.ts counts the re-render after it.
 */
import { bench } from 'heisenbench/bench';
import { merge_content, reconcile } from '../../src/lib/internal/live.ts';
import { edit_one_text, fixture_text, repeat_blocks, spec_of, type Json } from './data.ts';

function edit_case(content: Json) {
	return { current: content, next: edit_one_text(content, '<p>edited</p>') };
}

for (const name of ['gen/page-50k', 'gen/page-250k', 'gen/flat-1000']) {
	const raw = fixture_text(name);
	bench(`live edit · ${name} · merge + reconcile one text edit`, ({ current, next }) => reconcile(current, merge_content(current as never, next as never)), {
		setup: () => edit_case(spec_of(raw).content),
		scale: (_ctx, factor) => edit_case(repeat_blocks(spec_of(raw).content, factor))
	});
}

/** The last top-level block dragged to the top: blocks matched by id, not by position. */
function move_case(content: Json) {
	const next = JSON.parse(JSON.stringify(content));
	next.data.blocks.unshift(next.data.blocks.pop());
	return { current: content, next };
}

const moved = fixture_text('gen/page-50k');
bench('live edit · gen/page-50k · merge + reconcile one block moved', ({ current, next }) => reconcile(current, merge_content(current as never, next as never)), {
	setup: () => move_case(spec_of(moved).content),
	scale: (_ctx, factor) => move_case(repeat_blocks(spec_of(moved).content, factor))
});
