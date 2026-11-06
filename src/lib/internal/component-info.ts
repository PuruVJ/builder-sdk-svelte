/**
 * The built-in components' editor infos: every official `component-info.ts` under `blocks/`, verbatim
 * (TARGET = 'svelte'). The editor receives each as `serializeIncludingFunctions(info)` in a
 * `builder.registerComponent` message, so the key order matches the official one and every function
 * (`onChange`, `showIf`) keeps the official body: it is sent as `fn.toString()` and evaluated in the
 * editor, so it must be self-contained.
 *
 * Each info is built by a function (called once, by defaults.ts on the first registry build):
 * importing this module runs nothing.
 */
import type { ComponentInfo } from '../official/types/components.js';

/** official `constants/file-types.ts` */
const IMAGE_FILE_TYPES = ['jpeg', 'jpg', 'png', 'svg', 'webp', 'gif', 'jfif', 'pjpeg', 'pjp', 'apng', 'avif', 'tif', 'tiff', 'heif', 'bmp', 'eps', 'raw', 'cr2', 'nef', 'orf', 'sr2', 'psd', 'heic', 'dib', 'ai'];
const VIDEO_FILE_TYPES = ['mp4', 'webm', 'mkv', 'flv', 'vob', 'ogv', 'ogg', 'drc', 'gif', 'gifv', 'mng', 'avi', 'mov', 'qt', 'mts', 'm2ts', 'ts', 'wmv', 'yuv', 'rm', 'rmvb', 'viv', 'asf', 'amv', 'm4p', 'mpeg', 'mpe', 'm2v', 'm4v', 'svi', '3gp', '3g2', 'mxf', 'roq', 'nsv', 'f4v', 'f4p', 'f4a', 'f4b'];

/** official `blocks/button/component-info.ts` */
export function button_info(): ComponentInfo {
	return {
		name: 'Core:Button',
		image: 'https://cdn.builder.io/api/v1/image/assets%2FIsxPKMo2gPRRKeakUztj1D6uqed2%2F81a15681c3e74df09677dfc57a615b13',
		defaultStyles: {
			appearance: 'none',
			paddingTop: '15px',
			paddingBottom: '15px',
			paddingLeft: '25px',
			paddingRight: '25px',
			backgroundColor: '#000000',
			color: 'white',
			borderRadius: '4px',
			textAlign: 'center',
			cursor: 'pointer'
		},
		inputs: [{
			name: 'text',
			type: 'text',
			defaultValue: 'Click me!',
			bubble: true
		}, {
			name: 'link',
			type: 'url',
			bubble: true
		}, {
			name: 'openLinkInNewTab',
			type: 'boolean',
			defaultValue: false,
			friendlyName: 'Open link in new tab'
		}],
		static: true,
		noWrap: true,
		shouldReceiveBuilderProps: {
			builderLinkComponent: true
		}
	};
}

