import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildRequest, validateResponse, makeBatches, decideBatch, CATEGORIES, ENDPOINT, MAX_REQUEST_BYTES} from '../extension/lib/jev.js';
import {asMarkdown, asJson, asText, fileFor} from '../extension/lib/export.js';
import {normalizeSettings, publicSettings, providerFor, captureModeFor} from '../extension/lib/settings.js';
import {composeGoal} from '../extension/lib/modes.js';
const block = {id:'b1',kind:'text',heading:'Specs',text:'Battery life: 36 hours',links:[]};
const page = {title:'Guide',url:'https://example.org',capturedAt:'2026-11-07T00:00:00.000Z',blocks:[block],coverage:{warnings:['Loaded content only.']}};
function response(choice='data') { return {model:'jev-1.13.0',answers:{b1:{type:'choice',choice,confidence:1,probabilities:Object.fromEntries(Object.keys(CATEGORIES).map(key=>[key,Number(key===choice)]))}}}; }
test('batching accounts for serialized source evidence, not only the text', () => {
  const blocks = Array.from({length:35},(_,i)=>({...block,id:`b${i}`,text:'x'.repeat(2200),links:[{text:'manual',url:'https://example.org/'+'a'.repeat(1000)}]}));
  const batches = makeBatches(blocks);
  assert.equal(batches.flat().length,35);
  assert.ok(batches.every(batch=>batch.length<=16 && batch.reduce((sum,b)=>sum+JSON.stringify(b).length,0)<=18000));
  assert.throws(()=>makeBatches([{...block,text:'x'.repeat(18001)}]),/evidence-batch budget/);
});
test('Jev evaluates one independently referenced question per block', () => {
  const request=buildRequest(page,[block],'find specifications');
  assert.deepEqual(request.state.untrustedPageBlocks,[block]);
  assert.match(request.questions.b1.instructions,/ONLY page block b1/);
  assert.equal(request.state.extractionGoal,'find specifications');
});
test('accepts typed Jev decisions and rejects malformed or invented choices', () => {
  assert.equal(validateResponse(response(),[block])[0].category,'data');
  for(const mutate of [r=>r.answers.b1.choice='invented',r=>r.answers.b1.confidence=NaN,r=>r.answers.b1.probabilities.data=.3,r=>delete r.answers.b1.probabilities.skip,r=>r.model='other-model',r=>delete r.answers.b1]){
    const r=response();mutate(r);assert.throws(()=>validateResponse(r,[block]));
  }
});
test('requests use the selected provider only, with no redirects or key in state',async()=>{
  let observed;
  const result=await decideBatch(page,[block],'','synthetic-test-key',{fetchImpl:async(url,options)=>{observed={url,options};return {ok:true,json:async()=>response()};}});
  assert.equal(result.decisions.length,1);assert.equal(observed.url,ENDPOINT);
  assert.equal(observed.options.redirect,'error');assert.equal(observed.options.headers.Authorization,'Bearer synthetic-test-key');
  assert.ok(!observed.options.body.includes('synthetic-test-key'));
  await assert.rejects(decideBatch(page,[{...block,text:'synthetic-test-key'}],'','synthetic-test-key'),/credential/);
  const routed = await decideBatch(page,[block],'','synthetic-router-key',{provider:'openrouter',fetchImpl:async(url,options)=>{observed={url,options};return {ok:true,json:async()=>({...response(),model:'typesafe/jev-1.14.0'})};}});
  assert.equal(routed.model,'typesafe/jev-1.14.0');
  assert.equal(observed.url,'https://openrouter.ai/api/alpha/decisions');
  assert.equal(JSON.parse(observed.options.body).model,'~typesafe/jev-latest');
  assert.equal(observed.options.headers.Authorization,'Bearer synthetic-router-key');
  assert.ok(!observed.options.body.includes('synthetic-router-key'));
  assert.throws(()=>providerFor('unknown-server'),/Unsupported/);
});
test('errors do not expose provider response bodies',async()=>{
  await assert.rejects(decideBatch(page,[block],'','synthetic-test-key',{fetchImpl:async()=>({ok:false,status:401,text:async()=>'sensitive response body'})}),/HTTP 401.*Check your TypeSafe/);
});
test('partial exports label coverage and preserve skipped and unprocessed evidence in JSON',()=>{
  const result={page:{...page,blocks:[block,{...block,id:'b2',text:'Unprocessed evidence'}]},goal:'Specifications',models:['jev-1.13.0'],decisions:validateResponse(response(),[block]),status:'stopped',error:'Stopped by user.'};
  const md=asMarkdown(result);assert.match(md,/1\/2 blocks evaluated/);assert.match(md,/36 hours/);assert.match(md,/Status: stopped/);
  assert.equal(JSON.parse(asJson(result)).page.blocks[1].text,'Unprocessed evidence');
});
test('migration keeps provider keys separate and public settings never expose credentials',()=>{
  const migrated=normalizeSettings({apiKey:'old-typesafe-key',apiKeys:{openrouter:'router-key'},provider:'openrouter',highlight:false});
  assert.equal(migrated.apiKeys.typesafe,'old-typesafe-key');
  assert.equal(migrated.apiKeys.openrouter,'router-key');
  assert.equal(migrated.highlight,false);
  const safe=publicSettings(migrated);
  assert.equal(safe.configured,true);assert.equal(safe.provider,'openrouter');
  assert.ok(!JSON.stringify(safe).includes('key'));
  assert.equal(normalizeSettings().highlight,true);
  assert.equal(normalizeSettings({apiKey:'old',apiKeys:{typesafe:'new'}}).apiKeys.typesafe,'new');
  assert.equal(migrated.autoSave,true);
  assert.equal(migrated.outputFormat,'markdown');
  assert.equal(normalizeSettings({autoSave:false,outputFormat:'text',mode:'sources'}).autoSave,false);
  assert.equal(normalizeSettings({mode:'invented',outputFormat:'exe'}).mode,'all');
});
test('focus modes and user refinement reach Jev without adding a generated answer',()=>{
  const goal=composeGoal('contacts','Only the research team');
  const request=buildRequest(page,[block],goal);
  assert.match(request.state.extractionGoal,/email addresses/);
  assert.match(request.state.extractionGoal,/Only the research team/);
  assert.match(composeGoal('sources'),/DOI links/);
  const focused=buildRequest(page,[block],goal,'typesafe','contacts');
  assert.deepEqual(Object.keys(focused.questions.b1.criteria),['contact','skip']);
  assert.throws(()=>validateResponse(response('data'),[block],'typesafe','contacts'),/invalid decision/);
  assert.throws(()=>composeGoal('invented'),/valid extraction mode/);
});
test('file output supports readable text, provenance and safe partial filenames',()=>{
  const result={page:{...page,title:'../CON: <unsafe>/Guide'},goal:'Specifications',mode:'data',models:['jev-1.13.0'],decisions:validateResponse(response(),[block]),status:'stopped',error:'Stopped by user.'};
  const text=asText(result);assert.match(text,/36 hours/);assert.match(text,/Source: https:\/\/example.org/);assert.match(text,/Status: stopped/);
  for(const format of ['markdown','text','json']){
    const file=fileFor(result,format);assert.match(file.filename,/^linis-/);assert.match(file.filename,/-partial\./);
    assert.ok(!/[\\/:<>]/.test(file.filename));assert.ok(file.text.length>0);
  }
  assert.equal(JSON.parse(fileFor(result,'json').text).page.url,page.url);
  assert.throws(()=>fileFor(result,'exe'),/valid file format/);
});
test('feed capture defaults are explicit and never match unrelated lookalike hosts',()=>{
  const defaults=normalizeSettings();assert.equal(defaults.scanDepth,'deep');assert.equal(defaults.groupComments,true);
  for(const url of ['https://x.com/home','https://www.youtube.com/watch?v=test','https://m.facebook.com/'])assert.equal(captureModeFor('auto',url),'scroll');
  assert.equal(captureModeFor('auto','https://x.com.attacker.invalid'),'snapshot');
  assert.equal(captureModeFor('snapshot','https://x.com/home'),'snapshot');
  assert.equal(captureModeFor('scroll','https://example.org'),'scroll');
});
test('extension has only user-activated page access and the supported API hosts',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../extension/manifest.json',import.meta.url)));
  assert.deepEqual(manifest.permissions,['activeTab','scripting','storage','downloads']);
  assert.deepEqual(manifest.host_permissions,['https://api.typesafe.ai/*','https://openrouter.ai/*']);
  assert.ok(!manifest.content_scripts && !manifest.externally_connectable && !manifest.web_accessible_resources);
});


