# Linis privacy and permissions

Last updated: 15 Nov 2026.

The source guard checks connectedness, ancestry, current eligibility, and unchanged source values before accepting evidence. Relevant attribute changes also queue incremental capture and revalidate affected highlights. Evidence already committed while public remains a point-in-time snapshot; later hiding it does not retract a request already sent. These controls are not a universal privacy guarantee.

Linis is activated by the user. It does not automatically monitor browsing, crawl sites, or collect analytics.

## What leaves the browser

After you click **Extract this page**, captured page blocks, page title and URL, headings, links, image URLs/descriptions, and your extraction goal are sent only to your selected provider: TypeSafe at `https://api.typesafe.ai/v1/systemone`, or OpenRouter at `https://openrouter.ai/api/alpha/decisions`. Only that provider's key is used, as an Authorization header to its fixed HTTPS endpoint. Redirects are rejected and providers are never switched automatically. The selected provider's policies and account terms, including downstream inference providers when using OpenRouter, govern processing and retention of API requests.

Form values, text areas, editable content, hidden elements, cookies, browser history and passwords are not deliberately collected. Names and accessible labels on visible controls, observed author/professional titles, post/comment text, dates and attribution links may be captured. Page content can itself contain personal or confidential information: decide whether to send it before starting. The extension does not read screenshots or image pixels.

## Browser storage

- API keys, provider, mode, highlight, capture and output preferences: `chrome.storage.local`, restricted to trusted extension contexts. Keys are separate for each provider, are not encrypted by the extension, and are not synced. **Forget key** removes only the selected provider's key; uninstalling removes all settings. Legacy single-key settings can be normalized within the same extension identity; settings do not automatically transfer from a different unpacked installation.
- Latest result: `chrome.storage.session`, restricted to trusted extension contexts. Full captured evidence is retained for the current browser session. **Clear**, extension reload or browser restart removes it. Starting another extraction replaces it.
- Exports: automatic saving is on by default. Each successful extraction downloads one file to your browser's Downloads folder, including when the popup has closed. You can turn automatic saving off or change the format in File output settings. Manual Save also creates a local file. Downloaded files remain on disk after clearing results or uninstalling. Full JSON contains all captured blocks, including those Jev skipped; Markdown and plain text contain selected information and provenance. No additional upload is involved in creating a file.

No credentials are bundled. No credentials or page data are logged intentionally. Provider error bodies are not displayed. Page text is rendered using textContent; no page HTML or remote executable code is run by the extension. Native highlights use temporary attributes and locally adopted style sheets; original inline styles are not rewritten. DOM references and local source fingerprints are not sent to either provider. Marks do not intercept clicks and are removed after completion, cancellation, error or toggling off, with a timeout safeguard.

Automatic capture mode uses a bounded scroll-capture session on X/Twitter, YouTube and Facebook after you explicitly start it. While active, a MutationObserver queues new/changed loaded content on that same source page and those captured records can be sent to the selected Jev provider. It does not scroll, click Load more, follow links, observe other tabs, or keep a background browsing history. Finish & save, Cancel, source-page changes, limits and time bounds end collection. The normal capture window is two minutes and the overall job deadline is four minutes; automatic closure and deadline expiry are identified separately from user actions. You can choose Loaded page snapshot instead. A job may preserve earlier captured versions of a recycled post so attribution is not overwritten.

## Requested permissions

| Permission | Purpose |
| --- | --- |
| `activeTab` | Access only the page for which you invoke the extension, until the browser revokes that access. |
| `scripting` | Run the collector, bounded incremental capture and optional native highlights in the granted page's isolated extension world. |
| `storage` | Store your key and latest extraction. |
| `downloads` | Save locally generated extraction files, and check only their download IDs for completion or failure. |
| `https://api.typesafe.ai/*` | Make authenticated requests to the Jev API. |
| `https://openrouter.ai/*` | Make authenticated Jev Decisions requests when OpenRouter is selected. |

The package requests no all-sites access, browsing history, native messaging, network interception, or automatic content scripts.