/** official `blocks/columns/component-info.ts` */
export function columns_info(): ComponentInfo {
	return {
		name: 'Columns',
		isRSC: true,
		inputs: [{
			name: 'columns',
			type: 'array',
			broadcast: true,
			subFields: [{
				name: 'blocks',
				type: 'array',
				hideFromUI: true,
				defaultValue: [{
					'@type': '@builder.io/sdk:Element',
					responsiveStyles: {
						large: {
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'stretch',
							flexShrink: '0',
							position: 'relative',
							marginTop: '30px',
							textAlign: 'center',
							lineHeight: 'normal',
							height: 'auto',
							minHeight: '20px',
							minWidth: '20px',
							overflow: 'hidden'
						}
					},
					component: {
						name: 'Image',
						options: {
							image: 'https://builder.io/api/v1/image/assets%2Fpwgjf0RoYWbdnJSbpBAjXNRMe9F2%2Ffb27a7c790324294af8be1c35fe30f4d',
							backgroundPosition: 'center',
							backgroundSize: 'cover',
							aspectRatio: 0.7004048582995948
						}
					}
				}, {
					'@type': '@builder.io/sdk:Element',
					responsiveStyles: {
						large: {
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'stretch',
							flexShrink: '0',
							position: 'relative',
							marginTop: '30px',
							textAlign: 'center',
							lineHeight: 'normal',
							height: 'auto'
						}
					},
					component: {
						name: 'Text',
						options: {
							text: '<p>Enter some text...</p>'
						}
					}
				}]
			}, {
				name: 'width',
				type: 'number',
				hideFromUI: true,
				helperText: 'Width %, e.g. set to 50 to fill half of the space'
			}, {
				name: 'link',
				type: 'url',
				helperText: 'Optionally set a url that clicking this column will link to'
			}],
			defaultValue: [{
				blocks: [{
					'@type': '@builder.io/sdk:Element',
					responsiveStyles: {
						large: {
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'stretch',
							flexShrink: '0',
							position: 'relative',
							marginTop: '30px',
							textAlign: 'center',
							lineHeight: 'normal',
							height: 'auto',
							minHeight: '20px',
							minWidth: '20px',
							overflow: 'hidden'
						}
					},
					component: {
						name: 'Image',
						options: {
							image: 'https://builder.io/api/v1/image/assets%2Fpwgjf0RoYWbdnJSbpBAjXNRMe9F2%2Ffb27a7c790324294af8be1c35fe30f4d',
							backgroundPosition: 'center',
							backgroundSize: 'cover',
							aspectRatio: 0.7004048582995948
						}
					}
				}, {
					'@type': '@builder.io/sdk:Element',
					responsiveStyles: {
						large: {
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'stretch',
							flexShrink: '0',
							position: 'relative',
							marginTop: '30px',
							textAlign: 'center',
							lineHeight: 'normal',
							height: 'auto'
						}
					},
					component: {
						name: 'Text',
						options: {
							text: '<p>Enter some text...</p>'
						}
					}
				}]
			}, {
				blocks: [{
					'@type': '@builder.io/sdk:Element',
					responsiveStyles: {
						large: {
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'stretch',
							flexShrink: '0',
							position: 'relative',
							marginTop: '30px',
							textAlign: 'center',
							lineHeight: 'normal',
							height: 'auto',
							minHeight: '20px',
							minWidth: '20px',
							overflow: 'hidden'
						}
					},
					component: {
						name: 'Image',
						options: {
							image: 'https://builder.io/api/v1/image/assets%2Fpwgjf0RoYWbdnJSbpBAjXNRMe9F2%2Ffb27a7c790324294af8be1c35fe30f4d',
							backgroundPosition: 'center',
							backgroundSize: 'cover',
							aspectRatio: 0.7004048582995948
						}
					}
				}, {
					'@type': '@builder.io/sdk:Element',
					responsiveStyles: {
						large: {
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'stretch',
							flexShrink: '0',
							position: 'relative',
							marginTop: '30px',
							textAlign: 'center',
							lineHeight: 'normal',
							height: 'auto'
						}
					},
					component: {
						name: 'Text',
						options: {
							text: '<p>Enter some text...</p>'
						}
					}
				}]
			}],
			onChange: (options: Map<string, any>) => {
				function clearWidths() {
					columns.forEach(col => {
						col.delete('width');
					});
				}
				const columns: Array<Map<string, any>> = options.get('columns');
				if (Array.isArray(columns)) {
					const containsColumnWithWidth = !!columns.find(col => col.get('width'));
					if (containsColumnWithWidth) {
						const containsColumnWithoutWidth = !!columns.find(col => !col.get('width'));
						if (containsColumnWithoutWidth) {
							clearWidths();
						} else {
							const sumWidths = columns.reduce((memo, col) => {
								return memo + col.get('width');
							}, 0);
							const widthsDontAddUp = sumWidths !== 100;
							if (widthsDontAddUp) {
								clearWidths();
							}
						}
					}
				}
			}
		}, {
			name: 'space',
			type: 'number',
			defaultValue: 20,
			helperText: 'Size of gap between columns',
			advanced: true
		}, {
			name: 'stackColumnsAt',
			type: 'string',
			defaultValue: 'tablet',
			helperText: 'Convert horizontal columns to vertical at what device size',
			enum: ['tablet', 'mobile', 'never'],
			advanced: true
		}, {
			name: 'reverseColumnsWhenStacked',
			type: 'boolean',
			defaultValue: false,
			helperText: 'When stacking columns for mobile devices, reverse the ordering',
			advanced: true
		}],
		shouldReceiveBuilderProps: {
			builderBlock: true,
			builderContext: true,
			builderComponents: true,
			builderLinkComponent: true
		}
	};
}

/** official `blocks/fragment/component-info.ts` */
export function fragment_info(): ComponentInfo {
	return {
		name: 'Fragment',
		static: true,
		hidden: true,
		canHaveChildren: true,
		noWrap: true
	};
}

