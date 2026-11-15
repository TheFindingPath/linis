import test from 'node:test';
import assert from 'node:assert/strict';
import {collectPage, drainPageCapture} from '../extension/lib/collector.js';
import {updatePageHighlights} from '../extension/lib/highlight.js';

// Deliberately small DOM double: tests entry-point policy and delivery, not CSS layout.
class Element {
  constructor(tag, attrs = {}, children = []) {
    this.tagName = tag.toUpperCase(); this.attrs = attrs; this.nodeType = 1;
    this.childNodes = []; this.style = {display:'block', visibility:'visible', opacity:'1'};
    this.append(...children);
  }
  append(...nodes) { for (const node of nodes) { node.remove?.();node.parentNode=this;this.childNodes.push(node); } }
  remove() { const list=this.parentNode?.childNodes;if(list){const index=list.indexOf(this);if(index>=0)list.splice(index,1);}this.parentNode=null; }
  get parentElement() { return this.parentNode?.nodeType===1?this.parentNode:null; }
  get isConnected() { return this.parentNode?.nodeType===9 || !!this.parentNode?.isConnected; }
  get children() { return this.childNodes.filter(node => node.nodeType === 1); }
  get attributes() { return Object.entries(this.attrs).map(([name,value])=>({name,value})); }
  get textContent() { return this.childNodes.map(node => node.textContent).join(''); }
  set textContent(value) { this.childNodes=[];if(value)this.append(text(value)); }
  setAttribute(name,value) { this.attrs[name]=String(value); }
  removeAttribute(name) { delete this.attrs[name]; }
  attachShadow() { return shadowRoot(this); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  matches(selectors) {
    return selectors.split(',').some(selector => {
      selector = selector.trim();
      if (selector === '[contenteditable]:not([contenteditable="false"])') return 'contenteditable' in this.attrs && this.attrs.contenteditable !== 'false';
      if (selector === 'dialog:not([open])') return this.tagName === 'DIALOG' && !('open' in this.attrs);
      if (selector.startsWith('.')) return (this.attrs.class || '').split(' ').includes(selector.slice(1));
      if (selector.startsWith('#')) return this.attrs.id === selector.slice(1);
      const match = selector.match(/^(\w+)?\[([\w-]+)(?:="([^"]*)")?\]$/);
      if (match) return (!match[1] || this.tagName === match[1].toUpperCase()) && (match[3] === undefined ? match[2] in this.attrs : this.attrs[match[2]] === match[3]);
      return selector === this.tagName.toLowerCase();
    });
  }
  closest(selectors) { for (let node = this; node; node = node.parentElement) if (node.matches(selectors)) return node; return null; }
  getRootNode() { return this.parentNode?.getRootNode?.() || this.parentNode || this; }
  querySelectorAll(selectors) { return this.children.flatMap(node => [...(node.matches(selectors) ? [node] : []), ...node.querySelectorAll(selectors)]); }
  querySelector(selectors) { return this.querySelectorAll(selectors)[0] || null; }
}
class TextNode extends Element {
  constructor(value){super('text');this.nodeType=3;this.value=value;}
  get textContent(){return this.value;}
  set textContent(value){this.value=value;}
}
const text = value => new TextNode(value);
const el = (tag, attrs = {}, ...children) => new Element(tag, attrs, children);
function shadowRoot(host,...nodes){
  const root={nodeType:11,mode:'open',host,childNodes:[],get isConnected(){return host.isConnected;},getRootNode(){return this;},append:Element.prototype.append};
  root.adoptedStyleSheets=[];host.shadowRoot=root;root.append(...nodes);return root;
}
function fixture(t, ...children) {
  let callback;const observations=[];
  const saved = new Map(['document','location','getComputedStyle','MutationObserver'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  globalThis.document = {nodeType:9,body:el('body',{},...children), title:'Local fixture', documentElement:el('html'), querySelector:()=>null};
  document.documentElement.parentNode=document;document.documentElement.append(document.body);
  globalThis.location = {href:'https://fixture.invalid/'};
  globalThis.getComputedStyle = node => node.style;
  globalThis.MutationObserver = class { constructor(fn) { callback=fn; } observe(root,options) { observations.push({root,options}); } disconnect() {} };
  t.after(() => {
    globalThis.__linisCapture?.stop();
    for (const key of ['__linisCapture','__linisTargets']) delete globalThis[key];
    for (const [key,descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key]; }
  });
  const mutate=changes=>callback(changes);mutate.observations=observations;return mutate;
}

test('incremental capture excludes editable descendants and shadow-host editors', async t => {
  const paragraph=el('p',{},text('PRIVATE-DRAFT'));
  const shadowParagraph=el('p',{},text('PRIVATE-SHADOW'));
  const editor=el('div',{contenteditable:'true'},paragraph);
  const host=el('div',{contenteditable:'true'});
  shadowRoot(host,shadowParagraph);
  const mutate=fixture(t,editor,host);
  assert.equal((await collectPage({watch:true})).blocks.length,0);
  mutate([{type:'characterData',target:paragraph.childNodes[0]},{type:'characterData',target:shadowParagraph.childNodes[0]}]);
  const delta=await drainPageCapture(true);
  assert.equal(delta.blocks.length,0);
  assert.ok(!JSON.stringify(delta).includes('PRIVATE-'));
});

test('incremental capture checks CSS-hidden ancestors and private author metadata', async t => {
  const hidden=el('div',{},el('p',{},text('PRIVATE-HIDDEN'))); hidden.style.display='none';
  const author=el('span',{class:'comment-author'},text('PRIVATE-AUTHOR'));
  const post=el('div',{class:'comment'},el('div',{contenteditable:'true'},author),el('p',{},text('Public contribution')));
  const mutate=fixture(t,hidden,post);
  const initial=await collectPage({watch:true});
  assert.ok(!JSON.stringify(initial).includes('PRIVATE-'));
  mutate([{type:'childList',target:hidden,addedNodes:[hidden.children[0]]}]);
  assert.equal((await drainPageCapture(true)).blocks.length,0);
});

test('bare text insertions are delivered and unchanged drains stay empty', async t => {
  const container=el('div'); const mutate=fixture(t,container);
  await collectPage({watch:true});
  const added=text('New visible evidence'); container.append(added);
  mutate([{type:'childList',target:container,addedNodes:[added]}]);
  assert.match((await drainPageCapture()).blocks.map(block=>block.text).join(' '),/New visible evidence/);
  assert.equal((await drainPageCapture()).blocks.length,0);
  const extra=text('Second insertion'), child=el('p',{},text('Nested insertion'));
  container.append(extra,child); mutate([{type:'childList',target:container,addedNodes:[extra,child]}]);
  const next=(await drainPageCapture(true)).blocks.map(block=>block.text).join(' ');
  assert.match(next,/Second insertion/); assert.match(next,/Nested insertion/);
});

test('ordinary headings, table rows, attribution and shadow text remain readable', async t => {
  const host=el('div'), shadow=el('p',{},text('Open shadow evidence')); shadowRoot(host,shadow);
  fixture(t,el('h2',{},text('Specifications')),el('table',{},el('tr',{},el('td',{},text('Price')),el('td',{},text('AUD 249')))),
    el('div',{class:'comment'},el('span',{class:'comment-author'},text('Ada')),el('p',{},text('Named contribution'))),host);
  const page=await collectPage();
  assert.ok(page.blocks.some(block=>block.kind==='heading' && block.text==='Specifications'));
  assert.ok(page.blocks.some(block=>block.kind==='table' && block.text==='Price | AUD 249'));
  assert.ok(page.blocks.some(block=>block.text.includes('Named contribution') && page.records[block.recordId]?.author==='Ada'));
  assert.ok(page.blocks.some(block=>block.text==='Open shadow evidence'));
});

test('long atomic text yields cooperatively and reports character truncation', async t => {
  const paragraph=el('p',{},...Array.from({length:500},()=>el('span',{},text('evidence '))));
  fixture(t,paragraph);
  let tick=0,yields=0;
  const realTimeout=globalThis.setTimeout;
  t.mock.method(globalThis.performance,'now',()=>++tick);
  t.mock.method(globalThis,'setTimeout',(fn,delay,...args)=>{
    if(delay===0){yields++;queueMicrotask(()=>fn(...args));return 0;}
    return realTimeout(fn,delay,...args);
  });
  const page=await collectPage({depth:'standard'});
  assert.ok(yields>5,'a long atomic paragraph must yield internally');
  assert.equal(page.coverage.truncated,false);
  assert.match(page.blocks.map(block=>block.text).join(' '),/evidence/);
  document.body=el('body',{},el('p',{},text('x'.repeat(160001))));document.documentElement.append(document.body);
  const clipped=await collectPage({depth:'standard'});
  assert.equal(clipped.coverage.characters,160000);
  assert.equal(clipped.coverage.truncated,true);
  assert.ok(clipped.coverage.warnings.some(note=>/limit|budget/i.test(note)));
});

test('large tables yield and stop reading rows when the block budget is exhausted', async t => {
  fixture(t,el('table',{},...Array.from({length:5000},(_,i)=>el('tr',{},el('td',{},text('Row '+i))))));
  let tick=0,yields=0;
  const realTimeout=globalThis.setTimeout;
  t.mock.method(globalThis.performance,'now',()=>++tick);
  t.mock.method(globalThis,'setTimeout',(fn,delay,...args)=>{
    if(delay===0){yields++;queueMicrotask(()=>fn(...args));return 0;}
    return realTimeout(fn,delay,...args);
  });
  const page=await collectPage({depth:'standard'});
  assert.equal(page.blocks.length,400);
  assert.equal(page.coverage.truncated,true);
  assert.ok(page.coverage.visitedElements<2000,'do not keep reading thousands of rows after the cap');
  assert.ok(yields>5,'table rows must yield internally');
});

test('direct shadow-root text and root-targeted insertions retain host exclusions', async t => {
  const host=el('div'), root=shadowRoot(host,text('Direct shadow text'));
  const mutate=fixture(t,host);
  assert.ok((await collectPage({watch:true})).blocks.some(block=>block.text==='Direct shadow text'));
  const added=el('p',{},text('Inserted into shadow root')); root.append(added);
  mutate([{type:'childList',target:root,addedNodes:[added]}]);
  assert.ok((await drainPageCapture()).blocks.some(block=>block.text==='Inserted into shadow root'));
  host.attrs.contenteditable='true';
  const privateText=text('PRIVATE-SHADOW-EDIT');root.append(privateText);
  mutate([{type:'childList',target:root,addedNodes:[privateText]}]);
  assert.equal((await drainPageCapture(true)).blocks.length,0);
});

test('a subtree made editable while the scanner yields is not emitted', async t => {
  const parent=el('div',{},el('p',{},...Array.from({length:500},()=>el('span',{},text('PRIVATE-AFTER-YIELD')))));
  fixture(t,parent);
  let tick=0;
  const realTimeout=globalThis.setTimeout;
  t.mock.method(globalThis.performance,'now',()=>++tick);
  t.mock.method(globalThis,'setTimeout',(fn,delay,...args)=>{
    if(delay===0){parent.attrs.contenteditable='true';queueMicrotask(()=>fn(...args));return 0;}
    return realTimeout(fn,delay,...args);
  });
  const page=await collectPage();
  assert.ok(!JSON.stringify(page).includes('PRIVATE-AFTER-YIELD'));
});

test('attribution made private during an awaited lookup never enters records', async t => {
  const author=el('span',{class:'comment-author'},...Array.from({length:100},()=>el('span',{},text('Public author'))));
  const comment=el('div',{class:'comment'},author,el('p',{},text('Original public contribution')));
  fixture(t,comment);
  let tick=0;
  const realTimeout=globalThis.setTimeout;
  t.mock.method(globalThis.performance,'now',()=>++tick);
  t.mock.method(globalThis,'setTimeout',(fn,delay,...args)=>{
    if(delay===0){
      comment.attrs.contenteditable='true';comment.attrs['aria-label']='Comment by PRIVATE-NEW-AUTHOR';
      queueMicrotask(()=>fn(...args));return 0;
    }
    return realTimeout(fn,delay,...args);
  });
  const page=await collectPage();
  assert.equal(page.blocks.length,0);
  assert.ok(!JSON.stringify(page.records).includes('PRIVATE-NEW-AUTHOR'));
  assert.equal(Object.keys(page.records).length,0);
});

test('removing a scanned sibling during a yield does not skip surviving content', async t => {
  const first=el('p',{},...Array.from({length:600},()=>el('span',{},text('Long first paragraph'))));
  const container=el('div',{},first,el('p',{},text('SECOND-PARAGRAPH')),el('p',{},text('THIRD-PARAGRAPH')));
  fixture(t,container);
  let tick=0,removed=false;
  const realTimeout=globalThis.setTimeout;
  t.mock.method(globalThis.performance,'now',()=>++tick);
  t.mock.method(globalThis,'setTimeout',(fn,delay,...args)=>{
    if(delay===0){if(!removed){first.remove();removed=true;}queueMicrotask(()=>fn(...args));return 0;}
    return realTimeout(fn,delay,...args);
  });
  const page=await collectPage();
  const evidence=page.blocks.map(block=>block.text).join(' ');
  assert.match(evidence,/SECOND-PARAGRAPH/);assert.match(evidence,/THIRD-PARAGRAPH/);
});

test('CSS-hidden text after an internal yield is not emitted', async t => {
  const parent=el('div',{},el('p',{},...Array.from({length:500},()=>text('SYNTHETIC-CSS-CANARY'))));
  fixture(t,parent);let tick=0;
  const realTimeout=globalThis.setTimeout;
  t.mock.method(globalThis.performance,'now',()=>++tick);
  t.mock.method(globalThis,'setTimeout',(fn,delay,...args)=>{
    if(delay===0){parent.style.display='none';queueMicrotask(()=>fn(...args));return 0;}
    return realTimeout(fn,delay,...args);
  });
  assert.ok(!JSON.stringify(await collectPage()).includes('SYNTHETIC-CSS-CANARY'));
});

test('a nested fallback label made private while awaiting descendants stays excluded', async t => {
  const inner=el('span',{},...Array.from({length:300},()=>el('span')));
  const field=el('span',{},inner);
  fixture(t,el('p',{},text('Public body '),field));
  let tick=0,visitedInner=false;
  t.mock.method(globalThis,'getComputedStyle',node=>{if(node===inner)visitedInner=true;return node.style;});
  const realTimeout=globalThis.setTimeout;
  t.mock.method(globalThis.performance,'now',()=>++tick);
  t.mock.method(globalThis,'setTimeout',(fn,delay,...args)=>{
    if(delay===0){if(visitedInner){field.attrs.contenteditable='true';field.attrs['aria-label']='PRIVATE-NEW-LABEL';}queueMicrotask(()=>fn(...args));return 0;}
    return realTimeout(fn,delay,...args);
  });
  assert.ok(!JSON.stringify(await collectPage()).includes('PRIVATE-NEW-LABEL'));
});

for(const path of ['atomic','direct','shadow']){
  for(const change of ['move-editor','hide','mutate','detach','move-public']){
    test(`source snapshot guard: ${path} rejects ${change} after a yield`,async t=>{
      const victim=text('Original source text');
      const nodes=[...Array.from({length:500},()=>text('Public prefix ')),victim];
      const source=el(path==='atomic'?'p':'div');
      if(path==='shadow')shadowRoot(source,...nodes);
      else source.append(...nodes,...(path==='direct'?[el('p',{},text('Stable tail'))]:[]));
      const editor=el('div',{contenteditable:'true'}), other=el('div');
      fixture(t,source,editor,other);
      let tick=0,yields=0,changed=false;
      const realTimeout=globalThis.setTimeout;
      t.mock.method(globalThis.performance,'now',()=>++tick);
      t.mock.method(globalThis,'setTimeout',(fn,delay,...args)=>{
        if(delay===0){
          if(++yields===3){
            if(change==='move-editor')editor.append(victim);
            if(change==='move-public')other.append(victim);
            if(change==='hide')source.style.display='none';
            if(change==='detach')victim.remove();
            victim.textContent='SNAPSHOT-CANARY';changed=true;
          }
          queueMicrotask(()=>fn(...args));return 0;
        }
        return realTimeout(fn,delay,...args);
      });
      const page=await collectPage();
      assert.equal(changed,true,'the race must actually execute');
      // Newly public context may be scanned later; it must not be assigned to source.
      if(change==='move-public')assert.ok(!page.blocks.some(block=>block.text.includes('Public prefix')&&block.text.includes('SNAPSHOT-CANARY')));
      else assert.ok(!JSON.stringify(page).includes('SNAPSHOT-CANARY'));
    });
  }
}

for(const path of ['atomic','direct']){
  test(`source snapshot guard: ${path} revalidates already-consumed text before storage`,async t=>{
    const victim=text('ORIGINAL-SNAPSHOT');
    const source=el(path==='atomic'?'p':'div',{},victim,...Array.from({length:500},()=>text('Public trailing evidence ')),...(path==='direct'?[el('p',{},text('Stable tail'))]:[]));
    fixture(t,source);let tick=0,yields=0;
    const realTimeout=globalThis.setTimeout;
    t.mock.method(globalThis.performance,'now',()=>++tick);
    t.mock.method(globalThis,'setTimeout',(fn,delay,...args)=>{
      if(delay===0){if(++yields===3)victim.textContent='New source revision';queueMicrotask(()=>fn(...args));return 0;}
      return realTimeout(fn,delay,...args);
    });
    const page=await collectPage();
    assert.ok(yields>=3);
    assert.ok(!page.blocks.some(block=>block.text.includes('ORIGINAL-SNAPSHOT')));
    assert.ok(page.coverage.warnings.some(note=>/unstable evidence/.test(note)));
  });
}

test('highlights use the shared source guard without whole-element text aggregation',async t=>{
  const leaf=text('Stable evidence'), paragraph=el('p',{},leaf);
  Object.defineProperty(paragraph,'textContent',{get(){throw new Error('Whole-element text reads are forbidden');}});
  fixture(t,paragraph);
  const page=await collectPage();
  const id=page.blocks[0].id;
  assert.equal(globalThis.__linisTargets.isCurrent(id),true);
  leaf.textContent='Changed evidence';
  assert.equal(globalThis.__linisTargets.isCurrent(id),false);
});

test('HTML comment nodes are ignored without affecting ordinary evidence',async t=>{
  const comment={nodeType:8,parentNode:null,get isConnected(){return !!this.parentNode?.isConnected;}};
  fixture(t,el('p',{},comment,text('Public text')));
  assert.ok((await collectPage()).blocks.some(block=>block.text==='Public text'));
});

test('query snapshots do not attribute a relocated table row to its old article',async t=>{
  const moved=el('tr',{},el('td',{},text('MOVED-ROW')));
  const slow=el('tr',{},el('td',{},...Array.from({length:500},()=>text('Slow row '))));
  const secondTable=el('table');
  fixture(t,el('article',{},el('span',{class:'author'},text('Author A')),el('table',{},slow,moved)),
    el('article',{},el('span',{class:'author'},text('Author B')),secondTable));
  let tick=0,seenSlow=false,changed=false;
  t.mock.method(globalThis,'getComputedStyle',node=>{if(node===slow)seenSlow=true;return node.style;});
  const realTimeout=globalThis.setTimeout;
  t.mock.method(globalThis.performance,'now',()=>++tick);
  t.mock.method(globalThis,'setTimeout',(fn,delay,...args)=>{
    if(delay===0){if(seenSlow&&!changed){secondTable.append(moved);changed=true;}queueMicrotask(()=>fn(...args));return 0;}
    return realTimeout(fn,delay,...args);
  });
  const page=await collectPage();
  assert.equal(changed,true);
  const authors=page.blocks.filter(block=>block.text.includes('MOVED-ROW')).map(block=>page.records[block.recordId]?.author);
  assert.deepEqual(authors,['Author B']);
  assert.ok(page.coverage.warnings.some(note=>/unstable evidence/.test(note)));
});

test('snapshot preparation does not perform a large synchronous style scan',async t=>{
  fixture(t,el('p',{},...Array.from({length:20000},()=>text('x'))));
  let tick=0,styles=0,peak=0,yields=0;
  t.mock.method(globalThis,'getComputedStyle',node=>{styles++;return node.style;});
  const realTimeout=globalThis.setTimeout;
  t.mock.method(globalThis.performance,'now',()=>tick+=0.001);
  t.mock.method(globalThis,'setTimeout',(fn,delay,...args)=>{
    if(delay===0){peak=Math.max(peak,styles);styles=0;yields++;queueMicrotask(()=>fn(...args));return 0;}
    return realTimeout(fn,delay,...args);
  });
  const page=await collectPage({depth:'standard'});
  peak=Math.max(peak,styles);
  assert.ok(yields>5);
  assert.ok(peak<2048,'style/layout work must stay bounded between cooperative yields');
  assert.equal(page.coverage.truncated,false);
  assert.ok(page.blocks.length>0);
});

test('element-heavy aggregate validation is bounded and omission preserves the rest of the page',async t=>{
  const heavy=el('p',{},...Array.from({length:5000},()=>el('span',{},text('x'))));
  fixture(t,heavy,el('p',{},text('STABLE-TAIL')));
  let tick=0,styles=0,peak=0;
  t.mock.method(globalThis,'getComputedStyle',node=>{styles++;return node.style;});
  const realTimeout=globalThis.setTimeout;
  t.mock.method(globalThis.performance,'now',()=>tick+=0.001);
  t.mock.method(globalThis,'setTimeout',(fn,delay,...args)=>{
    if(delay===0){peak=Math.max(peak,styles);styles=0;queueMicrotask(()=>fn(...args));return 0;}
    return realTimeout(fn,delay,...args);
  });
  const page=await collectPage({depth:'standard'});
  for(const block of page.blocks)assert.equal(globalThis.__linisTargets.isCurrent(block.id),true);
  peak=Math.max(peak,styles);
  assert.ok(peak<2048,'include final commit and highlight validation in the synchronous work bound');
  assert.ok(page.blocks.some(block=>block.text==='STABLE-TAIL'));
  assert.equal(page.coverage.omitted,true);
  assert.ok(page.coverage.warnings.some(note=>/validation budget/.test(note)));
});

test('an accepted complex aggregate retains bounded fresh highlight validation',async t=>{
  const paragraph=el('p',{},...Array.from({length:500},()=>el('span',{},text('x'))));
  fixture(t,paragraph);let styles=0;
  t.mock.method(globalThis,'getComputedStyle',node=>{styles++;return node.style;});
  const page=await collectPage({depth:'standard'});
  assert.equal(page.coverage.truncated,false);
  assert.equal(page.coverage.omitted,false);
  assert.ok(page.blocks.length>0);
  styles=0;
  assert.equal(globalThis.__linisTargets.isCurrent(page.blocks[0].id),true);
  assert.ok(styles<=512);
  paragraph.children[0].style.display='none';
  assert.equal(globalThis.__linisTargets.isCurrent(page.blocks[0].id),false);
});

test('one highlight pass reuses split-block proofs without caching across updates',async t=>{
  const leaf=text('Evidence '.repeat(2000));fixture(t,el('p',{},leaf));
  const page=await collectPage();const targets=globalThis.__linisTargets;
  assert.ok(page.blocks.length>1);
  let styles=0;t.mock.method(globalThis,'getComputedStyle',node=>{styles++;return node.style;});
  const pass=targets.validationPass();
  for(const block of page.blocks)assert.equal(targets.isCurrent(block.id,pass),true);
  assert.ok(styles<=3,'split blocks share a single guarded source proof within one payload');
  leaf.textContent='Updated source';
  assert.equal(targets.isCurrent(page.blocks[0].id,targets.validationPass()),false);
});

test('highlight work stays capped on many distinct valid source groups',async t=>{
  fixture(t,...Array.from({length:40},()=>el('p',{},...Array.from({length:100},()=>el('span',{},text('x'))))));
  const page=await collectPage();const targets=globalThis.__linisTargets;
  assert.equal(page.blocks.length,40);
  let styles=0;t.mock.method(globalThis,'getComputedStyle',node=>{styles++;return node.style;});
  const pass=targets.validationPass();
  for(const block of page.blocks)targets.isCurrent(block.id,pass);
  assert.ok(styles<=1024);assert.equal(pass.exhausted,true);
  assert.equal(targets.isCurrent(page.blocks.at(-1).id),true,'visual budget does not invalidate evidence');
});

function feedAuthor(name){return el('span',{'data-testid':'User-Name',class:'comment-author'},text(name));}
function feedBody(value){return el('div',{'data-testid':'tweetText'},text(value));}

test('quote cards preserve separate authors while all outer body containers are captured',async t=>{
  const quote=el('div',{role:'link'},feedAuthor('Quoted author'),feedBody('Quoted words'));
  fixture(t,el('article',{'data-testid':'tweet'},feedAuthor('Outer author'),feedBody('First paragraph'),feedBody('Second paragraph'),quote));
  const page=await collectPage();
  const outer=page.blocks.find(b=>page.records[b.recordId]?.author==='Outer author');
  const inner=page.blocks.find(b=>page.records[b.recordId]?.author==='Quoted author');
  assert.match(outer.text,/First paragraph[\s\S]*Second paragraph/);
  assert.doesNotMatch(outer.text,/Quoted words/);
  assert.match(inner.text,/Quoted words/);
  assert.equal(page.records[page.records[inner.recordId].parentId].author,'Outer author');
});

test('quote-only posts never assign quoted words to the sharing author or read private quotes',async t=>{
  fixture(t,el('article',{'data-testid':'tweet'},feedAuthor('Sharing author'),
    el('div',{role:'link'},feedAuthor('Original author'),feedBody('Original contribution')),
    el('div',{contenteditable:'true'},el('div',{role:'link'},feedAuthor('PRIVATE-AUTHOR'),feedBody('PRIVATE-BODY')))));
  const page=await collectPage();
  assert.ok(page.blocks.some(b=>b.text.includes('Original contribution')&&page.records[b.recordId]?.author==='Original author'));
  assert.ok(!page.blocks.some(b=>b.text.includes('Original contribution')&&page.records[b.recordId]?.author==='Sharing author'));
  assert.doesNotMatch(JSON.stringify(page),/PRIVATE-/);
});

test('identical replaced DOM refreshes highlight proofs without duplicate blocks',async t=>{
  const value='Stable contribution '.repeat(300);
  const body=feedBody(value);
  const post=el('article',{'data-testid':'tweet'},feedAuthor('Author'),body);
  const mutate=fixture(t,post);
  const page=await collectPage({watch:true});
  const id=page.blocks[0].id;
  assert.ok(page.blocks.length>1,'exercise the shared proof across split blocks');
  body.childNodes[0].remove();body.append(text(value));
  mutate([{type:'childList',target:body,addedNodes:[body.childNodes[0]]}]);
  assert.equal(globalThis.__linisTargets.isCurrent(id),false);
  const delta=await drainPageCapture(false);
  assert.equal(delta.blocks.length,0);assert.equal(delta.refreshedTargets,true);
  for(const block of page.blocks)assert.equal(globalThis.__linisTargets.isCurrent(block.id),true);
  mutate([{type:'childList',target:post,addedNodes:[]}]);
  assert.equal((await drainPageCapture(true)).refreshedTargets,false);
});

test('collapsed previews are disclosed and manual expansion is captured incrementally',async t=>{
  const body=feedBody('Loaded preview'),more=el('button',{'data-testid':'tweet-text-show-more-link'},text('Show more'));
  more.click=()=>{throw new Error('Automatic expansion is forbidden');};
  const post=el('article',{'data-testid':'tweet'},feedAuthor('Author'),body,more);
  const mutate=fixture(t,post);
  const page=await collectPage({watch:true});
  assert.equal(page.coverage.collapsed,true);
  assert.ok(page.coverage.warnings.some(note=>/collapsed/.test(note)));
  const extra=text(' Expanded remainder');body.append(extra);more.remove();
  mutate([{type:'childList',target:body,addedNodes:[extra]}]);
  assert.ok((await drainPageCapture(true)).blocks.some(b=>b.text.includes('Expanded remainder')));
});

test('multiple post bodies share one bounded link budget',async t=>{
  const bodies=Array.from({length:3},(_,i)=>el('div',{'data-testid':'tweetText'},...Array.from({length:20},(_,j)=>el('a',{href:'https://example.org/'+i+'/'+j},text('source')))));
  fixture(t,el('article',{'data-testid':'tweet'},feedAuthor('Author'),...bodies));
  const page=await collectPage();
  assert.ok(page.blocks.length>0);
  assert.equal(page.blocks[0].links.length,40);
  assert.ok(page.coverage.warnings.some(note=>/link limit/.test(note)));
});


test('attribute-only links and accessible names are captured without a text mutation',async t=>{
  const link=el('a',{href:'https://example.org/old'},text('Manual')),button=el('button',{'aria-label':'Old label'});
  const mutate=fixture(t,link,button);await collectPage({watch:true});
  link.attrs.href='https://example.org/new';button.attrs['aria-label']='New label';
  mutate([{type:'attributes',target:link,attributeName:'href'},{type:'attributes',target:button,attributeName:'aria-label'}]);
  const delta=await drainPageCapture(true);
  assert.ok(delta.blocks.some(b=>b.links.some(l=>l.url==='https://example.org/new')));
  assert.ok(delta.blocks.some(b=>b.text==='New label'));
  assert.ok(mutate.observations.every(({options})=>options.attributes && options.attributeFilter.includes('href') && !options.attributeFilter.includes('data-linis-mark')));
});

test('attribute-only ancestor reveal and shadow-host eligibility changes queue visible content',async t=>{
  const hidden=el('div',{hidden:''},el('p',{},text('Revealed text')));
  const host=el('div',{contenteditable:'true'});const shadow=shadowRoot(host,el('p',{},text('Shadow evidence')));
  const mutate=fixture(t,hidden,host);assert.equal((await collectPage({watch:true})).blocks.length,0);
  delete hidden.attrs.hidden;delete host.attrs.contenteditable;
  mutate([{type:'attributes',target:hidden,attributeName:'hidden'},{type:'attributes',target:host,attributeName:'contenteditable'}]);
  const delta=await drainPageCapture();
  assert.ok(delta.blocks.some(b=>b.text==='Revealed text'));assert.ok(delta.blocks.some(b=>b.text==='Shadow evidence'));
  assert.ok(mutate.observations.some(({root,options})=>root===shadow && options.attributes));
  await drainPageCapture(true);
});

test('extension mark mutations are ignored without queuing duplicate captures',async t=>{
  const paragraph=el('p',{},text('Stable evidence'));const mutate=fixture(t,paragraph);await collectPage({watch:true});
  paragraph.attrs['data-linis-mark']='kept';mutate([{type:'attributes',target:paragraph,attributeName:'data-linis-mark'}]);
  assert.equal((await drainPageCapture(true)).blocks.length,0);
});

test('ancestor attribute changes invalidate descendant and shadow highlights without observing own marks',async t=>{
  const paragraph=el('p',{},text('Visible evidence')),shadowParagraph=el('p',{},text('Shadow evidence'));
  const host=el('div');shadowRoot(host,shadowParagraph);const ancestor=el('div',{},paragraph,host);
  const mutate=fixture(t,ancestor);const page=await collectPage();
  document.adoptedStyleSheets=[];
  document.createElement=tag=>{const node=el(tag);node.style.setProperty=(name,value)=>{node.style[name]=value;};return node;};
  const savedSheet=globalThis.CSSStyleSheet;globalThis.CSSStyleSheet=class { replaceSync() {} };
  t.after(()=>{globalThis.__linisHighlight?.destroy();delete globalThis.__linisHighlight;globalThis.CSSStyleSheet=savedSheet;});
  const targets=globalThis.__linisTargets;let validations=0;const isCurrent=targets.isCurrent;
  targets.isCurrent=(...args)=>{validations++;return isCurrent(...args);};
  updatePageHighlights({type:'settled',jobId:'attribute-test',decisions:page.blocks.map(b=>({id:b.id,category:'content'})),startedAt:new Date().toISOString()});
  assert.equal(paragraph.getAttribute('data-linis-mark'),'kept');assert.equal(shadowParagraph.getAttribute('data-linis-mark'),'kept');
  const before=validations;mutate([{type:'attributes',target:paragraph,attributeName:'data-linis-mark'}]);assert.equal(validations,before);
  ancestor.attrs.hidden='';mutate([{type:'attributes',target:ancestor,attributeName:'hidden'}]);
  assert.equal(paragraph.getAttribute('data-linis-mark'),null);assert.equal(shadowParagraph.getAttribute('data-linis-mark'),null);
  assert.ok(mutate.observations.every(({options})=>options.attributes && !options.attributeFilter.includes('data-linis-mark')));
});