test('full-request limit measures UTF-8 bytes including page and question overhead before fetch',async()=>{
  let requests=0;
  const fetchImpl=async()=>{requests++;return {ok:true,json:async()=>response()};};
  const requestPage={...page,title:'界'.repeat(22000)};
  const body=JSON.stringify(buildRequest(requestPage,[block],''));
  assert.ok(body.length<MAX_REQUEST_BYTES);
  assert.ok(new TextEncoder().encode(body).length>MAX_REQUEST_BYTES);
  await assert.rejects(decideBatch(requestPage,[block],'','synthetic-test-key',{fetchImpl}),/65,536-byte UTF-8/);
  assert.equal(requests,0);
  await decideBatch(page,[block],'','synthetic-test-key',{fetchImpl});
  assert.equal(requests,1);
});

test('request byte cap accepts the exact boundary and rejects one byte over',async()=>{
  const overhead=new TextEncoder().encode(JSON.stringify(buildRequest({...page,title:''},[block],''))).length;
  let requests=0;
  const fetchImpl=async()=>{requests++;return {ok:true,json:async()=>response()};};
  await decideBatch({...page,title:'x'.repeat(MAX_REQUEST_BYTES-overhead)},[block],'','synthetic-test-key',{fetchImpl});
  await assert.rejects(decideBatch({...page,title:'x'.repeat(MAX_REQUEST_BYTES-overhead+1)},[block],'','synthetic-test-key',{fetchImpl}),/request limit/);
  assert.equal(requests,1);
});

test('capture finish notices and machine-readable reasons survive each export',()=>{
  const result={page,goal:'',models:[],decisions:[],status:'complete',endReason:'capture_timeout',notice:'The two-minute capture window ended automatically.'};
  for(const text of [asMarkdown(result),asText(result)]){assert.match(text,/two-minute capture window/);assert.match(text,/End reason: capture_timeout/);}
  const json=JSON.parse(asJson(result));assert.equal(json.format,'linis/1');assert.equal(json.endReason,'capture_timeout');assert.equal(json.notice,result.notice);
});