/** official `blocks/image/component-info.ts` */
export function image_info(): ComponentInfo {
	return {
		name: 'Image',
		static: true,
		image: 'https://firebasestorage.googleapis.com/v0/b/builder-3b0a2.appspot.com/o/images%2Fbaseline-insert_photo-24px.svg?alt=media&token=4e5d0ef4-f5e8-4e57-b3a9-38d63a9b9dc4',
		defaultStyles: {
			position: 'relative',
			minHeight: '20px',
			minWidth: '20px',
			overflow: 'hidden'
		},
		canHaveChildren: true,
		inputs: [{
			name: 'image',
			type: 'file',
			bubble: true,
			allowedFileTypes: IMAGE_FILE_TYPES,
			required: true,
			defaultValue: 'https://cdn.builder.io/api/v1/image/assets%2FYJIGb4i01jvw0SRdL5Bt%2F72c80f114dc149019051b6852a9e3b7a',
			onChange: (options: Map<string, any>): void | Promise<void> => {
				const DEFAULT_ASPECT_RATIO = 0.7041;
				options.delete('srcset');
				options.delete('noWebp');
				function loadImage(url: string, timeout = 60000): Promise<HTMLImageElement> {
					return new Promise((resolve, reject) => {
						const img = document.createElement('img');
						let loaded = false;
						img.onload = () => {
							loaded = true;
							resolve(img);
						};
						img.addEventListener('error', event => {
							console.warn('Image load failed', event.error);
							reject(event.error);
						});
						img.src = url;
						setTimeout(() => {
							if (!loaded) {
								reject(new Error('Image load timed out'));
							}
						}, timeout);
					});
				}
				function round(num: number) {
					return Math.round(num * 1000) / 1000;
				}
				const value = options.get('image');
				const aspectRatio = options.get('aspectRatio');

				// For SVG images - don't render as webp, keep them as SVG
				fetch(value).then(res => res.blob()).then(blob => {
					if (blob.type.includes('svg')) {
						options.set('noWebp', true);
					}
				});
				if (value && (!aspectRatio || aspectRatio === DEFAULT_ASPECT_RATIO)) {
					return loadImage(value).then(img => {
						const possiblyUpdatedAspectRatio = options.get('aspectRatio');
						if (options.get('image') === value && (!possiblyUpdatedAspectRatio || possiblyUpdatedAspectRatio === DEFAULT_ASPECT_RATIO)) {
							if (img.width && img.height) {
								options.set('aspectRatio', round(img.height / img.width));
								options.set('height', img.height);
								options.set('width', img.width);
							}
						}
					});
				}
			}
		}, {
			name: 'backgroundSize',
			type: 'text',
			defaultValue: 'cover',
			enum: [{
				label: 'contain',
				value: 'contain',
				helperText: 'The image should never get cropped'
			}, {
				label: 'cover',
				value: 'cover',
				helperText: "The image should fill it's box, cropping when needed"
			}]
		}, {
			name: 'backgroundPosition',
			type: 'text',
			defaultValue: 'center',
			enum: ['center', 'top', 'left', 'right', 'bottom', 'top left', 'top right', 'bottom left', 'bottom right']
		}, {
			name: 'altText',
			type: 'string',
			helperText: 'Text to display when the user has images off'
		}, {
			name: 'title',
			type: 'string',
			helperText: 'Text to display when hovering over the asset'
		}, {
			name: 'height',
			type: 'number',
			hideFromUI: true
		}, {
			name: 'width',
			type: 'number',
			hideFromUI: true
		}, {
			name: 'sizes',
			type: 'string',
			hideFromUI: true
		}, {
			name: 'srcset',
			type: 'string',
			hideFromUI: true
		}, {
			name: 'lazy',
			type: 'boolean',
			defaultValue: true,
			hideFromUI: true
		}, {
			name: 'fitContent',
			type: 'boolean',
			helperText: "When child blocks are provided, fit to them instead of using the image's aspect ratio",
			defaultValue: true
		}, {
			name: 'highPriority',
			type: 'boolean',
			advanced: true,
			helperText: 'Mark this image as high priority compared to other images on the page. This prevents lazy loading of the image and tells the browser to load this image before others on the page.'
		}, {
			name: 'aspectRatio',
			type: 'number',
			helperText: "This is the ratio of height/width, e.g. set to 1.5 for a 300px wide and 200px tall photo. Set to 0 to not force the image to maintain it's aspect ratio",
			advanced: true,
			defaultValue: 0.7041
		}],
		shouldReceiveBuilderProps: {
			builderBlock: true
		}
	};
}

/** official `blocks/section/component-info.ts` */
export function section_info(): ComponentInfo {
	return {
		name: 'Core:Section',
		static: true,
		image: 'https://cdn.builder.io/api/v1/image/assets%2FIsxPKMo2gPRRKeakUztj1D6uqed2%2F682efef23ace49afac61748dd305c70a',
		inputs: [{
			name: 'maxWidth',
			type: 'number',
			defaultValue: 1200
		}, {
			name: 'lazyLoad',
			type: 'boolean',
			defaultValue: false,
			advanced: true,
			description: 'Only render this section when in view'
		}],
		defaultStyles: {
			paddingLeft: '20px',
			paddingRight: '20px',
			paddingTop: '50px',
			paddingBottom: '50px',
			marginTop: '0px',
			width: '100vw',
			marginLeft: 'calc(50% - 50vw)'
		},
		canHaveChildren: true,
		defaultChildren: [{
			'@type': '@builder.io/sdk:Element',
			responsiveStyles: {
				large: {
					textAlign: 'center'
				}
			},
			component: {
				name: 'Text',
				options: {
					text: "<p><b>I am a section! My content keeps from getting too wide, so that it's easy to read even on big screens.</b></p><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur</p>"
				}
			}
		}]
	};
}

/** official `blocks/slot/component-info.ts` */
export function slot_info(): ComponentInfo {
	return {
		name: 'Slot',
		isRSC: true,
		description: 'Allow child blocks to be inserted into this content when used as a Symbol',
		docsLink: 'https://www.builder.io/c/docs/symbols-with-blocks',
		image: 'https://cdn.builder.io/api/v1/image/assets%2FYJIGb4i01jvw0SRdL5Bt%2F3aad6de36eae43b59b52c85190fdef56',
		inputs: [{
			name: 'name',
			type: 'string',
			required: true,
			defaultValue: 'children'
		}],
		shouldReceiveBuilderProps: {
			builderContext: true,
			builderComponents: true
		}
	};
}

