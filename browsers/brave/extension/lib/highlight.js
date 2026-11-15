// Native element styles scroll with the browser. No scroll listeners or geometry reads.
export function updatePageHighlights(payload) {
  let view = globalThis.__linisHighlight;
  if (payload.type === 'clear') {
    view?.destroy();
    if (payload.discardTargets) delete globalThis.__linisTargets;
    return {visible:false};
  }
  const targets = globalThis.__linisTargets;
  if (!targets || targets.url !== location.href) { view?.destroy(); return {visible:false,reason:'page_changed'}; }
  if (view && view.jobId !== payload.jobId) { view.destroy(); view=null; }
  if (!view) {
    const attribute = 'data-linis-mark';
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('[data-linis-mark="reading"]{outline:2px solid #e6c600!important;outline-offset:2px!important;background-color:rgba(255,230,0,.20)!important}[data-linis-mark="kept"]{outline:2px solid #289b61!important;outline-offset:2px!important;background-color:rgba(40,155,97,.08)!important}[data-linis-mark="skipped"]{outline:2px dashed #e34848!important;outline-offset:2px!important;background-color:rgba(227,72,72,.09)!important}');
    const roots=new Set(), applied=new Map(), statuses=new Map();
    const observation={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:targets.attributeFilter || ['class','style','hidden','aria-hidden','contenteditable','href','aria-label','alt','title','src','role','open']};
    const root=document.createElement('div');root.setAttribute('data-linis-ui','');root.setAttribute('aria-hidden','true');
    for(const [name,value] of Object.entries({position:'fixed',top:'12px',right:'12px','z-index':'2147483647','pointer-events':'none',margin:'0',padding:'0'}))root.style.setProperty(name,value,'important');
    const shadow=root.attachShadow({mode:'open'});
    const style=document.createElement('style');
    style.textContent=':host{all:initial}.chip{max-width:330px;box-sizing:border-box;background:#172d24;color:#f8fff8;border:1px solid #c9e69a;border-radius:10px;padding:10px 14px;font:12px/1.5 system-ui;box-shadow:0 2px 12px #0002}.title{font-weight:700;color:#d7eaa2}.stats,.hint,.legend{font-size:10px;color:#d9e2d7}.legend{margin-top:4px}.legend span{margin-right:9px}.yellow{color:#ffe600}.green{color:#78e7aa}.red{color:#ff8c8c}';
    const chip=document.createElement('div');chip.className='chip';
    const title=document.createElement('div');title.className='title';
    const stats=document.createElement('div');stats.className='stats';
    const hint=document.createElement('div');hint.className='hint';
    const legend=document.createElement('div');legend.className='legend';
    for(const [text,color] of [['Scan','yellow'],['Kept','green'],['Rejected','red']]){const span=document.createElement('span');span.className=color;span.textContent=text;legend.append(span);}
    chip.append(title,stats,hint,legend);shadow.append(style,chip);document.documentElement.append(root);
    let current=payload,finishedAt=null,expiry=null,destroyed=false;
    const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
    function clock(){
      if(destroyed)return;
      const elapsed=Math.max(0,((finishedAt || Date.now())-Date.parse(current.startedAt))/1000);
      setText(title,`linis · ${current.providerName || 'Jev'} · ${finishedAt?'Finished':current.capturing?'Scroll capture':'Scan'}`);
      setText(stats,`${current.done || 0}/${current.total || 0} evaluated · ${elapsed.toFixed(1)}s`);
      setText(hint,current.limited?'Some source marks are unavailable on this complex page.':current.capturing&&!finishedAt?'Scroll to load more. Use Finish & save in the extension. Unmarked does not mean rejected.':'Only captured, loaded content is evaluated. Unmarked does not mean rejected.');
    }
    function restore(element){
      const old=applied.get(element);if(!old)return;
      if(old.original===null)element.removeAttribute(attribute);else element.setAttribute(attribute,old.original);
      applied.delete(element);
    }
    function destroy(){
      if(destroyed)return;destroyed=true;clearInterval(timer);clearTimeout(expiry);clearTimeout(watchdog);observer.disconnect();
      for(const element of [...applied.keys()])restore(element);
      for(const scope of roots){try{scope.adoptedStyleSheets=scope.adoptedStyleSheets.filter(item=>item!==sheet);}catch{}}
      root.remove();if(globalThis.__linisHighlight===view)delete globalThis.__linisHighlight;
    }
    // Live counters and video controls are not captured evidence. Recheck the
    // affected proof before erasing a mark, while still rejecting recycled text.
    const observer=new MutationObserver(records=>{
      records=records.filter(record=>record.type!=='attributes' || observation.attributeFilter.includes(record.attributeName));
      const affected=new Set();
      const changedAttributes=[...new Set(records.filter(record=>record.type==='attributes').map(record=>record.target))];
      if(changedAttributes.length){
        for(const [element,entry] of applied){
          if(!targets.affectedByAttributes || entry.ids.some(id=>targets.affectedByAttributes(id,changedAttributes)))affected.add(element);
        }
      }
      for(const record of records){
        const element=record.target.nodeType===1?record.target:record.target.parentElement;
        const marked=element?.closest?.('['+attribute+']');
        if(marked && applied.has(marked))affected.add(marked);
      }
      const pass=targets.validationPass?.();
      for(const element of affected){
        const entry=applied.get(element);
        if(targets.isCurrent && !entry.ids.some(id=>!targets.changedChildren?.(id,records) && targets.isCurrent(id,pass)))restore(element);
      }
      if(pass?.exhausted){current={...current,limited:true};clock();}
    });
    observer.observe(document.documentElement,observation);
    const timer=setInterval(clock,500);
    const watchdog=setTimeout(()=>{destroy();if(globalThis.__linisTargets===targets)delete globalThis.__linisTargets;},300000);
    view={jobId:payload.jobId,destroy,update(next){
      current=next;
      for(const id of next.ids || [])statuses.set(id,'reading');
      for(const decision of next.decisions || [])statuses.set(decision.id,decision.category==='skip'?'skipped':'kept');
      const wanted=new Map(),wantedIds=new Map();
      const sourcePass=targets.validationPass?.();
      // Prioritize the active batch when a complex page exceeds the mark budget.
      for(const id of new Set([...(next.ids || []),...statuses.keys()])){
        const status=statuses.get(id);
        const element=targets.nodes.get(id);if(!element?.isConnected)continue;
        if(targets.isCurrent && !targets.isCurrent(id,sourcePass))continue;
        const old=wanted.get(element);
        if(!old || status==='reading' || old==='skipped'&&status==='kept')wanted.set(element,status);
        if(!wantedIds.has(element))wantedIds.set(element,[]);
        wantedIds.get(element).push(id);
      }
      current={...next,limited:sourcePass?.exhausted};
      for(const element of [...applied.keys()])if(!wanted.has(element))restore(element);
      for(const [element,status] of wanted){
        const scope=element.getRootNode();
        if(!roots.has(scope)){try{scope.adoptedStyleSheets=[...scope.adoptedStyleSheets,sheet];roots.add(scope);if(scope!==document)observer.observe(scope,observation);}catch{continue;}}
        let entry=applied.get(element);
        if(!entry){entry={original:element.getAttribute(attribute),status:null};applied.set(element,entry);}
        entry.ids=wantedIds.get(element);
        if(entry.status!==status){element.setAttribute(attribute,status);entry.status=status;}
      }
      if(next.type==='finish'){
        finishedAt=Date.now();clearTimeout(expiry);
        expiry=setTimeout(()=>{destroy();if(globalThis.__linisTargets===targets)delete globalThis.__linisTargets;},4000);
      }
      clock();
    }};
    globalThis.__linisHighlight=view;
  }
  view.update(payload);
  return {visible:true};
}
