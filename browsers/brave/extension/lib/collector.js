// Self-contained: injected into the page's isolated extension world.
export async function collectPage(options = {}) {
  globalThis.__linisCapture?.stop();
  delete globalThis.__linisCapture;
  globalThis.__linisHighlight?.destroy();
  const depth = options.depth === 'standard' ? 'standard' : 'deep';
  const limits = depth === 'standard'
    ? {blocks:400,characters:160000,nodes:50000,bytes:2500000}
    : {blocks:2000,characters:800000,nodes:150000,bytes:2500000};
  const targets={url:location.href,nodes:new Map(),proofs:new Map()};
  globalThis.__linisTargets=targets;
  const blocks=[], records={}, warnings=new Set(), dirty=new Set(), nodeIds=new WeakMap(), seen=new WeakMap();
  let visited=0,characters=0,bytes=0,nextNode=0,nextRecord=0,delivered=0,heading='',truncated=false,limitReason='',stopped=false,observer=null,watchdog=null,busy=null;
  const deliveredRecords=new Set();
  const shadowRoots=new Set();
  let work=0,styleWork=0,readClipped=false,omitted=false,collapsed=false;
  const validationElementLimit=512;
  let visibility=new WeakMap(),contexts=new WeakMap(),lastYield=performance.now();
  const recordIds=new Map(),encoder=new TextEncoder();
  const recordProofs=new Map();
  const proofAncestors=new WeakMap(),proofNodes=new WeakMap();let refreshedTargets=false;
  const snapshotNodes=new WeakSet();let sourceNodes=0,headingProof=[];
  const recordSelector='article,[role="article"],[itemtype*="schema.org/Comment"],[itemtype*="schema.org/Review"],.comment,.review,[data-comment-id],[data-review-id],[data-testid="tweet"],ytd-comment-view-model,ytd-comment-renderer,yt-comment-view-model,ytm-comment-renderer,[aria-label^="Comment by "],[aria-label^="Reply by "],[aria-label^="Post by "]';
  const quoteSelector='[data-testid="quoteTweet"],[data-testid="quoteTweetCard"],[role="link"]';
  const bodySelector='[data-testid="tweetText"],#content-text,[itemprop="text"],.comment-body,.comment-text,.review-text,[data-testid="comment-text"]';
  const excluded='script,style,noscript,template,svg,canvas,input,textarea,select,option,[contenteditable]:not([contenteditable="false"]),[data-linis-ui]';
  const clean=value=>(value || '').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/\n\s*\n\s*\n/g,'\n\n').trim();
  const parent=el=>el.parentElement || el.getRootNode()?.host || null;
  function isQuoteRoot(el){
    // X quote cards may be links rather than nested articles. Require both an
    // observed author and body inside a tweet; ordinary navigation links stay out.
    return el.matches?.(quoteSelector) && !!parent(el)?.closest?.('[data-testid="tweet"]') && !!el.querySelector('[data-testid="User-Name"]') && !!el.querySelector('[data-testid="tweetText"]');
  }
  function isRecordRoot(el){return el.matches?.(recordSelector) || isQuoteRoot(el);}
  function nearestRecord(el){for(let node=el;node;node=parent(node))if(isRecordRoot(node))return node;return null;}
  function stop(reason=''){
    stopped=true;observer?.disconnect();clearTimeout(watchdog);
    if(reason)warnings.add(reason);
  }
  function limit(reason){truncated=true;limitReason=reason;stop();warnings.add('Scan limit reached: '+reason+'. Captured content is partial.');}
  async function cooperate(force=false){
    if(force || ++work>=128 || styleWork>=128 || performance.now()-lastYield>8){
      await new Promise(resolve=>setTimeout(resolve,0));
      lastYield=performance.now();work=0;styleWork=0;
      // Styles/ancestry may have changed while the page had control.
      visibility=new WeakMap();
    }
  }
  function excludedTree(el){
    for(let node=el;node;node=parent(node))if(node.matches(excluded))return true;
    return false;
  }
  function visible(el){
    if(visibility.has(el))return visibility.get(el);
    // Incremental roots and attribution lookups can start below an excluded ancestor.
    // Cross shadow boundaries too; a shadow child must inherit its host's exclusion.
    const path=[];let value=true;
    for(let node=el;node;node=parent(node)){
      if(visibility.has(node)){value=visibility.get(node);break;}
      path.push(node);
      if(++visited>limits.nodes){limit(limits.nodes.toLocaleString()+' visited elements');value=false;break;}
      const style=getComputedStyle(node);
      if(node.matches(excluded+', [hidden],[aria-hidden="true"],dialog:not([open])') || style.display==='none' || style.visibility==='hidden' || style.visibility==='collapse' || style.opacity==='0'){value=false;break;}
    }
    for(const node of path)visibility.set(node,value);
    return value;
  }
  // A snapshot is a claim about a particular node in a particular source context.
  // This is the single acceptance guard for every asynchronous read and commit.
  const sourceParent=node=>node.parentNode || (node.nodeType===11?node.host:null);
  const sourceAttributes=['aria-label','title','alt','href','src','srcset','sizes','role','aria-level','class','id','itemprop','itemtype','rel','data-testid','data-comment-id','data-review-id'];
  const attributeFilter=[...sourceAttributes,'style','hidden','aria-hidden','contenteditable','open'];
  const observation={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter};
  targets.attributeFilter=attributeFilter;
  function sourceState(node){
    if(node.nodeType===3)return node.textContent;
    const attributes=Array.from(node.attributes).filter(attribute=>sourceAttributes.includes(attribute.name)).map(({name,value})=>[name,value]);
    attributes.sort(([left],[right])=>left.localeCompare(right));
    return JSON.stringify([attributes,node.currentSrc || '']);
  }
  function sourceValid(snapshot,styles=new WeakMap(),pass=null){
    if(!snapshot || !snapshot.node.isConnected)return false;
    let node=snapshot.node;
    for(const expected of snapshot.path){
      if(node!==expected)return false;
      if(node.nodeType===11 && node.mode!=='open')return false;
      if(node.nodeType===1){
        if(!styles.has(node)){
          if(pass && pass.remaining--<=0){pass.exhausted=true;return false;}
          styleWork++;
          const style=getComputedStyle(node);
          styles.set(node,!node.matches(excluded+', [hidden],[aria-hidden="true"],dialog:not([open])') && style.display!=='none' && style.visibility!=='hidden' && style.visibility!=='collapse' && style.opacity!=='0');
        }
        if(!styles.get(node))return false;
      }
      node=sourceParent(node);
    }
    if(node || snapshot.path.at(-1)!==document)return false;
    return snapshot.state===null || sourceState(snapshot.node)===snapshot.state;
  }
  function snapshotSource(node){
    if(!node || ![1,3].includes(node.nodeType))return null;
    if(truncated)return null;
    if(!snapshotNodes.has(node)){
      if(sourceNodes>=limits.nodes){limit(limits.nodes.toLocaleString()+' source nodes');return null;}
      snapshotNodes.add(node);sourceNodes++;
    }
    const path=[];for(let current=node;current;current=sourceParent(current))path.push(current);
    const snapshot={node,path,state:null};
    // Markers are untrusted comparisons, not accepted evidence. Avoid forcing
    // computed styles for an entire sibling/query list before its first yield.
    snapshot.state=sourceState(node);return snapshot;
  }
  function snapshotsOf(nodes){
    const snapshots=[];
    for(const node of nodes){if(truncated)break;snapshots.push({node,snapshot:snapshotSource(node)});}
    return snapshots;
  }
  function validSources(proof,report=true,pass=null){
    // A fresh commit cannot yield halfway through validation: early checks would
    // become stale again. Reject overly complex groups before any style reads.
    const elements=new Set();
    for(const snapshot of proof){
      for(const node of snapshot?.path || []){
        if(node.nodeType===1)elements.add(node);
        if(elements.size>validationElementLimit){
          if(report){omitted=true;warnings.add('Source aggregate exceeded the 512-element validation budget; that aggregate was omitted. Other evidence can still be captured.');}
          if(pass)pass.exhausted=true;
          return false;
        }
      }
    }
    const styles=pass?.styles || new WeakMap();
    const valid=proof.every(snapshot=>sourceValid(snapshot,styles,pass));
    if(!valid && report)warnings.add('Source content changed, moved or became private during collection; unstable evidence was omitted. Retry after the page settles.');
    return valid;
  }
  // A pass is synchronous and local to one highlight payload, never an await cache.
  targets.validationPass=()=>({styles:new WeakMap(),proofs:new WeakMap(),remaining:1024,exhausted:false});
  targets.isCurrent=(id,pass=null)=>{
    const proof=targets.proofs.get(id);
    if(!proof)return false;
    if(pass?.proofs.has(proof))return pass.proofs.get(proof);
    const valid=validSources(proof,false,pass);pass?.proofs.set(proof,valid);return valid;
  };
  targets.changedChildren=(id,changes)=>{
    const nodes=proofNodes.get(targets.proofs.get(id));
    return changes.some(change=>change.type==='childList' && nodes?.has(change.target));
  };
  targets.affectedByAttributes=(id,nodes)=>nodes.some(node=>proofAncestors.get(targets.proofs.get(id))?.has(node));
  function sameProof(left,right){
    return left?.length===right.length && left.every((snapshot,i)=>snapshot.node===right[i].node && snapshot.state===right[i].state && snapshot.path.length===right[i].path.length && snapshot.path.every((node,j)=>node===right[i].path[j]));
  }
  function target(id,element,proof){
    if(!proofNodes.has(proof)){
      proofNodes.set(proof,new Set(proof.map(snapshot=>snapshot.node)));
      proofAncestors.set(proof,new Set(proof.flatMap(snapshot=>snapshot.path)));
    }
    targets.nodes.set(id,element);targets.proofs.set(id,proof);
  }
  function label(el,proof=[]){
    const snapshot=snapshotSource(el);if(!validSources([snapshot]))return '';
    proof.push(snapshot);
    return clean(el.getAttribute('aria-label') || (el.matches('a,button,[role="link"],[role="button"],[role="heading"]') ? el.getAttribute('title') : '')).slice(0,500);
  }
  function* childrenOf(el){
    // Snapshot values and ownership before the loop's first await, not on resume.
    const children=[];
    const capture=nodes=>{for(const snapshot of snapshotsOf(nodes))children.push(snapshot);};
    capture(el.childNodes);
    if(el.shadowRoot){
      shadowRoots.add(el.shadowRoot);
      if(observer&&!stopped)observer.observe(el.shadowRoot,observation);
      capture(el.shadowRoot.childNodes);
    }
    yield* children;
  }
  async function readText(el,preserve=false,recordRoot=null,level=0,budget={remaining:limits.characters-characters+1},proof=[]){
    const root=snapshotSource(el);proof.push(root);
    await cooperate();
    if(level>300 || truncated || !validSources([root]) || !visible(el))return '';
    if(recordRoot && el!==recordRoot && isRecordRoot(el))return '';
    if(el.matches('br'))return '\n';
    if(el.matches('img'))return clean(el.getAttribute('alt'));
    const parts=[];
    for(const {node,snapshot} of childrenOf(el)){
      if(truncated || budget.remaining<=0){if(!truncated)readClipped=true;break;}
      await cooperate();
      if(!validSources([root]))return '';
      if(!snapshot)continue;
      if(!validSources([snapshot])){proof.push(snapshot);continue;}
      if(node.nodeType===3){
        proof.push(snapshot);
        const value=snapshot.state.slice(0,budget.remaining);
        if(value.length<snapshot.state.length)readClipped=true;
        parts.push(value);budget.remaining-=value.length;
      }
      else if(node.nodeType===1){proof.push(snapshot);parts.push(await readText(node,preserve,recordRoot,level+1,budget,proof));}
    }
    let text=parts.join(preserve?'':el.matches('tr')?' | ':' ');
    text=preserve?text:clean(text);
    if(level===0 && proof.length>=256)await cooperate(true);
    if(!validSources([root]) || level===0 && !validSources(proof))return '';
    return text || label(el,proof);
  }
  function safeUrl(value){
    if(!value)return '';
    try{const url=new URL(value,location.href);if(url.href.length>2048){warnings.add('A source URL exceeded the 2,048-character link limit and was omitted.');return '';}return ['http:','https:','mailto:','tel:'].includes(url.protocol)?url.href:'';}catch{return '';}
  }
  async function linksOf(el,recordRoot=null,proof=[],budget={size:0,urls:new Set(),full:false}){
    const links=[];
    if(budget.full)return links;
    for(const {node:a,snapshot} of snapshotsOf([...(el.matches('a[href]')?[el]:[]),...el.querySelectorAll('a[href]')])){
      if(truncated || readClipped)break;
      await cooperate();
      if(!snapshot || !validSources([snapshot]) || recordRoot && nearestRecord(a)!==recordRoot)continue;
      proof.push(snapshot);
      const url=safeUrl(a.getAttribute('href'));if(!url || budget.urls.has(url))continue;
      const link={text:(await readText(a,false,null,0,undefined,proof)).slice(0,200),url};
      const cost=JSON.stringify(link).length;
      if(budget.size+cost>6000 || budget.urls.size===40){budget.full=true;warnings.add('Source links in a block exceeded the link limit; remaining links were omitted.');break;}
      budget.size+=cost;budget.urls.add(url);links.push(link);
    }
    return validSources(proof)?links:[];
  }
  async function findWithin(root,selectors,proof=[]){
    for(const selector of selectors){
      for(const {node:el,snapshot} of snapshotsOf(root.querySelectorAll(selector))){
        if(truncated || readClipped)return null;
        await cooperate();
        if(!snapshot || !validSources([snapshot]))continue;
        const candidate=[snapshot];
        if(nearestRecord(el)===root && await readText(el,false,null,0,undefined,candidate) && validSources(candidate)){proof.push(...candidate);return el;}
      }
    }
    return null;
  }
  async function bodiesWithin(root,proof){
    const bodies=[],selected=new Set();
    for(const {node,snapshot} of snapshotsOf(root.querySelectorAll(bodySelector))){
      if(truncated)break;
      await cooperate();
      if(!validSources([snapshot]) || nearestRecord(node)!==root)continue;
      let nested=false;
      for(let ancestor=parent(node);ancestor && ancestor!==root;ancestor=parent(ancestor))if(selected.has(ancestor)){nested=true;break;}
      if(nested)continue;
      selected.add(node);bodies.push(node);proof.push(snapshot);
    }
    return bodies;
  }
  async function ensureRecord(root){
    const proof=[snapshotSource(root)];if(!validSources(proof))return null;
    if(contexts.has(root)){
      const cached=contexts.get(root);
      if(validSources(recordProofs.get(cached.id) || []))return cached;
      contexts.delete(root);
    }
    const parentRoot=nearestRecord(parent(root));
    const parentRecord=parentRoot?await ensureRecord(parentRoot):null;
    const authorEl=await findWithin(root,['[data-testid="User-Name"] a','[rel~="author"]','[itemprop="author"]','#author-text','[data-testid="comment-author"]','[data-testid="post-author"]','[data-testid="author"]','[data-ad-rendering-role="profile_name"]','.comment-author','.review-author','.post-author','.author','.username','.user-name'],proof);
    const observedAuthor=authorEl?(await readText(authorEl,false,null,0,undefined,proof)).slice(0,300):'';
    const authorLink=authorEl?.closest('a[href]');
    if(authorLink)proof.push(snapshotSource(authorLink));
    const titleEl=await findWithin(root,['[itemprop="headline"]','.comment-title','.review-title','.post-title','[role="heading"]','h1','h2','h3','h4','h5','h6'],proof);
    const authorTitleEl=await findWithin(root,['[itemprop="jobTitle"]','.author-title','.user-title','.professional-title','[data-testid="author-title"]'],proof);
    const title=titleEl?(await readText(titleEl,false,null,0,undefined,proof)).slice(0,500):'';
    const timeEl=await findWithin(root,['time','.comment-date','.published','[itemprop="datePublished"]'],proof);
    const authorTitle=authorTitleEl?(await readText(authorTitleEl,false,null,0,undefined,proof)).slice(0,300):'';
    const published=timeEl?(await readText(timeEl,false,null,0,undefined,proof)).slice(0,100):'';
    if(parentRecord)proof.push(...recordProofs.get(parentRecord.id));
    if(!validSources(proof))return null;
    const named=label(root,proof).match(/^(?:Comment|Reply|Post|Review) by (.{1,200})$/i);
    const author=observedAuthor || (named?named[1]:'');
    const type=root.matches('[data-testid="tweet"],[role="article"]') || isQuoteRoot(root)?'post':root.matches('article')?'article':root.matches('.review,[data-review-id],[itemtype*="Review"]')?'review':'comment';
    if(!nodeIds.has(root))nodeIds.set(root,++nextNode);
    const description={type,author,authorTitle,title:title===author?'':title,published,authorUrl:authorLink?safeUrl(authorLink.getAttribute('href')):'',parentId:parentRecord?.id || ''};
    const signature=nodeIds.get(root)+'|'+JSON.stringify(description);
    let id=recordIds.get(signature);
    if(!id){
      id='r'+(++nextRecord);
      const value={id,...description};
      const cost=encoder.encode(JSON.stringify(value)).length;
      if(bytes+cost>limits.bytes){limit('2.5 MB of captured evidence');return null;}
      bytes+=cost;records[id]=value;recordIds.set(signature,id);
    }
    const record=records[id];recordProofs.set(id,proof);contexts.set(root,record);return record;
  }
  function add(kind,text,extra={},element=null,record=null,proof=[]){
    try{
      const evidence=record?[...proof,...(recordProofs.get(record.id) || [null])]:[...proof];
      if(!validSources(evidence))return;
      const sectionHeading=heading && validSources(headingProof)?heading:'';
      if(sectionHeading)evidence.push(...headingProof);
      text=kind==='code'?(text || '').replace(/\r\n/g,'\n').trim():clean(text);
      if(!text || truncated)return;
      const signature=kind+'|'+text+'|'+(record?.id || '')+'|'+JSON.stringify(extra);
      let signatures,ids;
      if(element){
        signatures=seen.get(element);if(!signatures){signatures=new Map();seen.set(element,signatures);}
        if(signatures.has(signature)){
          // A live framework can replace identical DOM nodes. Refresh the proof
          // after fresh validation, retaining the original evidence/decision IDs.
          const previousIds=signatures.get(signature);
          if(previousIds.length && !sameProof(targets.proofs.get(previousIds[0]),evidence)){
            for(const id of previousIds)target(id,element,evidence);
            refreshedTargets=true;
          }
          return;
        }
        ids=[];signatures.set(signature,ids);
      }
      for(let offset=0;offset<text.length;offset+=2400){
        if(blocks.length>=limits.blocks){limit(limits.blocks.toLocaleString()+' blocks');return;}
        if(characters>=limits.characters){limit(limits.characters.toLocaleString()+' text characters');return;}
        const part=text.slice(offset,Math.min(offset+2400,offset+limits.characters-characters));
        const block={id:'b'+(blocks.length+1),kind,heading:sectionHeading,text:part,...extra,...(extra.contextCharacters?{contextCharacters:Math.max(0,extra.contextCharacters-offset)}:{}),...(record?{recordId:record.id}:{})};
        const cost=encoder.encode(JSON.stringify(block)).length;
        if(bytes+cost>limits.bytes){limit('2.5 MB of captured evidence');return;}
        blocks.push(block);characters+=part.length;bytes+=cost;
        if(element){ids.push(block.id);target(block.id,element,evidence);}
        if(part.length<Math.min(2400,text.length-offset)){limit(limits.characters.toLocaleString()+' text characters');return;}
      }
    }finally{
      if(readClipped){readClipped=false;limit('remaining text aggregation budget');}
    }
  }
  async function walk(el,inherited=null,root=snapshotSource(el)){
    let proof=[root];
    if(truncated || !root || !visible(el))return;
    await cooperate();
    if(!validSources(proof))return;
    const isRecord=isRecordRoot(el);
    const record=isRecord?await ensureRecord(el):inherited;
    const previousHeading=heading;
    const previousHeadingProof=headingProof;
    if(isRecord && record?.title){heading=record.title;headingProof=recordProofs.get(record.id);}
    try{
      if(el.matches('iframe,frame')){warnings.add('Embedded frames are not captured. Open the embedded page directly.');return;}
      if(isRecord && record && options.groupComments!==false && record.type!=='article'){
        const bodies=await bodiesWithin(el,proof);
        if(!bodies.length)bodies.push(el);
        const parts=[],links=[],budget={remaining:limits.characters-characters+1},linkBudget={size:0,urls:new Set(),full:false};
        for(const body of bodies){
          parts.push(await readText(body,false,el,0,budget,proof));
          links.push(...await linksOf(body,el,proof,linkBudget));
        }
        const text=parts.join('\n\n');
        const more=await findWithin(el,['[data-testid="tweet-text-show-more-link"]'],proof);
        if(more){collapsed=true;warnings.add('Some posts have collapsed text. Only loaded previews were captured. Expand Show more on the source page, then rescan or keep scroll capture running.');}
        const lines=[record.author&&'Author: '+record.author,record.authorTitle&&'Author title: '+record.authorTitle,record.title&&'Title: '+record.title,record.published&&'Published: '+record.published].filter(Boolean);
        const prefix=lines.length?clean(lines.join('\n'))+'\n\n':'';
        add('comment',prefix+text,{links,contextCharacters:prefix.length,...(more?{collapsed:true}:{})},el,record,proof);
        // Replies and quote cards keep their own authors and parent context.
        const nested=[...el.querySelectorAll(recordSelector+','+quoteSelector)].filter(child=>isRecordRoot(child) && nearestRecord(parent(child))===el);
        for(const {node:child,snapshot} of snapshotsOf(nested))await walk(child,record,snapshot);
        return;
      }
      if(el.matches('img')){add('image',el.getAttribute('alt'),{url:safeUrl(el.currentSrc || el.src)},el,record,proof);return;}
      if(/^H[1-6]$/.test(el.tagName) || el.matches('[role="heading"]')){
        const text=await readText(el,false,null,0,undefined,proof);heading=text.slice(0,300);headingProof=[...proof];add('heading',text,{level:Number(el.getAttribute('aria-level') || el.tagName.slice(1)) || 2,links:await linksOf(el,null,proof)},el,record,proof);return;
      }
      if(el.matches('table')){
        for(const {node:row,snapshot} of snapshotsOf(el.querySelectorAll('tr'))){
          if(truncated)break;
          const rowProof=[root,snapshot];
          await cooperate();
          if(rowProof[0] && validSources(rowProof))add('table',await readText(row,false,null,0,undefined,rowProof),{links:await linksOf(row,null,rowProof)},row,record,rowProof);
        }
        return;
      }
      const atomic=el.matches('p,li,pre,blockquote,dt,dd,address,figcaption,summary,a[href],button,[role="button"],[role="link"]');
      const nested=el.querySelector('p,li,table,h1,h2,h3,h4,h5,h6,[role="heading"],pre,blockquote,dt,dd,address,figcaption,'+recordSelector);
      if(!el.shadowRoot && ((atomic&&!nested) || !el.children.length)){
        add(el.tagName==='PRE'?'code':'text',await readText(el,el.tagName==='PRE',null,0,undefined,proof),{links:await linksOf(el,null,proof)},el,record,proof);return;
      }
      let pending='';
      const flush=()=>{add('text',pending,{},el,record,proof);pending='';proof=[root];};
      for(const {node,snapshot} of childrenOf(el)){
        if(truncated)break;
        await cooperate();
        if(!validSources([root]))return;
        if(!snapshot)continue;
        if(!validSources([snapshot])){proof.push(snapshot);continue;}
        if(node.nodeType===3){
          const room=Math.max(0,limits.characters-characters+1-pending.length);
          proof.push(snapshot);
          pending+=' '+snapshot.state.slice(0,Math.max(0,room-1));
          if(snapshot.state.length+1>room){readClipped=true;flush();break;}
        }
        else if(node.nodeType===1){flush();await walk(node,record,snapshot);}
      }
      flush();
      if(!el.childNodes.length){const value=label(el,proof);if(value)add('text',value,{},el,record,proof);}
    } finally {if(isRecord){heading=previousHeading;headingProof=previousHeadingProof;}}
  }
  function coverage(){
    return {blocks:blocks.length,characters,bytes,visitedElements:visited,sourceNodes,validationElementLimit,omitted,collapsed,truncated,limitReason,depth,watching:!!observer&&!stopped,records:Object.keys(records).length,warnings:[...warnings]};
  }
  async function flush(){
    if(busy)await busy;
    busy=(async()=>{
      visibility=new WeakMap();contexts=new WeakMap();lastYield=performance.now();
      const roots=[...dirty];dirty.clear();
      for(const el of roots){
        if(!el.isConnected || truncated)continue;
        const container=nearestRecord(el);
        const inherited=container&&container!==el?await ensureRecord(container):null;
        await walk(container || el,inherited);
      }
    })();
    try{await busy;}finally{busy=null;}
    const newRecords={};for(const id of Object.keys(records))if(!deliveredRecords.has(id)){newRecords[id]=records[id];deliveredRecords.add(id);}
    const delta={blocks:blocks.slice(delivered),records:newRecords,coverage:coverage(),refreshedTargets};delivered=blocks.length;refreshedTargets=false;return delta;
  }
  warnings.add('Only loaded DOM content can be captured. Hidden content, form values, closed shadow roots, image/PDF/canvas pixels and unloaded items are excluded.');
  const description=document.querySelector('meta[name="description"]')?.content || '';
  if(description)add('metadata',description.slice(0,4000));
  if(document.body)await walk(document.body);
  if(options.watch && !truncated){
    observer=new MutationObserver(changes=>{
      for(const change of changes){
        if(change.type==='attributes' && !attributeFilter.includes(change.attributeName))continue;
        const target=change.target.nodeType===1?change.target:change.target.parentElement || change.target.host || change.target.parentNode?.host;
        if(!target || excludedTree(target))continue;
        const record=nearestRecord(target);
        if(record){dirty.add(record);continue;}
        if(change.type==='attributes'){
          if(attributeFilter.includes(change.attributeName))dirty.add(target);
          continue;
        }
        if(change.type==='characterData'){dirty.add(target.closest('p,li,[role="heading"]') || target);continue;}
        if([...change.addedNodes].some(node=>node.nodeType===3 && node.textContent.trim()))dirty.add(target);
        for(const node of change.addedNodes)if(node.nodeType===1 && !node.matches('[data-linis-ui]'))dirty.add(nearestRecord(node) || node);
      }
      if(dirty.size>500){dirty.clear();if(document.body)dirty.add(document.body);}
    });
    observer.observe(document.documentElement,observation);
    for(const root of shadowRoots)observer.observe(root,observation);
    watchdog=setTimeout(()=>stop('Scroll capture reached its time limit.'),240000);
    globalThis.__linisCapture={url:location.href,stop,flush};
  }
  delivered=blocks.length;
  for(const id of Object.keys(records))deliveredRecords.add(id);
  return {title:document.title.slice(0,500),url:location.href,language:document.documentElement.lang || '',capturedAt:new Date().toISOString(),blocks,records,coverage:coverage()};
}

export async function drainPageCapture(finish = false) {
  const session=globalThis.__linisCapture;
  if(!session || session.url!==location.href){session?.stop();delete globalThis.__linisCapture;return {ended:true,blocks:[],records:{},coverage:null};}
  if(finish){session.stop();delete globalThis.__linisCapture;}
  const delta=await session.flush();
  return {...delta,ended:finish || !delta.coverage.watching};
}