/** official `blocks/symbol/component-info.ts` */
export function symbol_info(): ComponentInfo {
	return {
		name: 'Symbol',
		noWrap: true,
		static: true,
		isRSC: true,
		inputs: [{
			name: 'symbol',
			type: 'uiSymbol'
		}, {
			name: 'dataOnly',
			helperText: "Make this a data symbol that doesn't display any UI",
			type: 'boolean',
			defaultValue: false,
			advanced: true,
			hideFromUI: true
		}, {
			name: 'inheritState',
			helperText: 'Inherit the parent component state and data',
			type: 'boolean',
			defaultValue: false,
			advanced: true
		}, {
			name: 'renderToLiquid',
			helperText: 'Render this symbols contents to liquid. Turn off to fetch with javascript and use custom targeting',
			type: 'boolean',
			defaultValue: false,
			advanced: true,
			hideFromUI: true
		}, {
			name: 'useChildren',
			hideFromUI: true,
			type: 'boolean'
		}],
		shouldReceiveBuilderProps: {
			builderBlock: true,
			builderContext: true,
			builderComponents: true,
			builderLinkComponent: true
		}
	};
}

/** official `blocks/text/component-info.ts` */
export function text_info(): ComponentInfo {
	return {
		// (official: `TARGET === 'reactNative' ? { builderBlock: true, builderContext: true } : {}`; TARGET is 'svelte')
		shouldReceiveBuilderProps: {},
		name: 'Text',
		static: true,
		image: 'https://firebasestorage.googleapis.com/v0/b/builder-3b0a2.appspot.com/o/images%2Fbaseline-text_fields-24px%20(1).svg?alt=media&token=12177b73-0ee3-42ca-98c6-0dd003de1929',
		inputs: [{
			name: 'text',
			type: 'html',
			required: true,
			autoFocus: true,
			bubble: true,
			defaultValue: 'Enter some text...'
		}],
		defaultStyles: {
			lineHeight: 'normal',
			height: 'auto',
			textAlign: 'center'
		}
	};
}

/** official `blocks/personalization-container/component-info.ts` */
export function personalization_container_info(): ComponentInfo {
	return {
		name: 'PersonalizationContainer',
		shouldReceiveBuilderProps: {
			builderBlock: true,
			builderContext: true,
			builderComponents: true
		},
		noWrap: true,
		image: 'https://cdn.builder.io/api/v1/image/assets%2FYJIGb4i01jvw0SRdL5Bt%2F37229ed30d8c41dfb10b8cca1992053a',
		canHaveChildren: true,
		inputs: [{
			name: 'variants',
			defaultValue: [],
			behavior: 'personalizationVariantList',
			type: 'list',
			subFields: [{
				name: 'name',
				type: 'text'
			}, {
				name: 'query',
				friendlyName: 'Targeting rules',
				type: 'BuilderQuery',
				defaultValue: []
			}, {
				name: 'startDate',
				type: 'date'
			}, {
				name: 'endDate',
				type: 'date'
			}, {
				name: 'blocks',
				type: 'uiBlocks',
				hideFromUI: true,
				defaultValue: []
			}]
		}]
	};
}

/** official `blocks/tabs/component-info.ts` */
export function tabs_info(): ComponentInfo {
	const defaultTab = {
		'@type': '@builder.io/sdk:Element',
		responsiveStyles: {
			large: {
				paddingLeft: '20px',
				paddingRight: '20px',
				paddingTop: '10px',
				paddingBottom: '10px',
				minWidth: '100px',
				textAlign: 'center',
				display: 'flex',
				flexDirection: 'column',
				cursor: 'pointer',
				userSelect: 'none'
			}
		},
		component: {
			name: 'Text',
			options: {
				text: 'New tab'
			}
		}
	};
	const defaultElement = {
		'@type': '@builder.io/sdk:Element',
		responsiveStyles: {
			large: {
				height: '200px',
				display: 'flex',
				marginTop: '20px',
				flexDirection: 'column'
			}
		},
		component: {
			name: 'Text',
			options: {
				text: 'New tab content '
			}
		}
	};
	return {
		name: 'Builder: Tabs',
		inputs: [{
			name: 'tabs',
			type: 'list',
			broadcast: true,
			subFields: [{
				name: 'label',
				type: 'uiBlocks',
				hideFromUI: true,
				defaultValue: [defaultTab]
			}, {
				name: 'content',
				type: 'uiBlocks',
				hideFromUI: true,
				defaultValue: [defaultElement]
			}],
			defaultValue: [{
				label: [{
					...defaultTab,
					component: {
						name: 'Text',
						options: {
							text: 'Tab 1'
						}
					}
				}],
				content: [{
					...defaultElement,
					component: {
						name: 'Text',
						options: {
							text: 'Tab 1 content'
						}
					}
				}]
			}, {
				label: [{
					...defaultTab,
					component: {
						name: 'Text',
						options: {
							text: 'Tab 2'
						}
					}
				}],
				content: [{
					...defaultElement,
					component: {
						name: 'Text',
						options: {
							text: 'Tab 2 content'
						}
					}
				}]
			}]
		}, {
			name: 'activeTabStyle',
			type: 'uiStyle',
			helperText: 'CSS styles for the active tab',
			defaultValue: {
				backgroundColor: 'rgba(0, 0, 0, 0.1)'
			}
		}, {
			name: 'defaultActiveTab',
			type: 'number',
			helperText: 'Default tab to open to. Set to "1" for the first tab, "2" for the second, or choose "0" for none',
			defaultValue: 1,
			advanced: true
		}, {
			name: 'collapsible',
			type: 'boolean',
			helperText: 'If on, clicking an open tab closes it so no tabs are active',
			defaultValue: false,
			advanced: true
		}, {
			name: 'tabHeaderLayout',
			type: 'enum',
			helperText: 'Change the layout of the tab headers (uses justify-content)',
			defaultValue: 'flex-start',
			enum: [{
				label: 'Center',
				value: 'center'
			}, {
				label: 'Space between',
				value: 'space-between'
			}, {
				label: 'Space around',
				value: 'space-around'
			}, {
				label: 'Left',
				value: 'flex-start'
			}, {
				label: 'Right',
				value: 'flex-end'
			}]
		}],
		shouldReceiveBuilderProps: {
			builderBlock: true,
			builderContext: true,
			builderComponents: true,
			builderLinkComponent: true
		}
	};
}

