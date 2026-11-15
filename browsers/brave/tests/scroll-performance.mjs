import puppeteer from 'puppeteer-core';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {updatePageHighlights} from '../extension/lib/highlight.js';

const browser=await puppeteer.launch({executablePath:process.env.BRAVE_PATH || 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',headless:true,args:['--no-first-run','--no-default-browser-check'],defaultViewport:{width:1200,height:850}});
const reports=[];
try {
  for (const name of ['before','after']) {
    let highlighter=updatePageHighlights;
    if(name==='before') {
      try { highlighter=(await import(pathToFileURL(resolve('artifacts/highlight-v1.2.mjs')))).updatePageHighlights; }
      catch { continue; }
    }
    const page=await browser.newPage();
    await page.setContent('<style>body{font:16px system-ui;margin:24px}.card{padding:12px;border:1px solid #ddd;margin:8px 0}p{margin:6px 0}</style><main></main>');
    await page.evaluate(()=>{
      const nodes=new Map(), main=document.querySelector('main');
      for(let i=0;i<400;i++){
        const card=document.createElement('article');card.className='card';
        for(let j=0;j<8;j++){const p=document.createElement('p');p.textContent=`Record ${i}, detail ${j}: loaded discussion content and a named author.`;card.append(p);}
        main.append(card);nodes.set(`b${i+1}`,card);
      }
      globalThis.__linisTargets={url:location.href,nodes};
    });
    await page.evaluate(highlighter,{type:'batch',jobId:'benchmark',ids:Array.from({length:400},(_,i)=>`b${i+1}`),decisions:[],done:0,total:400,providerName:'Test',startedAt:new Date().toISOString()});
    const client=await page.createCDPSession();await client.send('Performance.enable');
    const before=await client.send('Performance.getMetrics');
    const run=await page.evaluate(async()=>{
      let reads=0, mutations=0;
      const original=Element.prototype.getClientRects;
      Element.prototype.getClientRects=function(...args){reads++;return original.apply(this,args);};
      const root=document.querySelector('[data-linis-ui]');
      const observer=new MutationObserver(records=>{mutations+=records.reduce((count,record)=>count+record.addedNodes.length+record.removedNodes.length,0);});
      observer.observe(root.shadowRoot,{subtree:true,childList:true});
      const started=performance.now();
      for(let i=0;i<90;i++){
        scrollTo(0,(i/89)*(document.documentElement.scrollHeight-innerHeight));
        await new Promise(requestAnimationFrame);
      }
      await new Promise(requestAnimationFrame);
      observer.disconnect();Element.prototype.getClientRects=original;
      return {geometryReads:reads,overlayNodeChanges:mutations,elapsedMs:performance.now()-started};
    });
    const after=await client.send('Performance.getMetrics');
    const metrics=Object.fromEntries(after.metrics.map(item=>[item.name,item.value-(before.metrics.find(old=>old.name===item.name)?.value || 0)]));
    reports.push({name,...run,taskMs:metrics.TaskDuration*1000,layouts:metrics.LayoutCount,recalculations:metrics.RecalcStyleCount});
    await page.close();
  }
  const after=reports.find(report=>report.name==='after');
  if(process.argv.includes('--verify')){assert.equal(after.geometryReads,0);assert.ok(after.overlayNodeChanges<50);}
  await mkdir('artifacts',{recursive:true});
  await writeFile('artifacts/scroll-performance.json',JSON.stringify({browser:await browser.version(),testedAt:new Date().toISOString(),records:400,frames:90,reports},null,2));
  console.log(JSON.stringify(reports,null,2));
} finally {await browser.close();}
