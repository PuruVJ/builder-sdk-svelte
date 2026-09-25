/** The content-level `<style>` (official components/content/components/styles.helpers.ts), same text. */
import type { BuilderContent, CustomFont } from '../types.js';

const AMP_RE = /&/g;

function font_css(font: CustomFont): string {
	const family = font.family + (font.kind && !font.kind.includes('#') ? ', ' + font.kind : '');
	const name = family.split(',')[0];
	const url = font.fileUrl ?? font?.files?.regular;
	let str = '';
	if (url && family && name) {
		str += `
@font-face {
font-family: "${family}";
src: local("${name}"), url('${url}') format('woff2');
font-display: fallback;
font-weight: 400;
}
      `.trim();
	}
	if (font.files) {
		for (const weight in font.files) {
			if (String(Number(weight)) !== weight) continue;
			const weight_url = font.files[weight];
			if (weight_url && weight_url !== url) {
				str += `
@font-face {
font-family: "${family}";
src: url('${weight_url}') format('woff2');
font-display: fallback;
font-weight: ${weight};
}
        `.trim();
			}
		}
	}
	return str;
}

const DEFAULT_STYLES = `
.builder-button {
  all: unset;
}

.builder-text > p:first-of-type, .builder-text > .builder-paragraph:first-of-type {
  margin: 0;
}
.builder-text > p, .builder-text > .builder-paragraph {
  color: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  font-weight: inherit;
  font-size: inherit;
  text-align: inherit;
  font-family: inherit;
}
`;

export function content_styles(content: BuilderContent | undefined, nested: boolean): string {
	const css_code = content?.data?.cssCode;
	const id = content?.id;
	const css = !css_code ? '' : !id ? css_code : css_code.replace(AMP_RE, `div[builder-content-id="${id}"]`);
	const fonts = content?.data?.customFonts?.map(font_css)?.join(' ') || '';
	return `
${css}
${fonts}
${nested ? '' : DEFAULT_STYLES}
`.trim();
}