/** official `blocks/accordion/component-info.ts` */
export function accordion_info(): ComponentInfo {
	const defaultTitle = {
		'@type': '@builder.io/sdk:Element',
		layerName: 'Accordion item title',
		responsiveStyles: {
			large: {
				marginTop: '10px',
				position: 'relative',
				display: 'flex',
				alignItems: 'stretch',
				flexDirection: 'column',
				paddingBottom: '10px'
			}
		},
		children: [{
			'@type': '@builder.io/sdk:Element',
			responsiveStyles: {
				large: {
					textAlign: 'left',
					display: 'flex',
					flexDirection: 'column'
				}
			},
			component: {
				name: 'Text',
				options: {
					text: 'I am an accordion title. Click me!'
				}
			}
		}]
	};
	const defaultDetail = {
		'@type': '@builder.io/sdk:Element',
		layerName: 'Accordion item detail',
		responsiveStyles: {
			large: {
				position: 'relative',
				display: 'flex',
				alignItems: 'stretch',
				flexDirection: 'column',
				marginTop: '10px',
				paddingBottom: '10px'
			}
		},
		children: [{
			'@type': '@builder.io/sdk:Element',
			responsiveStyles: {
				large: {
					paddingTop: '50px',
					textAlign: 'left',
					display: 'flex',
					flexDirection: 'column',
					paddingBottom: '50px'
				}
			},
			component: {
				name: 'Text',
				options: {
					text: 'I am an accordion detail, hello!'
				}
			}
		}]
	};
	return {
		name: 'Builder:Accordion',
		canHaveChildren: true,
		image: 'https://cdn.builder.io/api/v1/image/assets%2FagZ9n5CUKRfbL9t6CaJOyVSK4Es2%2Ffab6c1fd3fe542408cbdec078bca7f35',
		defaultStyles: {
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'stretch'
		},
		inputs: [{
			name: 'items',
			type: 'list',
			broadcast: true,
			subFields: [{
				name: 'title',
				type: 'uiBlocks',
				hideFromUI: true,
				defaultValue: [defaultTitle]
			}, {
				name: 'detail',
				type: 'uiBlocks',
				hideFromUI: true,
				defaultValue: [defaultDetail]
			}],
			defaultValue: [{
				title: [defaultTitle],
				detail: [defaultDetail]
			}, {
				title: [defaultTitle],
				detail: [defaultDetail]
			}],
			showIf: (options: Map<string, any>) => !options.get('useChildrenForItems')
		}, {
			name: 'oneAtATime',
			helperText: 'Only allow opening one at a time (collapse all others when new item openned)',
			type: 'boolean',
			defaultValue: false
		}, {
			name: 'grid',
			helperText: 'Display as a grid',
			type: 'boolean',
			defaultValue: false
		}, {
			name: 'gridRowWidth',
			helperText: 'Display as a grid',
			type: 'string',
			showIf: (options: Map<string, any>) => options.get('grid'),
			defaultValue: '25%'
		}, {
			name: 'useChildrenForItems',
			type: 'boolean',
			helperText: 'Use child elements for each slide, instead of the array. Useful for dynamically repeating items',
			advanced: true,
			defaultValue: false,
			onChange: (options: Map<string, any>) => {
				if (options.get('useChildrenForItems') === true) {
					options.set('items', []);
				}
			}
		}],
		shouldReceiveBuilderProps: {
			builderBlock: true,
			builderContext: true,
			builderComponents: true,
			builderLinkComponent: true
		}
	};
}

/** official `blocks/custom-code/component-info.ts` */
export function custom_code_info(): ComponentInfo {
	return {
		name: 'Custom Code',
		static: true,
		requiredPermissions: ['editCode'],
		inputs: [{
			name: 'code',
			type: 'html',
			required: true,
			defaultValue: '<p>Hello there, I am custom HTML code!</p>',
			code: true
		}, {
			name: 'replaceNodes',
			type: 'boolean',
			helperText: 'Preserve server rendered dom nodes',
			advanced: true
		}, {
			name: 'scriptsClientOnly',
			type: 'boolean',
			defaultValue: false,
			helperText: 'Only print and run scripts on the client. Important when scripts influence DOM that could be replaced when client loads',
			advanced: true
		}]
	};
}

/** official `blocks/embed/component-info.ts` */
export function embed_info(): ComponentInfo {
	return {
		name: 'Embed',
		static: true,
		inputs: [{
			name: 'url',
			type: 'url',
			required: true,
			defaultValue: '',
			helperText: 'e.g. enter a youtube url, google map, etc'
		}, {
			name: 'content',
			type: 'html',
			defaultValue: '<div style="padding: 20px; text-align: center">(Choose an embed URL)<div>',
			hideFromUI: true
		}]
	};
}

