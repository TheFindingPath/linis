import {collectPage, drainPageCapture} from './lib/collector.js';
import {makeBatches, decideBatch} from './lib/jev.js';
import {normalizeSettings, publicSettings, providerFor, SETTINGS_KEYS, OUTPUT_FORMATS, captureModeFor} from './lib/settings.js';
import {updatePageHighlights} from './lib/highlight.js';
import {composeGoal, MODES} from './lib/modes.js';
import {fileFor} from './lib/export.js';

let active = null;
const ready = (async () => {
  await Promise.all([
    chrome.storage.local.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'}),
    chrome.storage.session.setAccessLevel({accessLevel: 'TRUSTED_CONTEXTS'})
  ]);
  const stored = await chrome.storage.local.get(['apiKey', ...SETTINGS_KEYS]);
  await chrome.storage.local.set(normalizeSettings(stored));
  await chrome.storage.local.remove('apiKey');
})();
const saveJob = job => chrome.storage.session.set({job});
const getSettings = async () => normalizeSettings(await chrome.storage.local.get(SETTINGS_KEYS));
async function persistCurrent(job) {
  const stored = (await chrome.storage.session.get('job')).job;
  if (stored?.id !== job.id || active && active.job.id !== job.id) return;
  await saveJob(job);
}
function downloadState(job, state) {
  job.download.state = state === 'interrupted' ? 'interrupted' : state;
  if (state === 'interrupted') job.fileWarning = 'The file download did not finish. Use Save file to retry.';
}
async function downloadJob(job, format, automatic) {
  const file = fileFor(job.result, format);
  try {
    const id = await chrome.downloads.download({url: `data:${file.mime};charset=utf-8,${encodeURIComponent(file.text.toWellFormed())}`, filename: file.filename, saveAs: false, conflictAction: 'uniquify'});
    job.download = {id, filename: file.filename, format, automatic, state: 'in_progress'};
    delete job.fileWarning;
    // A small local download can finish before the onChanged listener sees its id.
    const [item] = await chrome.downloads.search({id});
    if (item) downloadState(job, item.state);
  } catch {
    job.fileWarning = 'The file could not be saved. Use Save file to retry, and check the browser’s download settings.';
  }
}
chrome.downloads.onChanged.addListener(delta => {
  if (!delta.state?.current) return;
  (async () => {
    await ready;
    const job = active?.job || (await chrome.storage.session.get('job')).job;
    if (!job?.download || job.download.id !== delta.id) return;
    downloadState(job, delta.state.current);
    await persistCurrent(job);
  })().catch(() => {});
});
async function highlights(job, type, ids = [], discardTargets = false) {
  if (!job.highlight && type !== 'clear') return;
  try {
    await chrome.scripting.executeScript({target: {tabId: job.tabId}, func: updatePageHighlights, args: [{type, jobId: job.id, ids, decisions: job.result?.decisions.map(({id, category}) => ({id, category})) || [], done: job.done, total: job.total, capturing: job.capturing, startedAt: job.startedAt, providerName: providerFor(job.provider).name, discardTargets}]});
  } catch {
    if (type !== 'clear') job.highlightWarning = 'Page highlights are unavailable on this page. Extraction can continue.';
  }
}
function updateMetrics(job) {
  if (!job.result) return;
  const elapsedMs = Date.now() - Date.parse(job.startedAt);
  job.result.metrics = {elapsedMs, blocksPerSecond: elapsedMs > 0 ? job.done * 1000 / elapsedMs : 0};
}
async function extract(tabId, goal, controller, job) {
  // Keep the bounded job alive; scroll capture drains only changed DOM records.
  const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo().catch(() => {}), 20000);
  const deadline = setTimeout(() => controller.abort('deadline'), 240000);
  let captureOpen=false;
  try {
    const settings = await getSettings();
    const apiKey = settings.apiKeys[job.provider];
    if (!apiKey) throw new Error(`Add your ${providerFor(job.provider).name} API key in Connection first.`);
    const tab = await chrome.tabs.get(tabId);
    if (!/^https?:\/\//.test(tab.url || '')) throw new Error('Open a regular HTTP or HTTPS web page, then click the linis toolbar button. Browser settings, extension pages, PDFs, and browser stores cannot be scanned.');
    job.captureMode=captureModeFor(settings.captureMode,tab.url);
    job.capturing=job.captureMode==='scroll';captureOpen=job.capturing;
    job.phase = 'Reading loaded page content';
    await saveJob(job);
    let captures;
    try { captures = await chrome.scripting.executeScript({target: {tabId}, func: collectPage, args:[{depth:job.scanDepth,groupComments:job.groupComments,watch:captureOpen}]}); }
    catch { throw new Error('Page access was unavailable. Return to the source page and click linis in the toolbar again. Browser stores and protected pages cannot be scanned.'); }
    const page = captures.find(frame => frame.frameId === 0)?.result;
    if (!page || !page.blocks.length && !captureOpen) throw new Error('No readable page content was found. Load the content first, then try again.');
    job.result = {page, provider: job.provider, mode: job.mode, goal, decisions: [], models: [], status: 'running'};
    job.total = page.blocks.length;
    if (controller.signal.aborted) throw new Error('Extraction stopped.');
    if(page.coverage.truncated){captureOpen=false;job.capturing=false;}
    const batches = makeBatches(page.blocks,page.records);
    const captureStarted=Date.now();
    function captureEnded(reason){
      job.captureEndReason=reason;
      job.notice={user_finish:'Scroll capture finished at your request.',capture_timeout:'The two-minute capture window ended automatically. Only content captured before it closed was evaluated.',capture_limit:'Scroll capture ended at a capture limit. See coverage notes.',source_changed:'Scroll capture ended because the source page changed or was reloaded.',capture_ended:'Scroll capture ended. Only captured content was evaluated.'}[reason];
    }
    async function pull(finishReason=''){
      const finish=!!finishReason;
      const [frame]=await chrome.scripting.executeScript({target:{tabId},func:drainPageCapture,args:[finish]});
      const delta=frame?.result;if(!delta)return false;
      Object.assign(page.records,delta.records);
      page.blocks.push(...delta.blocks);
      if(delta.coverage)page.coverage=delta.coverage;
      else if(delta.ended){page.coverage.watching=false;page.coverage.warnings.push('Scroll capture ended because the source page changed or was reloaded.');}
      if(delta.ended || page.coverage.truncated){
        captureOpen=false;
        captureEnded(!delta.coverage?'source_changed':page.coverage.truncated?'capture_limit':finishReason || 'capture_ended');
      }
      job.capturing=captureOpen;job.total=page.blocks.length;
      if(delta.blocks.length)batches.push(...makeBatches(delta.blocks,page.records));
      else if(delta.refreshedTargets)await highlights(job,'settled');
      return delta.blocks.length>0;
    }
    job.total = page.blocks.length;
    while (batches.length || captureOpen) {
      if (controller.signal.aborted) throw new Error('Extraction stopped.');
      if(captureOpen)await pull(active.finishRequested?'user_finish':Date.now()-captureStarted>=120000?'capture_timeout':page.coverage.truncated?'capture_limit':'');
      const batch=batches.shift();
      if(!batch){
        if(!captureOpen)break;
        if(job.phase!=='Scroll the page to load more. Choose Finish & save when ready.'){
          job.phase='Scroll the page to load more. Choose Finish & save when ready.';
          await highlights(job,'settled');await saveJob(job);
        }
        await new Promise(resolve=>setTimeout(resolve,450));continue;
      }
      job.phase = `Jev is evaluating ${job.done + 1}–${job.done + batch.length} of ${job.total} blocks`;
      active.currentIds = batch.map(block => block.id);
      await highlights(job, 'batch', active.currentIds);
      await saveJob(job);
      const response = await decideBatch(page, batch, goal, apiKey, {signal: controller.signal, provider: job.provider, mode: job.mode});
      if (controller.signal.aborted) throw new Error('Extraction stopped.');
      job.result.decisions.push(...response.decisions);
      if (!job.result.models.includes(response.model)) job.result.models.push(response.model);
      job.done += batch.length;
      active.currentIds = [];
      updateMetrics(job);
      await highlights(job, 'settled');
      await saveJob(job);
    }
    job.endReason = job.captureEndReason || 'completed';
    job.status = 'complete';
    job.result.status = 'complete';
    job.phase = 'Extraction complete';
  } catch (error) {
    job.status = controller.signal.aborted ? 'stopped' : 'error';
    job.endReason=controller.signal.aborted?(controller.signal.reason==='deadline'?'deadline':'cancelled'):'error';
    job.error = job.endReason==='deadline'?'The four-minute extraction deadline was reached. Results are partial; completed decisions are preserved.':controller.signal.aborted?'Extraction cancelled by you. Results are partial; completed decisions are preserved.':error.message;
    job.phase = job.endReason==='deadline'?'Time limit reached':job.status === 'stopped' ? 'Cancelled' : 'Extraction needs attention';
    if (job.result) { job.result.status = job.status; job.result.error = job.error; }
  } finally {
    clearInterval(keepAlive); clearTimeout(deadline);
    if(job.captureMode==='scroll'){
      try{
        const [frame]=await chrome.scripting.executeScript({target:{tabId},func:drainPageCapture,args:[true]});
        const delta=frame?.result;
        if(job.result&&delta){job.result.page.blocks.push(...delta.blocks);Object.assign(job.result.page.records,delta.records);if(delta.coverage)job.result.page.coverage=delta.coverage;job.total=job.result.page.blocks.length;}
      }catch{}
    }
    job.capturing=false;
    if(job.result){
      job.result.page.coverage.watching=false;
      job.result.endReason=job.endReason;
      if(job.captureEndReason)job.result.captureEndReason=job.captureEndReason;
      if(job.notice){job.result.notice=job.notice;job.result.page.coverage.warnings=[...new Set([...job.result.page.coverage.warnings,job.notice])];}
    }
    job.finishedAt = new Date().toISOString();
    updateMetrics(job);
    await highlights(job, job.status === 'complete' && job.highlight ? 'finish' : 'clear', [], job.status !== 'complete' || !job.highlight);
    if (job.status === 'complete' && (job.autoSave || job.saveOnFinish)) await downloadJob(job, job.outputFormat, !job.saveOnFinish);
    try { await saveJob(job); } finally { active = null; }
  }
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  // Only our own trusted extension pages can start requests or access settings.
  if (sender.id !== chrome.runtime.id || sender.tab && !sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  (async () => {
    await ready;
    switch (message?.type) {
      case 'settings': return publicSettings(await getSettings());
      case 'setPreferences': {
        if (active) throw new Error('Wait for extraction to finish before changing these settings.');
        const patch = {};
        if (Object.hasOwn(message, 'mode')) {
          if (!Object.hasOwn(MODES, message.mode)) throw new Error('Select a valid extraction mode.');
          patch.mode = message.mode;
        }
        if (Object.hasOwn(message, 'autoSave')) {
          if (typeof message.autoSave !== 'boolean') throw new Error('Invalid automatic save preference.');
          patch.autoSave = message.autoSave;
        }
        if (Object.hasOwn(message, 'outputFormat')) {
          if (!Object.hasOwn(OUTPUT_FORMATS, message.outputFormat)) throw new Error('Select a valid file format.');
          patch.outputFormat = message.outputFormat;
        }
        if(Object.hasOwn(message,'scanDepth')){if(!['standard','deep'].includes(message.scanDepth))throw new Error('Select a valid scan depth.');patch.scanDepth=message.scanDepth;}
        if(Object.hasOwn(message,'captureMode')){if(!['auto','snapshot','scroll'].includes(message.captureMode))throw new Error('Select a valid capture mode.');patch.captureMode=message.captureMode;}
        if(Object.hasOwn(message,'groupComments')){if(typeof message.groupComments!=='boolean')throw new Error('Invalid comment grouping preference.');patch.groupComments=message.groupComments;}
        await chrome.storage.local.set(patch);
        return publicSettings(await getSettings());
      }
      case 'export': {
        if (active) throw new Error('Wait for extraction to finish, or stop it before saving partial results.');
        const {job} = await chrome.storage.session.get('job');
        if (!job?.result) throw new Error('Extract a page before saving a file.');
        const settings = await getSettings();
        await downloadJob(job, message.format || settings.outputFormat, false);
        await persistCurrent(job);
        return {job};
      }
      case 'setProvider': {
        if (active) throw new Error('Stop extraction before changing providers.');
        providerFor(message.provider);
        await chrome.storage.local.set({provider: message.provider});
        return publicSettings(await getSettings());
      }
      case 'setHighlight': {
        if (typeof message.enabled !== 'boolean') throw new Error('Invalid highlight preference.');
        await chrome.storage.local.set({highlight: message.enabled});
        if (active) {
          active.job.highlight = message.enabled;
          await highlights(active.job, message.enabled ? 'batch' : 'clear', active.currentIds);
          await saveJob(active.job);
        } else if (!message.enabled) {
          const {job} = await chrome.storage.session.get('job');
          if (job) await highlights(job, 'clear');
        }
        return publicSettings(await getSettings());
      }
      case 'saveKey': {
        if (active) throw new Error('Stop extraction before changing keys.');
        providerFor(message.provider);
        const key = typeof message.key === 'string' ? message.key.trim() : '';
        if (!key || key.length > 512 || /\s/.test(key)) throw new Error(`Enter a valid ${providerFor(message.provider).name} API key.`);
        const settings = await getSettings();
        await chrome.storage.local.set({apiKeys: {...settings.apiKeys, [message.provider]: key}});
        return publicSettings(await getSettings());
      }
      case 'forgetKey': {
        if (active) throw new Error('Stop extraction before changing keys.');
        providerFor(message.provider);
        const settings = await getSettings();
        delete settings.apiKeys[message.provider];
        await chrome.storage.local.set({apiKeys: settings.apiKeys});
        return publicSettings(await getSettings());
      }
      case 'status': {
        const {job} = await chrome.storage.session.get('job');
        if (job?.status === 'running' && !active) {
          job.status = 'error'; job.error = 'The browser interrupted this extraction. Completed decisions are preserved; start again to rescan.'; job.phase = 'Interrupted'; job.endReason='interrupted';
          if (job.result) { job.result.status = 'error'; job.result.error = job.error; job.result.endReason='interrupted'; }
          if(job.result)job.result.page.coverage.watching=false;
          if(job.captureMode==='scroll'){try{await chrome.scripting.executeScript({target:{tabId:job.tabId},func:drainPageCapture,args:[true]});}catch{}}
          await highlights({...job, provider: job.provider || 'typesafe'}, 'clear', [], true);
          await saveJob(job);
        }
        return {job: job || null};
      }
      case 'start': {
        if (active) throw new Error('An extraction is already running. Stop it before starting another.');
        if (!Number.isInteger(message.tabId) || typeof message.goal !== 'string' || message.goal.length > 1000) throw new Error('Invalid extraction request.');
        const controller = new AbortController();
        const settings = await getSettings();
        // Another start could arrive while storage was loading.
        if (active) throw new Error('An extraction is already running. Stop it before starting another.');
        const goal = composeGoal(settings.mode, message.goal);
        const job = {id: crypto.randomUUID(), tabId: message.tabId, provider: settings.provider, highlight: settings.highlight, mode: settings.mode, autoSave: settings.autoSave, outputFormat: settings.outputFormat, scanDepth:settings.scanDepth,groupComments:settings.groupComments, goal, status: 'running', phase: 'Starting', done: 0, total: 0, startedAt: new Date().toISOString()};
        active = {controller, job, currentIds: [],finishRequested:false};
        try { await saveJob(job); } catch (error) { active = null; throw error; }
        void extract(message.tabId, goal, controller, job);
        return {job};
      }
      case 'stop': active?.controller.abort('cancelled'); return {ok: true};
      case 'finishCapture': if(active){active.finishRequested=true;active.job.saveOnFinish=true;} return {ok:true};
      case 'clear': {
        if (active) throw new Error('Stop extraction before clearing results.');
        const {job} = await chrome.storage.session.get('job');
        if (job) await highlights({...job, provider: job.provider || 'typesafe'}, 'clear', [], true);
        await chrome.storage.session.remove('job'); return {ok: true};
      }
      default: throw new Error('Unknown request.');
    }
  })().then(reply, error => reply({error: error.message}));
  return true;
});
