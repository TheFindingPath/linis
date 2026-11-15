import {MODES} from './modes.js';

export const SETTINGS_KEYS = ['apiKeys', 'provider', 'highlight', 'mode', 'autoSave', 'outputFormat', 'scanDepth', 'captureMode', 'groupComments'];
export function captureModeFor(preference, url) {
  if (preference === 'scroll' || preference === 'snapshot') return preference;
  try { return /(^|\.)(x\.com|twitter\.com|youtube\.com|youtu\.be|facebook\.com)$/.test(new URL(url).hostname) ? 'scroll' : 'snapshot'; } catch { return 'snapshot'; }
}
export const OUTPUT_FORMATS = Object.freeze({markdown: {name: 'Markdown', extension: 'md', mime: 'text/markdown'}, text: {name: 'Plain text', extension: 'txt', mime: 'text/plain'}, json: {name: 'Full JSON', extension: 'json', mime: 'application/json'}});

export const PROVIDERS = Object.freeze({
  typesafe: {name: 'TypeSafe', endpoint: 'https://api.typesafe.ai/v1/systemone', model: 'jev-latest', keyUrl: 'https://console.typesafe.ai/keys', modelPattern: /^jev-[a-z0-9.-]{1,80}$/},
  openrouter: {name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/alpha/decisions', model: '~typesafe/jev-latest', keyUrl: 'https://openrouter.ai/settings/keys', modelPattern: /^(?:~?typesafe\/)?jev-[a-z0-9.-]{1,80}$/}
});

export function providerFor(id) {
  if (!Object.hasOwn(PROVIDERS, id)) throw new Error('Unsupported Jev provider. Select TypeSafe or OpenRouter.');
  return PROVIDERS[id];
}

export function normalizeSettings(stored = {}) {
  const apiKeys = {};
  for (const id of Object.keys(PROVIDERS)) {
    if (typeof stored.apiKeys?.[id] === 'string' && stored.apiKeys[id].trim()) apiKeys[id] = stored.apiKeys[id].trim();
  }
  // Version 1.0 saved a single TypeSafe key. Move it without displaying it.
  if (!apiKeys.typesafe && typeof stored.apiKey === 'string' && stored.apiKey.trim()) apiKeys.typesafe = stored.apiKey.trim();
  return {provider: Object.hasOwn(PROVIDERS, stored.provider) ? stored.provider : 'typesafe', apiKeys, highlight: stored.highlight !== false, mode: Object.hasOwn(MODES, stored.mode) ? stored.mode : 'all', autoSave: stored.autoSave !== false, outputFormat: Object.hasOwn(OUTPUT_FORMATS, stored.outputFormat) ? stored.outputFormat : 'markdown', scanDepth: stored.scanDepth === 'standard' ? 'standard' : 'deep', captureMode: ['snapshot','scroll'].includes(stored.captureMode) ? stored.captureMode : 'auto', groupComments: stored.groupComments !== false};
}

export function publicSettings(settings) {
  return {provider: settings.provider, configured: !!settings.apiKeys[settings.provider], configuredProviders: Object.fromEntries(Object.keys(PROVIDERS).map(id => [id, !!settings.apiKeys[id]])), highlight: settings.highlight, mode: settings.mode, autoSave: settings.autoSave, outputFormat: settings.outputFormat, scanDepth: settings.scanDepth, captureMode: settings.captureMode, groupComments: settings.groupComments};
}
