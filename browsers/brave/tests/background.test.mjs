import test from 'node:test';
import assert from 'node:assert/strict';

test('stopping initial collection preserves exportable evidence without calling Jev', async t => {
  let listener, releaseCapture, reachedCapture;
  const capturing=new Promise(resolve=>{reachedCapture=resolve;});
  const capture=new Promise(resolve=>{releaseCapture=resolve;});
  const page={title:'Local fixture',url:'https://fixture.invalid/',capturedAt:'2026-11-14T00:00:00Z',records:{},blocks:[{id:'b1',kind:'text',text:'Captured before stop',links:[]}],coverage:{characters:20,warnings:[]}};
  const local={apiKeys:{typesafe:'synthetic-fixture-key'},captureMode:'snapshot',highlight:false,autoSave:true};
  const session={}; let requests=0, downloads=0;
  const storage=data=>({async setAccessLevel(){},async get(){return structuredClone(data);},async set(patch){Object.assign(data,structuredClone(patch));},async remove(key){delete data[key];}});
  const savedChrome=globalThis.chrome, savedFetch=globalThis.fetch;
  globalThis.fetch=async()=>{requests++;throw new Error('Network forbidden in tests');};
  globalThis.chrome={storage:{local:storage(local),session:storage(session)},
    runtime:{id:'fixture',getURL:path=>'chrome-extension://fixture/'+path,getPlatformInfo:async()=>({}),onMessage:{addListener(fn){listener=fn;}}},
    tabs:{get:async()=>({url:page.url})},
    downloads:{onChanged:{addListener(){}},download:async()=>{downloads++;return 1;},search:async()=>[{state:'complete'}]},
    scripting:{executeScript:async({func})=>{if(func.name==='collectPage'){reachedCapture();return capture;}return [{frameId:0,result:{}}];}}};
  t.after(()=>{globalThis.chrome=savedChrome;globalThis.fetch=savedFetch;});
  await import('../extension/background.js?cancellation-regression');
  const send=message=>new Promise(resolve=>listener(message,{id:'fixture',url:'chrome-extension://fixture/app.html'},resolve));
  await send({type:'start',tabId:1,goal:''}); await capturing;
  await send({type:'stop'}); releaseCapture([{frameId:0,result:page}]);
  for(let attempts=0;!session.job?.finishedAt && attempts<100;attempts++)await new Promise(setImmediate);
  assert.equal(session.job?.status,'stopped');
  assert.equal(session.job.result?.page.blocks[0].text,'Captured before stop');
  assert.equal(session.job.result.status,'stopped'); assert.equal(session.job.total,1);
  assert.equal(requests,0); assert.equal(downloads,0);
  const exported=await send({type:'export',format:'json'});
  assert.equal(exported.job.download.state,'complete');
  assert.match(exported.job.download.filename,/-partial\.json$/);
  assert.equal(requests,0); assert.equal(downloads,1);
});

test('refreshed source proofs repaint an idle capture without another provider request',async t=>{
  let listener,drains=0,requests=0;
  const marks=[],session={};
  const page={title:'Fixture',url:'https://fixture.invalid/',capturedAt:'2026-11-15T00:00:00Z',records:{},blocks:[{id:'b1',kind:'comment',text:'Stable contribution',links:[]}],coverage:{characters:19,warnings:[],watching:true}};
  const local={apiKeys:{typesafe:'synthetic-fixture-key'},captureMode:'scroll',mode:'comments',highlight:true,autoSave:false};
  const storage=data=>({async setAccessLevel(){},async get(){return structuredClone(data);},async set(patch){Object.assign(data,structuredClone(patch));},async remove(key){delete data[key];}});
  const savedChrome=globalThis.chrome,savedFetch=globalThis.fetch;
  globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify({model:'jev-test',answers:{b1:{type:'choice',choice:'content',confidence:1,probabilities:{content:1,skip:0}}}}));};
  globalThis.chrome={storage:{local:storage(local),session:storage(session)},
    runtime:{id:'fixture',getURL:path=>'chrome-extension://fixture/'+path,getPlatformInfo:async()=>({}),onMessage:{addListener(fn){listener=fn;}}},
    tabs:{get:async()=>({url:page.url})},downloads:{onChanged:{addListener(){}}},
    scripting:{executeScript:async({func,args})=>{
      if(func.name==='collectPage')return [{frameId:0,result:structuredClone(page)}];
      if(func.name==='updatePageHighlights'){marks.push(args[0].type);return [{result:{visible:true}}];}
      drains++;
      return [{frameId:0,result:{blocks:[],records:{},coverage:page.coverage,ended:drains>=2,refreshedTargets:drains===2}}];
    }}};
  t.after(()=>{globalThis.chrome=savedChrome;globalThis.fetch=savedFetch;});
  await import('../extension/background.js?source-refresh-regression');
  await new Promise(resolve=>listener({type:'start',tabId:1,goal:''},{id:'fixture',url:'chrome-extension://fixture/app.html'},resolve));
  for(let attempts=0;!session.job?.finishedAt && attempts<100;attempts++)await new Promise(setImmediate);
  assert.equal(session.job?.status,'complete');
  assert.equal(requests,1);assert.equal(session.job.result.decisions.length,1);
  assert.equal(marks.filter(type=>type==='settled').length,2,'one decision update plus one proof-only repaint');
});


