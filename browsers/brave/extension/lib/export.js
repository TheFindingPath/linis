import {OUTPUT_FORMATS} from './settings.js';
import {MODES} from './modes.js';

export function selectedBlocks(result) {
  return (result?.decisions || []).filter(block => block.category !== 'skip');
}
export function recordFor(result, block) { return result?.page?.records?.[block.recordId] || null; }
function attribution(result, block) {
  const record=recordFor(result,block);if(!record)return [];
  const lines=[];
  if(record.author)lines.push('Author: '+record.author);
  if(record.authorTitle)lines.push('Author title: '+record.authorTitle);
  if(record.authorUrl)lines.push('Author URL: '+record.authorUrl);
  if(record.title)lines.push('Title: '+record.title);
  if(record.published)lines.push('Published: '+record.published);
  const parent=result.page.records?.[record.parentId];
  if(parent && parent.type!=='article')lines.push('Parent contribution: '+(parent.author || parent.title || parent.id));
  return lines;
}
export function asMarkdown(result) {
  const selected = selectedBlocks(result);
  const lines = [`# ${result.page.title.replace(/[\r\n]/g, ' ')}`, '', `Source: ${result.page.url}`, `Captured: ${result.page.capturedAt}`, `Goal: ${result.goal}`, `Jev: ${result.models.join(', ') || 'No completed decisions'}`, '', `Coverage: ${result.decisions.length}/${result.page.blocks.length} blocks evaluated. ${selected.length} selected. Status: ${result.status}.`, ''];
  if (result.error) lines.push(`Notice: ${result.error}`, '');
  if (result.notice) lines.push(`Capture notice: ${result.notice}`, '');
  if (result.endReason) lines.push(`End reason: ${result.endReason}`, '');
  if (result.provider) lines.push(`Provider: ${result.provider}`, '');
  if (result.mode && MODES[result.mode]) lines.push(`Mode: ${MODES[result.mode].name}`, '');
  if (result.metrics) lines.push(`Elapsed: ${(result.metrics.elapsedMs / 1000).toFixed(2)} seconds · ${result.metrics.blocksPerSecond.toFixed(1)} blocks/second`, '');
  for (const block of selected) {
    lines.push(`## ${block.category} · ${block.id}${block.review ? ' · Review suggested' : ''}`, '');
    lines.push(...attribution(result,block));
    if (block.heading && block.kind !== 'heading') lines.push(`Section: ${block.heading}`, '');
    lines.push(block.text.slice(block.contextCharacters || 0), '');
    for (const link of block.links || []) lines.push(`- ${link.text || 'Link'}: ${link.url}`);
    if (block.url) lines.push(`Image: ${block.url}`);
    lines.push('');
  }
  lines.push('## Coverage notes', '', ...result.page.coverage.warnings.map(warning => `- ${warning}`));
  return lines.join('\n');
}
export function asJson(result) {
  // Includes all captured blocks and decisions, including skipped/unprocessed evidence.
  return JSON.stringify({format: 'linis/1', ...result}, null, 2);
}

export function asText(result) {
  const lines = [result.page.title, '', `Source: ${result.page.url}`, `Captured: ${result.page.capturedAt}`, `Goal: ${result.goal}`, `Status: ${result.status}`, `Coverage: ${result.decisions.length}/${result.page.blocks.length} blocks evaluated.`, ''];
  if (result.provider) lines.push(`Provider: ${result.provider}`);
  if (result.mode && MODES[result.mode]) lines.push(`Mode: ${MODES[result.mode].name}`);
  lines.push(`Jev: ${result.models.join(', ') || 'No completed decisions'}`);
  if (result.metrics) lines.push(`Elapsed: ${(result.metrics.elapsedMs / 1000).toFixed(2)} seconds · ${result.metrics.blocksPerSecond.toFixed(1)} blocks/second`);
  lines.push('');
  if (result.error) lines.push(`Notice: ${result.error}`, '');
  if (result.notice) lines.push(`Capture notice: ${result.notice}`, '');
  if (result.endReason) lines.push(`End reason: ${result.endReason}`, '');
  for (const block of selectedBlocks(result)) {
    lines.push(...attribution(result,block));
    if (block.heading && block.kind !== 'heading') lines.push(block.heading);
    lines.push(block.text.slice(block.contextCharacters || 0));
    for (const link of block.links || []) lines.push(`${link.text || 'Link'}: ${link.url}`);
    if (block.url) lines.push(`Image: ${block.url}`);
    if (block.review) lines.push('Review suggested: Jev was uncertain about this block.');
    lines.push('');
  }
  lines.push('Coverage notes', ...result.page.coverage.warnings.map(note => `- ${note}`));
  return lines.join('\n');
}

export function fileFor(result, format) {
  if (!Object.hasOwn(OUTPUT_FORMATS, format)) throw new Error('Select a valid file format.');
  const spec = OUTPUT_FORMATS[format];
  const stem = (result.page.title || 'page').normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 65).replace(/^-|-$/g, '') || 'page';
  const stamp = (result.page.capturedAt || '').replace(/[^0-9TZ]/g, '').slice(0, 19);
  const status = result.status === 'complete' ? '' : '-partial';
  return {text: format === 'json' ? asJson(result) : format === 'text' ? asText(result) : asMarkdown(result), filename: `linis-${stem}${stamp ? `-${stamp}` : ''}${status}.${spec.extension}`, mime: spec.mime};
}
