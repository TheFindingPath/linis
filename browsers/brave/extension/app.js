import {selectedBlocks, asMarkdown, recordFor} from './lib/export.js';
import {providerFor, OUTPUT_FORMATS, SETTINGS_KEYS, captureModeFor} from './lib/settings.js';
import {MODES} from './lib/modes.js';

if (new URL(location.href).searchParams.has('source')) document.documentElement.classList.add('workspace');

const $ = id => document.getElementById(id);
$('version').textContent = 'v' + chrome.runtime.getManifest().version;
let sourceTabId = null;
let sourceTabUrl = '';
let configured = false;
let job = null;
let lastRendered = '';
let cardViewKey='',renderedIds=new Set();
let connection = {provider: 'typesafe', highlight: true, mode: 'all', autoSave: true, outputFormat: 'markdown'};
let savingPreferences = false;
let settingsVersion = 0;
async function send(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({type, ...extra});
  if (response?.error) throw new Error(response.error);
  return response;
}
function notice(message = '') {
  $('notice').textContent = message;
  $('notice').hidden = !message;
}
function updateButtons() {
  const running = job?.status === 'running';
  $('extract').disabled = !configured || !sourceTabId || running || savingPreferences;
  $('stop').hidden = !running;
  $('stop').textContent = job?.capturing ? 'Finish & save' : 'Stop';
  $('cancel-capture').hidden = !running || job?.captureMode!=='scroll';
  $('goal').disabled = running;
  $('clear').disabled = running;
  $('save-file').disabled = running || !job?.result || savingPreferences;
  $('save-file').hidden = running;
  for (const id of ['provider', 'api-key', 'save-key', 'forget-key', 'mode', 'auto-save', 'output-format', 'markdown', 'text', 'json', 'copy', 'scan-depth', 'capture-mode', 'group-comments']) $(id).disabled = running || savingPreferences;
  $('extract').firstElementChild.textContent = running ? job?.capturing?'Capturing…':'Jev is reading…' : captureModeFor(connection.captureMode,sourceTabUrl)==='scroll'?'Start scroll capture':'Extract this page';
}
function setConnection(settings) {
  if (savingPreferences) return;
  connection = settings;
  configured = settings.configured;
  const route = providerFor(settings.provider);
  $('provider').value = settings.provider;
  $('highlight').checked = settings.highlight;
  $('mode').value = settings.mode;
  $('mode-hint').textContent = MODES[settings.mode].hint;
  $('auto-save').checked = settings.autoSave;
  $('output-format').value = settings.outputFormat;
  $('capture-mode').value=settings.captureMode;
  $('scan-depth').value=settings.scanDepth;
  $('group-comments').checked=settings.groupComments;
  $('capture-hint').textContent=captureModeFor(settings.captureMode,sourceTabUrl)==='scroll'?'Scroll capture: load more posts/comments on the source page, then choose Finish & save.':'Snapshot: captures the loaded page, including loaded content below the screen.';
  $('output-settings').textContent = settings.autoSave ? `Auto-save: ${OUTPUT_FORMATS[settings.outputFormat].name}` : `Auto-save off · ${OUTPUT_FORMATS[settings.outputFormat].name}`;
  $('save-file').textContent = `↓ Save .${OUTPUT_FORMATS[settings.outputFormat].extension}`;
  $('save-file').title = `Save all selected information as ${OUTPUT_FORMATS[settings.outputFormat].name}`;
  $('connection-dot').classList.toggle('ready', configured);
  $('connection-label').textContent = configured ? `${route.name} ready` : `Set up ${route.name}`;
  $('active-provider').textContent = configured ? `${route.name} · ${MODES[settings.mode].name}` : `Set up ${route.name} in Settings`;
  $('forget-key').hidden = !configured;
  $('api-key').placeholder = configured ? 'Key saved · paste to replace' : 'Paste your key';
  $('api-key-label').textContent = `${route.name} API key`;
  $('key-link').href = route.keyUrl;
  $('provider-detail').textContent = `Model: ${route.model} · Internet and API credits required. The extension hosts the client; your selected provider serves Jev inference.`;
  $('privacy').textContent = `When you extract, loaded page text and URLs go to ${route.name}’s Jev API. Your form inputs stay out.`;
  if (!configured) $('connection').open = true;
  updateButtons();
}
async function refreshSettings() {
  const version = ++settingsVersion;
  const settings = await send('settings');
  if (version === settingsVersion) setConnection(settings);
}
function safeLink(url) {
  try { return ['https:', 'http:', 'mailto:', 'tel:'].includes(new URL(url).protocol); } catch { return false; }
}
function renderCards() {
  const result = job?.result;
  if (!result) return;
  const query = $('filter').value.toLocaleLowerCase();
  const category = $('category').value;
  const reviewOnly = $('review-only').checked;
  const candidates=$('show-rejected').checked || category==='skip' ? result.decisions : selectedBlocks(result);
  const blocks = candidates.filter(block => {
    const record=recordFor(result,block);
    return (category === 'all' || block.category === category) && (!reviewOnly || block.review) && [block.text, block.heading, record?.author, record?.authorTitle, record?.title, ...(block.links || []).map(link => link.url)].join(' ').toLocaleLowerCase().includes(query);
  });
  const viewKey=[job.id,query,category,reviewOnly,$('show-rejected').checked].join('|');
  if(viewKey!==cardViewKey || blocks.length<renderedIds.size){$('cards').replaceChildren();renderedIds.clear();cardViewKey=viewKey;}
  $('cards').querySelector('.empty')?.remove();
  for (const block of blocks) {
    if(renderedIds.has(block.id))continue;
    const card = document.createElement('article'); card.className = 'card'+(block.category==='skip'?' rejected':'');
    const top = document.createElement('div'); top.className = 'card-top';
    const category = document.createElement('span'); category.textContent = `${block.category==='skip'?'rejected':block.category} / ${block.id}`; top.append(category);
    if (block.review) { const review = document.createElement('span'); review.className = 'review'; review.textContent = 'Review suggested'; top.append(review); }
    card.append(top);
    const record=recordFor(result,block);
    if(record){
      const context=document.createElement('p');context.className='record-context';
      const parent=result.page.records?.[record.parentId];
      context.textContent=[record.author&&'Author: '+record.author,record.authorTitle,record.title&&'Title: '+record.title,record.published,parent&&parent.type!=='article'&&'Parent contribution: '+(parent.author||parent.title||parent.id)].filter(Boolean).join(' · ');
      if(context.textContent)card.append(context);
    }
    if (block.heading && block.kind !== 'heading') { const h = document.createElement('p'); h.className = 'card-heading'; h.textContent = block.heading; card.append(h); }
    const text = document.createElement('p'); text.className = 'card-text'; text.textContent = block.text.slice(block.contextCharacters || 0); card.append(text);
    const links = document.createElement('div'); links.className = 'card-links';
    for (const link of [...(block.links || []), ...(block.url ? [{text: 'Image source', url: block.url}] : [])]) {
      if (!safeLink(link.url)) continue;
      const a = document.createElement('a'); a.textContent = link.text || link.url; a.href = link.url; a.target = '_blank'; a.rel = 'noreferrer noopener'; links.append(a);
    }
    if (links.childElementCount) card.append(links);
    $('cards').append(card);
    renderedIds.add(block.id);
  }
  if (!blocks.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = query || category !== 'all' || reviewOnly ? 'No results match these filters.' : job.status === 'running' ? 'Jev’s decisions will appear here.' : 'Jev selected no blocks. Try a broader mode or focus. Full JSON includes the scanned evidence.'; $('cards').append(empty); }
}
function render(next) {
  job = next;
  updateButtons();
  $('progress-panel').hidden = !job;
  $('results').hidden = !job?.result;
  $('file-status').hidden = !job?.download;
  if (!job) { lastRendered = ''; return; }
  $('phase').textContent = job.phase;
  $('counts').textContent = job.total ? `${job.done}/${job.total}` : '';
  $('status-dot').className = `status-dot ${job.status}`;
  $('progress').value = job.total ? 100 * job.done / job.total : 0;
  notice([job.error, job.notice, job.highlightWarning, job.fileWarning,job.result?.page.coverage.truncated?'Capture is partial: '+(job.result.page.coverage.limitReason || 'scan limit reached')+'.':'',job.result?.page.coverage.omitted?'Some complex source groups were omitted. See coverage notes.':'',job.result?.page.coverage.collapsed?'Some posts are collapsed. Expand Show more on the source page to capture the remaining text.':''].filter(Boolean).join(' '));
  if (job.download) $('file-status').textContent = `${job.download.state === 'complete' ? 'Saved to Downloads' : job.download.state === 'interrupted' ? 'Download interrupted' : 'Saving file'}: ${job.download.filename}`;
  const result = job.result;
  if (!result) return;
  $('result-title').textContent = result.page.title || 'Untitled page';
  const selected = selectedBlocks(result);
  $('summary').textContent = `${result.page.blocks.length} captured · ${result.decisions.length} evaluated · ${selected.length} kept · ${result.decisions.length-selected.length} rejected${result.mode && MODES[result.mode] ? ` · ${MODES[result.mode].name}` : ''}${result.provider ? ` · ${providerFor(result.provider).name}` : ''}${result.metrics ? ` · ${(result.metrics.elapsedMs / 1000).toFixed(1)}s` : ''}${job.status !== 'complete' ? ' · In progress or partial' : ''}`;
  const signature = `${job.id}:${job.done}:${job.status}`;
  if (signature !== lastRendered) { renderCards(); lastRendered = signature; }
  const coverage = $('coverage-content'); coverage.replaceChildren();
  const info = document.createElement('p'); info.textContent = `${result.page.url}\n${result.page.capturedAt}\n${result.page.coverage.characters.toLocaleString()} characters captured. ${result.page.coverage.truncated ? 'Scan limit reached.' : 'Loaded page scan completed.'} ${result.decisions.length}/${result.page.blocks.length} blocks evaluated by Jev.`; coverage.append(info);
  const list = document.createElement('ul');
  for (const warning of result.page.coverage.warnings) { const li = document.createElement('li'); li.textContent = warning; list.append(li); }
  coverage.append(list);
}
async function exportFile(format) {
  render((await send('export', {format})).job);
}
function openSettings() {
  $('capture-settings').open = true;
  $('preferences').open = true;
  if (!configured) $('connection').open = true;
  $('preferences').scrollIntoView({block: 'start'});
}
function action(id, callback) {
  $(id).addEventListener('click', async () => { try { await callback(); } catch (error) { notice(error.message); } });
}
action('extract', async () => { notice(); render((await send('start', {tabId: sourceTabId, goal: $('goal').value.trim()})).job); });
action('stop', () => send(job?.capturing ? 'finishCapture' : 'stop'));
action('cancel-capture', () => send('stop'));
action('clear', async () => { await send('clear'); render(null); notice(); });
action('save-key', async () => { const response = await send('saveKey', {provider: connection.provider, key: $('api-key').value}); $('api-key').value = ''; setConnection(response); $('connection').open = false; notice('Key saved. Ready to extract.'); });
action('forget-key', async () => { setConnection(await send('forgetKey', {provider: connection.provider})); $('api-key').value = ''; notice('Saved key removed for this provider.'); });
action('workspace', async () => { await chrome.tabs.create({url: chrome.runtime.getURL(`app.html?source=${sourceTabId || ''}`)}); });
action('save-file', () => exportFile(connection.outputFormat));
action('markdown', () => exportFile('markdown'));
action('text', () => exportFile('text'));
action('json', () => exportFile('json'));
action('open-settings', openSettings);
action('output-settings', openSettings);
action('copy', async () => { await navigator.clipboard.writeText(asMarkdown(job.result)); notice('Extracted information copied.'); });
$('filter').addEventListener('input', renderCards);
$('category').addEventListener('change', renderCards);
$('review-only').addEventListener('change', renderCards);
$('show-rejected').addEventListener('change', renderCards);
for (const [id, field] of [['mode', 'mode'], ['auto-save', 'autoSave'], ['output-format', 'outputFormat'], ['capture-mode','captureMode'],['scan-depth','scanDepth'],['group-comments','groupComments']]) {
  $(id).addEventListener('change', async () => {
    const value = ['autoSave','groupComments'].includes(field) ? $(id).checked : $(id).value;
    savingPreferences = true; settingsVersion++; updateButtons();
    try { await send('setPreferences', {[field]: value}); }
    catch (error) { notice(error.message); }
    finally { savingPreferences = false; await refreshSettings().catch(error => notice(error.message)); updateButtons(); }
  });
}
$('provider').addEventListener('change', async () => {
  $('api-key').value = '';
  try { setConnection(await send('setProvider', {provider: $('provider').value})); notice(); }
  catch (error) { $('provider').value = connection.provider; notice(error.message); }
});
$('highlight').addEventListener('change', async () => {
  try { setConnection(await send('setHighlight', {enabled: $('highlight').checked})); }
  catch (error) { $('highlight').checked = connection.highlight; notice(error.message); }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.job) render(changes.job.newValue || null);
  if (area === 'local' && SETTINGS_KEYS.some(key => changes[key])) refreshSettings().catch(error => notice(error.message));
});
try {
  const source = new URL(location.href).searchParams.get('source');
  let tab;
  if (source && /^\d+$/.test(source)) tab = await chrome.tabs.get(Number(source));
  else [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (tab?.id && /^https?:\/\//.test(tab.url || '')) {
    sourceTabId = tab.id;sourceTabUrl=tab.url; $('source').textContent = tab.title || new URL(tab.url).hostname; $('source').title = tab.url;
  } else $('source').textContent = 'Open a web page, then click linis in the toolbar';
  setConnection(await send('settings'));
  render((await send('status')).job);
} catch (error) { $('source').textContent = 'Source page unavailable'; notice(error.message); }
