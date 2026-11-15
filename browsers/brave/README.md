# Linis

Version: 1.0.0. Unpacked test candidate; see the verification notes before treating it as a certified release.

This copy includes the current feed/quote fixes plus attribute observation, a complete UTF-8 request cap, and explicit capture finish reasons. The 66 offline tests pass. No fresh real-browser extension, live feed, or live-provider certification is claimed.

**Click. Let Jev find the signal. Keep the original evidence.**

linis is a Manifest V3 browser extension built for Brave and compatible Chromium browsers. It runs the extraction client entirely inside the browser: no local server, desktop helper, build step, or other edition is required. Jev inference uses your choice of TypeSafe or OpenRouter, so an internet connection and a key with credit for the selected service are required. The model weights are not bundled or run locally.

## Install in Brave

1. Use this project's `extension` folder directly. No install, build or package step is required.
2. Open `brave://extensions`, turn on **Developer mode**, and choose **Load unpacked**.
3. Select the `linis` folder containing `manifest.json` (the `extension` folder if using the source).
4. Pin **linis** using Brave's extensions menu.
5. Open a normal web page, click linis, expand **Provider & API keys**, select **TypeSafe** or **OpenRouter**, and save that service's key. [TypeSafe keys](https://console.typesafe.ai/keys) · [OpenRouter keys](https://openrouter.ai/settings/keys).
6. Choose what Jev should find, optionally describe a more specific focus, then click **Extract this page**. On X, YouTube and Facebook, the default button is **Start scroll capture**: scroll the source page to load content, then choose **Finish & save**.

The compact popup keeps **Extract**, **Stop**, **Save file**, **Settings**, and the `↗` workspace button in a sticky top bar. Extraction continues if the popup closes. Keep the original source tab open until capture finishes. Saved keys stay in trusted local extension storage; no key is included in the downloadable extension.