/** official `blocks/form/form/component-info.ts` */
export function form_info(): ComponentInfo {
	return {
		name: 'Form:Form',
		defaults: {
			responsiveStyles: {
				large: {
					marginTop: '15px',
					paddingBottom: '15px'
				}
			}
		},
		image: 'https://cdn.builder.io/api/v1/image/assets%2FIsxPKMo2gPRRKeakUztj1D6uqed2%2Fef36d2a846134910b64b88e6d18c5ca5',
		inputs: [{
			name: 'sendSubmissionsTo',
			type: 'string',
			enum: [{
				label: 'Send to email',
				value: 'email',
				helperText: 'Send form submissions to the email address of your choosing'
			}, {
				label: 'Custom',
				value: 'custom',
				helperText: 'Handle where the form requests go manually with a little code, e.g. to your own custom backend'
			}],
			defaultValue: 'email'
		}, {
			name: 'sendSubmissionsToEmail',
			type: 'string',
			required: true,
			defaultValue: 'your@email.com',
			showIf: 'options.get("sendSubmissionsTo") === "email"'
		}, {
			name: 'sendWithJs',
			type: 'boolean',
			helperText: 'Set to false to use basic html form action',
			defaultValue: true,
			showIf: 'options.get("sendSubmissionsTo") === "custom"'
		}, {
			name: 'name',
			type: 'string',
			defaultValue: 'My form'
		}, {
			name: 'action',
			type: 'string',
			helperText: 'URL to send the form data to',
			showIf: 'options.get("sendSubmissionsTo") === "custom"'
		}, {
			name: 'contentType',
			type: 'string',
			defaultValue: 'application/json',
			advanced: true,
			enum: ['application/json', 'multipart/form-data', 'application/x-www-form-urlencoded'],
			showIf: 'options.get("sendSubmissionsTo") === "custom" && options.get("sendWithJs") === true'
		}, {
			name: 'method',
			type: 'string',
			showIf: 'options.get("sendSubmissionsTo") === "custom"',
			defaultValue: 'POST',
			advanced: true
		}, {
			name: 'previewState',
			type: 'string',
			enum: ['unsubmitted', 'sending', 'success', 'error'],
			defaultValue: 'unsubmitted',
			helperText: 'Choose a state to edit, e.g. choose "success" to show what users see on success and edit the message',
			showIf: 'options.get("sendSubmissionsTo") !== "zapier" && options.get("sendWithJs") === true'
		}, {
			name: 'successUrl',
			type: 'url',
			helperText: 'Optional URL to redirect the user to on form submission success',
			showIf: 'options.get("sendSubmissionsTo") !== "zapier" && options.get("sendWithJs") === true'
		}, {
			name: 'resetFormOnSubmit',
			type: 'boolean',
			showIf: "options.get('sendSubmissionsTo') === 'custom' && options.get('sendWithJs') === true",
			advanced: true
		}, {
			name: 'successMessage',
			type: 'uiBlocks',
			hideFromUI: true,
			defaultValue: [{
				'@type': '@builder.io/sdk:Element',
				responsiveStyles: {
					large: {
						marginTop: '10px'
					}
				},
				component: {
					name: 'Text',
					options: {
						text: '<span>Thanks!</span>'
					}
				}
			}]
		}, {
			name: 'validate',
			type: 'boolean',
			defaultValue: true,
			advanced: true
		}, {
			name: 'errorMessagePath',
			type: 'text',
			advanced: true,
			helperText: 'Path to where to get the error message from in a JSON response to display to the user, e.g. "error.message" for a response like { "error": { "message": "this username is taken" }}'
		}, {
			name: 'errorMessage',
			type: 'uiBlocks',
			hideFromUI: true,
			defaultValue: [{
				'@type': '@builder.io/sdk:Element',
				responsiveStyles: {
					large: {
						marginTop: '10px'
					}
				},
				bindings: {
					'component.options.text': 'state.formErrorMessage || block.component.options.text'
				},
				component: {
					name: 'Text',
					options: {
						text: '<span>Form submission error :( Please check your answers and try again</span>'
					}
				}
			}]
		}, {
			name: 'sendingMessage',
			type: 'uiBlocks',
			hideFromUI: true,
			defaultValue: [{
				'@type': '@builder.io/sdk:Element',
				responsiveStyles: {
					large: {
						marginTop: '10px'
					}
				},
				component: {
					name: 'Text',
					options: {
						text: '<span>Sending...</span>'
					}
				}
			}]
		}, {
			name: 'customHeaders',
			type: 'map',
			valueType: {
				type: 'string'
			},
			advanced: true,
			showIf: 'options.get("sendSubmissionsTo") === "custom" && options.get("sendWithJs") === true'
		}],
		noWrap: true,
		canHaveChildren: true,
		defaultChildren: [{
			'@type': '@builder.io/sdk:Element',
			responsiveStyles: {
				large: {
					marginTop: '10px'
				}
			},
			component: {
				name: 'Text',
				options: {
					text: '<span>Enter your name</span>'
				}
			}
		}, {
			'@type': '@builder.io/sdk:Element',
			responsiveStyles: {
				large: {
					marginTop: '10px'
				}
			},
			component: {
				name: 'Form:Input',
				options: {
					name: 'name',
					placeholder: 'Jane Doe'
				}
			}
		}, {
			'@type': '@builder.io/sdk:Element',
			responsiveStyles: {
				large: {
					marginTop: '10px'
				}
			},
			component: {
				name: 'Text',
				options: {
					text: '<span>Enter your email</span>'
				}
			}
		}, {
			'@type': '@builder.io/sdk:Element',
			responsiveStyles: {
				large: {
					marginTop: '10px'
				}
			},
			component: {
				name: 'Form:Input',
				options: {
					name: 'email',
					placeholder: 'jane@doe.com'
				}
			}
		}, {
			'@type': '@builder.io/sdk:Element',
			responsiveStyles: {
				large: {
					marginTop: '10px'
				}
			},
			component: {
				name: 'Form:SubmitButton',
				options: {
					text: 'Submit'
				}
			}
		}],
		shouldReceiveBuilderProps: {
			builderBlock: true,
			builderContext: true,
			builderComponents: true,
			builderLinkComponent: true
		}
	};
}

