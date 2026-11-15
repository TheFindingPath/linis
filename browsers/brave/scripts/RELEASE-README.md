# Linis 1.0.0 — local test release

A page-evidence extractor for Brave and compatible Chromium browsers, powered by your own TypeSafe or OpenRouter account. This ZIP is an unpacked extension for a final local test, not a signed store installation.

## Install and test

1. Extract the ZIP to a permanent folder. Inside it, locate the linis folder containing manifest.json.
2. Open brave://extensions or chrome://extensions and enable Developer mode.
3. Choose **Load unpacked**, then select that linis folder. Do not select the ZIP itself.
4. Pin **Linis** and open an ordinary HTTP/HTTPS page. Click Linis, open Settings, choose a provider and enter your own API key.
5. Start with an ordinary public page. Review the captured/kept counts, coverage notes, source links and exported file. API use may consume credits.

The icon is a refined lavender-purple L on a dark violet tile. The popup reports version 1.0.0. No server, npm installation or build is needed to use the extension.

**Privacy:** captured evidence, page URLs, links and your goal go to the selected provider. Keys remain in trusted local extension storage without extension-provided encryption. Automatic saving defaults on; downloaded files remain on disk. Read [PRIVACY.md](../PRIVACY.md).

## Final test checklist

- Configure the provider you intend to use; check that extraction returns decisions and valid source links.
- Save Markdown, text and JSON; JSON uses linis/1 and includes skipped/unprocessed evidence.
- Try scroll capture on loaded posts/comments, then **Finish & save**. Check **Cancel** preserves clearly partial evidence without automatically saving.
- A capture window normally closes after two minutes with an automatic-closure notice. A four-minute overall deadline produces partial results with a distinct explanation.
- Test a changed link/label or newly revealed content while scroll capture is active. Review coverage warnings; no guarantee is made for every site layout.
- Check actual Downloads and the icon in your browser toolbar. Confirm no unexpected permissions are requested.

## Switching from an older unpacked installation

Keep the original folder. Save wanted old results and disable the old extension while testing Linis. A new unpacked location may use a different extension identity: do not assume keys, preferences or results transfer. Enter your API key again. Keep this extracted folder in place while the extension is installed; moving it may require loading it again.

## Verification and limitations

The current source passed 66 offline regression tests. These model browser/DOM behavior and mock provider transport. No fresh real-browser extension or live-provider certification is claimed for this ZIP; this local test is the next step. [TESTING.md](../TESTING.md) contains the source-oriented verification guide; development commands in it require the full source tree, not just this runtime ZIP. [USAGE.md](../README.md) describes capture, exports and limits.

Capture is bounded and heuristic. It does not automatically scroll, expand controls, crawl, or transcribe images/audio/video. Collapsed, unloaded, inaccessible and rapidly changing content may be missed. A completed evaluation is not a claim that an entire site was captured.

## Licensing

Apache-2.0 is the project default; full text: [LICENSE](../../../LICENSE). The owner's rights in the identified source-code snapshots additionally offer **Apache-2.0 OR 0BSD**, at the recipient's choice. Other contributors' work is not automatically covered by 0BSD. See [LICENSING.md](../../../LICENSING.md), [OWNERSHIP.md](../../../OWNERSHIP.md), [licensing/owner-code.json](../../../licensing/owner-code.json), and the full [0BSD text](../../../LICENSES/0BSD.txt). [THIRD_PARTY_NOTICES.md](../../../THIRD_PARTY_NOTICES.md) preserves dependency information.

The ownership inventory uses source-repository paths. Files under browsers/brave/extension/ are placed directly in this archive's linis folder without changing their content. Development scripts/tests listed in the inventory are not part of the runtime ZIP. Artwork is excluded from the owner's additional 0BSD code grant.