To update an existing installation, replace the files in its unpacked folder and click **Reload** on `brave://extensions`. For this separate Linis folder, load it as a new unpacked installation and enter your key again; do not assume preferences or results transfer. See the [root migration notes](../../README.md#switching-from-an-older-unpacked-installation). Provider keys are saved separately; switching or forgetting one never sends or deletes another provider's key. There is no automatic provider fallback.

In Chrome, use `chrome://extensions`. Edge, Vivaldi and Opera use the same Chromium extension format, but are not verified in this release. Firefox and Safari require separate packaging and are not supported by this package.

## What happens when you click

1. An isolated, cooperative scanner reads loaded DOM content: headings (including ARIA headings), paragraphs, lists, tables, code, links, image alt text, metadata, visible button/accessible names and open shadow DOM. It yields between work chunks so scanning does not monopolize the page's main thread.
2. The extension sends batches of source blocks and your optional extraction goal to Jev through the selected service: TypeSafe (`jev-latest`) or OpenRouter (`~typesafe/jev-latest`). Each block gets an independent typed decision: content, contact, data, media, or skip.
3. Selected evidence appears as searchable cards. Low-confidence decisions are marked for review. Observed author names, professional titles, post titles and comment text are kept together where the page structure supplies that relationship. Names are not invented and comments are not rewritten into summaries.
4. Exports include the page URL, capture time, provider, model, coverage, elapsed time, throughput, and extraction status. Full JSON also preserves skipped and unprocessed blocks, allowing you to inspect decisions.

The extension reads content and makes no page clicks, submissions, purchases, or navigation decisions. It does not crawl other URLs or run a web search. Links in results are source references. **Captured** means collected from loaded DOM; **evaluated** means Jev returned a decision; **kept/rejected** are Jev's selections. A rejected name was not necessarily absent from the scan: **Include rejected blocks**, the Rejected category, and full JSON let you inspect that distinction.

## Simple Jev modes

Choose **All useful information**, **Key facts**, **People & contacts**, **Posts & comments**, **Prices & specifications**, or **Sources & citations**. Each mode gives Jev a focused selection goal, combined with your refinement. Focused modes constrain Jev's choices to the relevant kind of information or skip. People & contacts includes names and professional titles even without contact details. Posts & comments keeps attribution and contributions together. Key facts does not generate a rewritten summary. The mode persists and adds no extra model calls per batch.

Results can be filtered by text, Jev's assigned category, or **Show only decisions needing review**. These filters change the display, while file exports include all information Jev selected. Full JSON also includes skipped and unprocessed evidence.

## Feeds, comments and deeper capture

**Page capture settings** offers Automatic, Loaded page snapshot, or Capture as I scroll. Automatic chooses scroll capture on X/Twitter, YouTube and Facebook hostnames, and a loaded-page snapshot elsewhere. It never silently follows links or scrolls/clicks for you.

For a feed, choose **Start scroll capture**, close the popup, and scroll normally to load posts/comments. The extension queues changed or newly added DOM records and evaluates them incrementally instead of repeatedly rescanning the whole page. Open the extension and choose **Finish & save** when ready. This finishes pending evaluations and saves a file even if automatic saving is off. **Cancel** stops without automatically saving. The capture window normally closes after two minutes and reports that automatic closure in the popup and exports. Requested Finish & save has a separate reason. The four-minute overall deadline produces explicitly partial results, distinct from user cancellation.

**Group authors with comments** is on by default. Common post/comment/review containers, X-style tweet markup, YouTube comment renderers and labelled Facebook-style articles are recognized. Each record preserves observed author/title/date context, and DOM-nested reply records get separate authors and parent record IDs. Normal article paragraphs also retain available article attribution. A repeated name in separate comments is no longer discarded by global text deduplication. Changed containers preserve successive snapshots, so unchanged prefixes may repeat. Evidence that changes ownership, visibility, editability or value while being read is omitted; retry after the page settles. Open shadow roots remain supported, with cross-context moves rejected. JSON exposes the records dictionary and each block's recordId; readable exports include the attribution. UI searches include those fields.

These are structural heuristics, not a guarantee for every layout. Unknown authors are left unlabelled rather than guessed. Existing captures survive when a feed recycles DOM elements, and stale highlights are removed when source text changes. Items never loaded into the DOM, collapsed replies, login-gated content, closed shadow roots and very rapid loading/unloading can still be missed. Load or expand the content yourself and use the capture counters/coverage notes; no claim is made to capture an entire site's discussion or every future feed item.

Multiple visible body containers in the same contribution are captured together. X-style quote cards implemented as links are recognized when they contain an observed author and post text inside a tweet; quotes retain separate authors and parent context. Detected X Show more controls produce a collapsed-preview warning. Expand these yourself before a snapshot, or while scroll capture is still running. Only loaded, eligible DOM text is read; video/audio and text inside image pixels are not transcribed.

## File output

Automatic saving is **on by default**, including when upgrading. After a successful extraction, linis downloads one **Markdown (.md)** file into your browser's Downloads folder, even if the popup is closed. Use **Settings → File output settings** or the **Auto-save** link at the top to turn this off or choose **Plain text (.txt)** or **Full evidence JSON (.json)**. Your preferences persist between browser sessions.

**Save file** at the top uses your chosen format. The result buttons also offer direct Markdown, text, JSON, or clipboard output. Filenames include the page title and capture timestamp; filename conflicts get a unique suffix. The status shows when the file has actually finished downloading.

Stopped, failed, or interrupted runs are not downloaded automatically. You can save their partial evidence manually, with `-partial` in the filename and the incomplete status in the file. A scan that reaches the documented page-size limit can still finish evaluating its captured blocks; a prominent notice and exported coverage notes state that capture was truncated. A download failure leaves extraction intact and can be retried without another Jev call.

File creation runs in the extension service worker through the browser's Downloads API. It uses locally generated data, with no server upload or separate helper. Changing mode or output settings takes effect for the next extraction; these controls are disabled while a job is running. Reading highlights remain toggleable during extraction.

## Reading highlights

**Show reading highlights** is enabled by default and can be toggled during extraction. **Yellow = Scan**, **green = kept**, and **red dashed = rejected**. A small badge shows evaluated/captured counts and elapsed time.

An unmarked post is not necessarily rejected. Its source may have changed, been recycled, or exceeded the visual work budget. Unrelated counter/video-control changes retain valid marks. Identical source-node replacements refresh the proof and restore the previous decision without another Jev request. New or changed captured text invalidates its old mark. The evaluated count covers collected blocks, not every possible post or every word behind Show more.

Jev evaluates up to 16 blocks per batch, so several elements can light up at once. The display follows real request/response events. Metadata has no on-page element. Native CSS marks scroll with the browser: there is no scroll event handler rebuilding boxes or repeatedly measuring sections. Temporary attributes and adopted style sheets apply the colors, including inside discovered open shadow roots. Original inline style attributes are untouched and restored states are respected. The badge does not block clicks. Turning highlights off removes them immediately; completion clears them after four seconds, with immediate cleanup on cancellation/error and a timeout safeguard.

## Coverage and limits

- Snapshot mode scans the **currently loaded page**, including loaded content below the fold. Scroll capture additionally watches newly loaded content while active. Neither mode fetches unseen pages or automatically scrolls/expands comments.
- It does not read form values, editable fields, hidden content, cross-origin or same-origin frames, closed shadow roots, or text rendered only in canvas/PDF/images. Image descriptions come from alt text. Open embedded pages directly to scan them.
- Browser settings, browser stores, other extensions, local files and protected pages cannot be extracted.
- The default **Deeper** scan allows 2,000 blocks, 800,000 captured text characters and 150,000 element reads. **Standard** retains the previous 400-block/160,000-character/50,000-element budget. The source snapshot guard also limits distinct element/text nodes to the chosen node budget. An aggregate requiring more than 512 styled elements for a fresh check is omitted with a prominent notice and coverage warning; other groups continue. Highlight work is bounded separately, with the active batch prioritized and a badge note when some marks are unavailable. Both have a 2.5 MB serialized evidence budget to leave room for decisions in browser session storage. Blocks split at 2,400 characters; per-block links are limited to 40 and 6,000 characters; URLs longer than 2,048 characters are omitted. Limits and omissions are reported. Deeper captures can use more API credits.
- Jev evaluates batches of up to 16 blocks with an 18,000-character serialized-evidence heuristic and a 25-second request deadline. Every complete request, including metadata, goal, questions and criteria, is capped at 65,536 UTF-8 bytes before sending. Oversized requests stop with an explicit error; this client cap does not assert a provider limit. A job has a four-minute deadline. API errors, cancellation, or browser interruption leave clearly marked partial results, with no silent heuristic fallback.
- Jev may classify a useful block as noise. Review full JSON when completeness matters. No system can guarantee universal access to every site's content.
- Only the latest extraction is retained inside the extension, in browser session storage. It clears on browser restart, extension reload/update, or **Clear**. Downloaded files remain on disk. When automatic saving is off, save before starting another scan. Keys, mode, file preferences and the highlight preference remain in local extension storage until removed or uninstalled.

## Privacy

Extraction is always explicit. The current page's captured text, headings, URLs, links, image URLs, and your goal are sent only to the selected service: `https://api.typesafe.ai/v1/systemone` or `https://openrouter.ai/api/alpha/decisions`. Input fields are excluded. Read [PRIVACY.md](PRIVACY.md) for storage and permissions. API usage is billed by the selected service. There is no analytics or external JavaScript.

## Development and verification

The shipped extension has **no runtime npm dependencies** and requires no build. JavaScript, HTML, CSS and icons are bundled locally. Node.js 22.18+ is needed only for development tests and packaging.

```powershell
npm ci
npm test
npm run test:browser
npm run test:live
npm run test:capture
npm run test:performance
node tests/browser.mjs --chrome
npm run package
```

Browser tests launch the installed browser with a new disposable profile; your regular profile is not changed. `BRAVE_PATH` can override the executable path. Live tests require `TYPESAFE_API_KEY` in the process environment and use real TypeSafe requests from the extension; they do not read personal automation configuration or copy the key into the package or reports. The deterministic suite replaces only the API transport in the test worker. All names, contacts and page content in the bundled test fixtures are synthetic examples.

See [TESTING.md](TESTING.md) for verified behavior and limits. The local test ZIP is an unpacked developer extension, not a signed store installation. Apache-2.0 is the default licence; the owner’s identified code portions are additionally available under 0BSD. See [LICENSING.md](../../LICENSING.md) for exact scope and exclusions.

## API references

- [TypeSafe Jev Choice request and response](https://docs.typesafe.ai/primitives/choice)
- [TypeSafe state and multiple independent questions](https://docs.typesafe.ai/concepts/state)
- [OpenRouter Decisions API](https://openrouter.ai/docs/client-sdks/python/sdks/decisions/README)
- [Chromium activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Chromium Downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads)
- [Official Puppeteer extension testing](https://pptr.dev/guides/chrome-extensions)