/** official `blocks/form/input/component-info.ts` */
export function form_input_info(): ComponentInfo {
	return {
		name: 'Form:Input',
		image: 'https://cdn.builder.io/api/v1/image/assets%2FIsxPKMo2gPRRKeakUztj1D6uqed2%2Fad6f37889d9e40bbbbc72cdb5875d6ca',
		inputs: [{
			name: 'type',
			type: 'text',
			enum: ['text', 'number', 'email', 'url', 'checkbox', 'radio', 'range', 'date', 'datetime-local', 'search', 'tel', 'time', 'file', 'month', 'week', 'password', 'color', 'hidden'],
			defaultValue: 'text'
		}, {
			name: 'name',
			type: 'string',
			required: true,
			helperText: 'Every input in a form needs a unique name describing what it takes, e.g. "email"'
		}, {
			name: 'placeholder',
			type: 'string',
			defaultValue: 'Hello there',
			helperText: 'Text to display when there is no value'
		},
		{
			name: 'defaultValue',
			type: 'string'
		}, {
			name: 'value',
			type: 'string',
			advanced: true
		}, {
			name: 'required',
			type: 'boolean',
			helperText: 'Is this input required to be filled out to submit a form',
			defaultValue: false
		}],
		noWrap: true,
		static: true,
		defaultStyles: {
			paddingTop: '10px',
			paddingBottom: '10px',
			paddingLeft: '10px',
			paddingRight: '10px',
			borderRadius: '3px',
			borderWidth: '1px',
			borderStyle: 'solid',
			borderColor: '#ccc'
		}
	};
}

/** official `blocks/form/submit-button/component-info.ts` */
export function form_submit_button_info(): ComponentInfo {
	return {
		name: 'Form:SubmitButton',
		image: 'https://cdn.builder.io/api/v1/image/assets%2FIsxPKMo2gPRRKeakUztj1D6uqed2%2Fdf2820ffed1f4349a94c40b3221f5b98',
		defaultStyles: {
			appearance: 'none',
			paddingTop: '15px',
			paddingBottom: '15px',
			paddingLeft: '25px',
			paddingRight: '25px',
			backgroundColor: '#3898EC',
			color: 'white',
			borderRadius: '4px',
			cursor: 'pointer'
		},
		inputs: [{
			name: 'text',
			type: 'text',
			defaultValue: 'Click me'
		}],
		static: true,
		noWrap: true
	};
}

/** official `blocks/form/select/component-info.ts` */
export function form_select_info(): ComponentInfo {
	return {
		name: 'Form:Select',
		image: 'https://cdn.builder.io/api/v1/image/assets%2FIsxPKMo2gPRRKeakUztj1D6uqed2%2F83acca093fb24aaf94dee136e9a4b045',
		defaultStyles: {
			alignSelf: 'flex-start'
		},
		inputs: [{
			name: 'options',
			type: 'list',
			required: true,
			subFields: [{
				name: 'value',
				type: 'text',
				required: true
			}, {
				name: 'name',
				type: 'text'
			}],
			defaultValue: [{
				value: 'option 1'
			}, {
				value: 'option 2'
			}]
		}, {
			name: 'name',
			type: 'string',
			required: true,
			helperText: 'Every select in a form needs a unique name describing what it gets, e.g. "email"'
		}, {
			name: 'defaultValue',
			type: 'string'
		}, {
			name: 'value',
			type: 'string',
			advanced: true
		}, {
			name: 'required',
			type: 'boolean',
			defaultValue: false
		}],
		static: true,
		noWrap: true
	};
}

/** official `blocks/form/textarea/component-info.ts` */
export function form_textarea_info(): ComponentInfo {
	return {
		name: 'Form:TextArea',
		image: 'https://cdn.builder.io/api/v1/image/assets%2FIsxPKMo2gPRRKeakUztj1D6uqed2%2Ff74a2f3de58c4c3e939204e5b6b8f6c3',
		inputs: [{
			advanced: true,
			name: 'value',
			type: 'string'
		}, {
			name: 'name',
			type: 'string',
			required: true,
			helperText: 'Every input in a form needs a unique name describing what it gets, e.g. "email"'
		}, {
			name: 'defaultValue',
			type: 'string'
		}, {
			name: 'placeholder',
			type: 'string',
			defaultValue: 'Hello there'
		}, {
			name: 'required',
			type: 'boolean',
			defaultValue: false
		}],
		defaultStyles: {
			paddingTop: '10px',
			paddingBottom: '10px',
			paddingLeft: '10px',
			paddingRight: '10px',
			borderRadius: '3px',
			borderWidth: '1px',
			borderStyle: 'solid',
			borderColor: '#ccc'
		},
		static: true,
		noWrap: true
	};
}