for(const reason of ['user_finish','capture_timeout','deadline','cancelled']){
  test('job lifecycle preserves distinct '+reason+' reason',async t=>{
    let listener,deadlineCallback,reachedCapture,releaseCapture,requests=0,downloads=0;
    const reached=new Promise(resolve=>{reachedCapture=resolve;});
    const capture=new Promise(resolve=>{releaseCapture=resolve;});
    const session={},local={apiKeys:{typesafe:'synthetic-fixture-key'},captureMode:'scroll',highlight:false,autoSave:false};
    const page={title:'Fixture',url:'https://fixture.invalid/',capturedAt:new Date().toISOString(),records:{},blocks:[{id:'b1',kind:'text',text:'Captured evidence',links:[]}],coverage:{characters:17,warnings:[],watching:true}};
    const storage=data=>({async setAccessLevel(){},async get(){return structuredClone(data);},async set(patch){Object.assign(data,structuredClone(patch));},async remove(key){delete data[key];}});
    const savedChrome=globalThis.chrome,savedFetch=globalThis.fetch;
    globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify({model:'jev-test',answers:{b1:{type:'choice',choice:'content',confidence:1,probabilities:{content:1,contact:0,data:0,media:0,skip:0}}}}));};
    globalThis.chrome={storage:{local:storage(local),session:storage(session)},
      runtime:{id:'fixture',getURL:path=>'chrome-extension://fixture/'+path,getPlatformInfo:async()=>({}),onMessage:{addListener(fn){listener=fn;}}},
      tabs:{get:async()=>({url:page.url})},
      downloads:{onChanged:{addListener(){}},download:async()=>{downloads++;return 1;},search:async()=>[{state:'complete'}]},
      scripting:{executeScript:async({func,args})=>{
        if(func.name==='collectPage'){reachedCapture();return capture;}
        return [{frameId:0,result:{blocks:[],records:{},coverage:structuredClone(page.coverage),ended:!!args[0]}}];
      }}};
    t.after(()=>{globalThis.chrome=savedChrome;globalThis.fetch=savedFetch;});
    const realTimeout=globalThis.setTimeout;
    t.mock.method(globalThis,'setTimeout',(fn,delay,...args)=>{if(delay===240000){deadlineCallback=fn;return 0;}return realTimeout(fn,delay,...args);});
    const realNow=Date.now();let ticks=0;
    t.mock.method(Date,'now',()=>realNow+(reason==='capture_timeout' && ticks++>0?120000:0));
    await import('../extension/background.js?lifecycle-'+reason);
    const send=message=>new Promise(resolve=>listener(message,{id:'fixture',url:'chrome-extension://fixture/app.html'},resolve));
    await send({type:'start',tabId:1,goal:''});await reached;
    if(reason==='user_finish')await send({type:'finishCapture'});
    if(reason==='cancelled')await send({type:'stop'});
    if(reason==='deadline'){assert.equal(typeof deadlineCallback,'function');deadlineCallback();}
    releaseCapture([{frameId:0,result:page}]);
    for(let attempts=0;!session.job?.finishedAt && attempts<100;attempts++)await new Promise(setImmediate);
    const job=session.job;
    assert.ok(job.finishedAt);assert.equal(job.endReason,reason);assert.equal(job.result.endReason,reason);
    if(reason==='deadline' || reason==='cancelled'){
      assert.equal(job.status,'stopped');assert.equal(requests,0);assert.equal(downloads,0);
      assert.match(job.error,reason==='deadline'?/four-minute.*partial/:/cancelled by you.*partial/);
    }else{
      assert.equal(job.status,'complete');assert.equal(requests,1);assert.equal(job.captureEndReason,reason);
      assert.match(job.notice,reason==='user_finish'?/at your request/:/two-minute.*automatically/);
      assert.ok(job.result.page.coverage.warnings.includes(job.notice));
      assert.equal(downloads,reason==='user_finish'?1:0);
    }
  });
}
