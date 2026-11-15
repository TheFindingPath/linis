// Runs against real DOM APIs in either the shared preview or capture-browser.mjs.
// No transport, credentials, remote resources, or automatic expansion is used.
export async function feedRegressionChecks({collectPage, drainPageCapture, updatePageHighlights}) {
  const checks=[];
  const check=(name,passed)=>checks.push({name,passed:!!passed});
  const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
  document.body.innerHTML=`<article data-testid="tweet" id="outer">
    <div data-testid="User-Name"><a href="https://example.org/outer">Outer writer</a></div>
    <div data-testid="tweetText" id="body">Outer contribution.</div>
    <div data-testid="tweetText">Additional visible paragraph.</div>
    <button data-testid="tweet-text-show-more-link">Show more</button>
    <div role="link" id="quote">
      <div data-testid="User-Name"><a href="https://example.org/quoted">Quoted writer</a></div>
      <div data-testid="tweetText">Quoted contribution.</div>
    </div>
    <div id="controls"><span id="counter">12</span></div>
  </article>`;
  const capture=await collectPage({watch:true});
  const byAuthor=name=>capture.blocks.filter(b=>capture.records[b.recordId]?.author===name);
  const outer=byAuthor('Outer writer'),quoted=byAuthor('Quoted writer');
  check('All visible body containers are captured',outer.some(b=>b.text.includes('Additional visible paragraph.')));
  check('Quote text has its own author and parent context',quoted.some(b=>b.text.includes('Quoted contribution.') && capture.records[capture.records[b.recordId]?.parentId]?.author==='Outer writer'));
  check('Quoted words are not attributed to the outer author',!outer.some(b=>b.text.includes('Quoted contribution.')));
  check('Collapsed posts produce a coverage warning',capture.coverage.warnings.some(note=>/collapsed/i.test(note)));
  check('Show more is left for the user',document.querySelector('[data-testid="tweet-text-show-more-link"]')?.textContent==='Show more');
  const payload={type:'settled',jobId:'feed-regression',ids:[],decisions:outer.map(b=>({id:b.id,category:'content'})),startedAt:new Date().toISOString()};
  updatePageHighlights(payload);
  check('Initial outer highlight is visible',document.getElementById('outer').getAttribute('data-linis-mark')==='kept');
  document.getElementById('counter').firstChild.textContent='13';await settle();
  check('Unrelated live counter does not erase a valid highlight',document.getElementById('outer').getAttribute('data-linis-mark')==='kept');
  document.getElementById('counter').textContent='14';await settle();
  check('Unrelated control subtree replacement preserves the highlight',document.getElementById('outer').getAttribute('data-linis-mark')==='kept');
  const unchanged=await drainPageCapture(false);
  check('Unchanged live controls do not trigger a highlight rebuild',!unchanged.refreshedTargets && unchanged.blocks.length===0);
  // React can replace an identical text subtree; keep the decision without sending it again.
  const previous=document.getElementById('body');previous.replaceWith(previous.cloneNode(true));await settle();
  check('Detached evidence immediately loses its old highlight',!document.getElementById('outer').hasAttribute('data-linis-mark'));
  const refreshed=await drainPageCapture(false);
  check('Unchanged text replacement does not duplicate evidence',refreshed.blocks.length===0);
  check('Proof refresh signals the background even without a new model batch',refreshed.refreshedTargets);
  updatePageHighlights(payload);
  check('Fresh unchanged evidence restores the original decision highlight',document.getElementById('outer').getAttribute('data-linis-mark')==='kept');
  document.getElementById('body').firstChild.textContent='Changed contribution.';await settle();
  check('Changed contribution invalidates its old highlight',!document.getElementById('outer').hasAttribute('data-linis-mark'));
  await drainPageCapture(false);
  const changedIds=[...globalThis.__linisTargets.nodes.keys()];
  updatePageHighlights({...payload,decisions:changedIds.map(id=>({id,category:'content'}))});
  document.getElementById('body').append(' Newly inserted text.');await settle();
  check('Inserted evidence text invalidates its old highlight',!document.getElementById('outer').hasAttribute('data-linis-mark'));
  document.querySelector('[data-testid="tweet-text-show-more-link"]').remove();
  document.getElementById('body').append(' Manually expanded remainder.');await settle();
  const expanded=await drainPageCapture(false);
  check('Manual expansion is captured during the same scroll session',expanded.blocks.some(b=>b.text.includes('Manually expanded remainder.')));
  await drainPageCapture(true);updatePageHighlights({type:'clear',discardTargets:true});

  document.body.innerHTML=`<article data-testid="tweet">
    <div data-testid="User-Name"><a href="https://example.org/sharer">Sharing author</a></div>
    <div role="link"><div data-testid="User-Name"><a href="https://example.org/original">Original author</a></div>
      <div data-testid="tweetText">A quote-only contribution.</div></div>
    <div hidden><div role="link"><div data-testid="User-Name">Hidden author</div><div data-testid="tweetText">PRIVATE-QUOTE</div></div></div>
  </article>`;
  const quoteOnly=await collectPage();
  check('A quote-only card does not borrow the sharing author',quoteOnly.blocks.some(b=>b.text.includes('A quote-only contribution.') && quoteOnly.records[b.recordId]?.author==='Original author') && !quoteOnly.blocks.some(b=>b.text.includes('A quote-only contribution.') && quoteOnly.records[b.recordId]?.author==='Sharing author'));
  check('Hidden quote text stays excluded',!JSON.stringify(quoteOnly).includes('PRIVATE-QUOTE'));
  return checks;
}