/** official `blocks/img/component-info.ts` */
export function img_info(): ComponentInfo {
	return {
		name: 'Raw:Img',
		hideFromInsertMenu: true,
		image: 'https://firebasestorage.googleapis.com/v0/b/builder-3b0a2.appspot.com/o/images%2Fbaseline-insert_photo-24px.svg?alt=media&token=4e5d0ef4-f5e8-4e57-b3a9-38d63a9b9dc4',
		inputs: [{
			name: 'image',
			bubble: true,
			type: 'file',
			allowedFileTypes: IMAGE_FILE_TYPES,
			required: true
		}, {
			name: 'backgroundSize',
			type: 'text',
			defaultValue: 'cover',
			enum: [{
				label: 'contain',
				value: 'contain',
				helperText: 'The image should never get cropped'
			}, {
				label: 'cover',
				value: 'cover',
				helperText: "The image should fill it's box, cropping when needed"
			}]
		}, {
			name: 'backgroundPosition',
			type: 'text',
			defaultValue: 'center',
			enum: ['center', 'top', 'left', 'right', 'bottom', 'top left', 'top right', 'bottom left', 'bottom right']
		}, {
			name: 'altText',
			type: 'string',
			helperText: 'Text to display when the user has images off'
		}, {
			name: 'title',
			type: 'string',
			helperText: 'Text to display when hovering over the asset'
		}, {
			name: 'aspectRatio',
			type: 'number',
			helperText: "This is the ratio of height/width, e.g. set to 1.5 for a 300px wide and 200px tall photo. Set to 0 to not force the image to maintain it's aspect ratio",
			advanced: true,
			defaultValue: 0.7041
		}],
		noWrap: true
	};
}

/** official `blocks/video/component-info.ts` */
export function video_info(): ComponentInfo {
	return {
		name: 'Video',
		canHaveChildren: true,
		defaultStyles: {
			minHeight: '20px',
			minWidth: '20px'
		},
		image: 'https://firebasestorage.googleapis.com/v0/b/builder-3b0a2.appspot.com/o/images%2Fbaseline-videocam-24px%20(1).svg?alt=media&token=49a84e4a-b20e-4977-a650-047f986874bb',
		inputs: [{
			name: 'video',
			type: 'file',
			allowedFileTypes: VIDEO_FILE_TYPES,
			bubble: true,
			defaultValue: 'https://cdn.builder.io/o/assets%2FYJIGb4i01jvw0SRdL5Bt%2Fd27731a526464deba0016216f5f9e570%2Fcompressed?apiKey=YJIGb4i01jvw0SRdL5Bt&token=d27731a526464deba0016216f5f9e570&alt=media&optimized=true',
			required: true
		}, {
			name: 'posterImage',
			type: 'file',
			allowedFileTypes: IMAGE_FILE_TYPES,
			helperText: 'Image to show before the video plays'
		}, {
			name: 'autoPlay',
			type: 'boolean',
			defaultValue: true
		}, {
			name: 'controls',
			type: 'boolean',
			defaultValue: false
		}, {
			name: 'muted',
			type: 'boolean',
			defaultValue: true
		}, {
			name: 'loop',
			type: 'boolean',
			defaultValue: true
		}, {
			name: 'playsInline',
			type: 'boolean',
			defaultValue: true
		}, {
			name: 'fit',
			type: 'text',
			defaultValue: 'cover',
			enum: ['contain', 'cover', 'fill', 'auto']
		}, {
			name: 'preload',
			type: 'text',
			defaultValue: 'metadata',
			enum: ['auto', 'metadata', 'none']
		}, {
			name: 'fitContent',
			type: 'boolean',
			helperText: 'When child blocks are provided, fit to them instead of using the aspect ratio',
			defaultValue: true,
			advanced: true
		}, {
			name: 'position',
			type: 'text',
			defaultValue: 'center',
			enum: ['center', 'top', 'left', 'right', 'bottom', 'top left', 'top right', 'bottom left', 'bottom right']
		}, {
			name: 'height',
			type: 'number',
			advanced: true
		}, {
			name: 'width',
			type: 'number',
			advanced: true
		}, {
			name: 'aspectRatio',
			type: 'number',
			advanced: true,
			defaultValue: 0.7004048582995948
		}, {
			name: 'lazyLoad',
			type: 'boolean',
			helperText: 'Load this video "lazily" - as in only when a user scrolls near the video. Recommended for optmized performance and bandwidth consumption',
			defaultValue: true,
			advanced: true
		}],
		shouldReceiveBuilderProps: {
			builderBlock: true
		}
	};
}

/** official `blocks/raw-text/component-info.ts` */
export function raw_text_info(): ComponentInfo {
	return {
		name: 'Builder:RawText',
		hideFromInsertMenu: true,
		inputs: [{
			name: 'text',
			bubble: true,
			type: 'longText',
			required: true
		}]
	};
}
