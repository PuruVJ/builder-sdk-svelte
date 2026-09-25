/**
 * VENDORED from @builder.io/sdk-svelte@5.2.0 (lib/browser/blocks/personalization-container/helpers/
 * inlined-fns.js, MIT): the inline-script source the page runs must match the official byte for byte.
 * (Its type-only import of the official types was dropped.)
 *
 * WARNING: This file contains functions that get stringified and inlined into the HTML at build-time.
 * They cannot import anything.
 */
export function filterWithCustomTargeting(userAttributes, query, startDate, endDate) {
    function isString(val) {
        return typeof val === 'string';
    }
    function isNumber(val) {
        return typeof val === 'number';
    }
    function objectMatchesQuery(userattr, query) {
        const result = (() => {
            const property = query.property;
            const operator = query.operator;
            let testValue = query.value;
            if (query && query.property === 'urlPath' && query.value && typeof query.value === 'string' && query.value !== '/' && query.value.endsWith('/')) {
                testValue = query.value.slice(0, -1);
            }
            if (!(property && operator)) {
                return true;
            }
            if (Array.isArray(testValue)) {
                if (operator === 'isNot') {
                    return testValue.every(val => objectMatchesQuery(userattr, {
                        property,
                        operator,
                        value: val
                    }));
                }
                return !!testValue.find(val => objectMatchesQuery(userattr, {
                    property,
                    operator,
                    value: val
                }));
            }
            const value = userattr[property];
            if (Array.isArray(value)) {
                return value.includes(testValue);
            }
            switch (operator) {
                case 'is':
                    return value === testValue;
                case 'isNot':
                    return value !== testValue;
                case 'contains':
                    return (isString(value) || Array.isArray(value)) && value.includes(String(testValue));
                case 'startsWith':
                    return isString(value) && value.startsWith(String(testValue));
                case 'endsWith':
                    return isString(value) && value.endsWith(String(testValue));
                case 'greaterThan':
                    return isNumber(value) && isNumber(testValue) && value > testValue;
                case 'lessThan':
                    return isNumber(value) && isNumber(testValue) && value < testValue;
                case 'greaterThanOrEqualTo':
                    return isNumber(value) && isNumber(testValue) && value >= testValue;
                case 'lessThanOrEqualTo':
                    return isNumber(value) && isNumber(testValue) && value <= testValue;
                default:
                    return false;
            }
        })();
        return result;
    }
    const item = {
        query,
        startDate,
        endDate
    };
    const now = userAttributes.date && new Date(userAttributes.date) || new Date();
    if (item.startDate && new Date(item.startDate) > now) {
        return false;
    }
    else if (item.endDate && new Date(item.endDate) < now) {
        return false;
    }
    if (!item.query || !item.query.length) {
        return true;
    }
    return item.query.every((filter) => {
        return objectMatchesQuery(userAttributes, filter);
    });
}
export function updateVisibilityStylesScript(variants, blockId, isHydrationTarget, locale) {
    function getCookie(name) {
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ')
                c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0)
                return c.substring(nameEQ.length, c.length);
        }
        return null;
    }
    const visibilityStylesEl = document.currentScript?.previousElementSibling;
    if (!visibilityStylesEl) {
        return;
    }
    if (isHydrationTarget) {
        visibilityStylesEl.remove();
        const currentScript = document.currentScript;
        if (currentScript) {
            currentScript.remove();
        }
    }
    else {
        const attributes = JSON.parse(getCookie('builder.userAttributes') || '{}');
        if (locale) {
            attributes.locale = locale;
        }
        const winningVariantIndex = variants?.findIndex(function (variant) {
            return window.filterWithCustomTargeting(attributes, variant.query, variant.startDate, variant.endDate);
        });
        if (winningVariantIndex !== -1) {
            let newStyleStr = variants?.map((_, index) => {
                if (index === winningVariantIndex)
                    return '';
                return `div[data-variant-id="${blockId}-${index}"] { display: none !important; } `;
            }).join('') || '';
            newStyleStr += `div[data-variant-id="${blockId}-default"] { display: none !important; } `;
            visibilityStylesEl.innerHTML = newStyleStr;
        }
    }
}
export const PERSONALIZATION_SCRIPT = "function getPersonalizedVariant(variants, blockId, isHydrationTarget, locale) {\n  if (!navigator.cookieEnabled) {\n    return;\n  }\n  function getCookie(name) {\n    const nameEQ = name + '=';\n    const ca = document.cookie.split(';');\n    for (let i = 0; i < ca.length; i++) {\n      let c = ca[i];\n      while (c.charAt(0) == ' ') c = c.substring(1, c.length);\n      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);\n    }\n    return null;\n  }\n  const attributes = JSON.parse(getCookie('builder.userAttributes') || '{}');\n  if (locale) {\n    attributes.locale = locale;\n  }\n  const winningVariantIndex = variants?.findIndex(function (variant) {\n    return window.filterWithCustomTargeting(attributes, variant.query, variant.startDate, variant.endDate);\n  });\n  const parentDiv = document.currentScript?.parentElement;\n  const variantId = parentDiv?.getAttribute('data-variant-id');\n  const isDefaultVariant = variantId === `${blockId}-default`;\n  const isWinningVariant = winningVariantIndex !== -1 && variantId === `${blockId}-${winningVariantIndex}` || winningVariantIndex === -1 && isDefaultVariant;\n  if (isWinningVariant && !isDefaultVariant) {\n    parentDiv?.removeAttribute('hidden');\n    parentDiv?.removeAttribute('aria-hidden');\n  } else if (!isWinningVariant && isDefaultVariant) {\n    parentDiv?.setAttribute('hidden', 'true');\n    parentDiv?.setAttribute('aria-hidden', 'true');\n  }\n  if (isHydrationTarget) {\n    if (!isWinningVariant) {\n      const itsStyleEl = parentDiv?.previousElementSibling;\n      if (itsStyleEl) {\n        itsStyleEl.remove();\n      }\n      parentDiv?.remove();\n    }\n    const thisScript = document.currentScript;\n    if (thisScript) {\n      thisScript.remove();\n    }\n  }\n}";
export const FILTER_WITH_CUSTOM_TARGETING_SCRIPT = "function filterWithCustomTargeting(userAttributes, query, startDate, endDate) {\n  function isString(val) {\n    return typeof val === 'string';\n  }\n  function isNumber(val) {\n    return typeof val === 'number';\n  }\n  function objectMatchesQuery(userattr, query) {\n    const result = (() => {\n      const property = query.property;\n      const operator = query.operator;\n      let testValue = query.value;\n      if (query && query.property === 'urlPath' && query.value && typeof query.value === 'string' && query.value !== '/' && query.value.endsWith('/')) {\n        testValue = query.value.slice(0, -1);\n      }\n      if (!(property && operator)) {\n        return true;\n      }\n      if (Array.isArray(testValue)) {\n        if (operator === 'isNot') {\n          return testValue.every(val => objectMatchesQuery(userattr, {\n            property,\n            operator,\n            value: val\n          }));\n        }\n        return !!testValue.find(val => objectMatchesQuery(userattr, {\n          property,\n          operator,\n          value: val\n        }));\n      }\n      const value = userattr[property];\n      if (Array.isArray(value)) {\n        return value.includes(testValue);\n      }\n      switch (operator) {\n        case 'is':\n          return value === testValue;\n        case 'isNot':\n          return value !== testValue;\n        case 'contains':\n          return (isString(value) || Array.isArray(value)) && value.includes(String(testValue));\n        case 'startsWith':\n          return isString(value) && value.startsWith(String(testValue));\n        case 'endsWith':\n          return isString(value) && value.endsWith(String(testValue));\n        case 'greaterThan':\n          return isNumber(value) && isNumber(testValue) && value > testValue;\n        case 'lessThan':\n          return isNumber(value) && isNumber(testValue) && value < testValue;\n        case 'greaterThanOrEqualTo':\n          return isNumber(value) && isNumber(testValue) && value >= testValue;\n        case 'lessThanOrEqualTo':\n          return isNumber(value) && isNumber(testValue) && value <= testValue;\n        default:\n          return false;\n      }\n    })();\n    return result;\n  }\n  const item = {\n    query,\n    startDate,\n    endDate\n  };\n  const now = userAttributes.date && new Date(userAttributes.date) || new Date();\n  if (item.startDate && new Date(item.startDate) > now) {\n    return false;\n  } else if (item.endDate && new Date(item.endDate) < now) {\n    return false;\n  }\n  if (!item.query || !item.query.length) {\n    return true;\n  }\n  return item.query.every(filter => {\n    return objectMatchesQuery(userAttributes, filter);\n  });\n}";
export const UPDATE_VISIBILITY_STYLES_SCRIPT = "function updateVisibilityStylesScript(variants, blockId, isHydrationTarget, locale) {\n  function getCookie(name) {\n    const nameEQ = name + '=';\n    const ca = document.cookie.split(';');\n    for (let i = 0; i < ca.length; i++) {\n      let c = ca[i];\n      while (c.charAt(0) == ' ') c = c.substring(1, c.length);\n      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);\n    }\n    return null;\n  }\n  const visibilityStylesEl = document.currentScript?.previousElementSibling;\n  if (!visibilityStylesEl) {\n    return;\n  }\n  if (isHydrationTarget) {\n    visibilityStylesEl.remove();\n    const currentScript = document.currentScript;\n    if (currentScript) {\n      currentScript.remove();\n    }\n  } else {\n    const attributes = JSON.parse(getCookie('builder.userAttributes') || '{}');\n    if (locale) {\n      attributes.locale = locale;\n    }\n    const winningVariantIndex = variants?.findIndex(function (variant) {\n      return window.filterWithCustomTargeting(attributes, variant.query, variant.startDate, variant.endDate);\n    });\n    if (winningVariantIndex !== -1) {\n      let newStyleStr = variants?.map((_, index) => {\n        if (index === winningVariantIndex) return '';\n        return `div[data-variant-id=\"${blockId}-${index}\"] { display: none !important; } `;\n      }).join('') || '';\n      newStyleStr += `div[data-variant-id=\"${blockId}-default\"] { display: none !important; } `;\n      visibilityStylesEl.innerHTML = newStyleStr;\n    }\n  }\n}";
