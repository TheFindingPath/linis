# Linis

<img src="browsers/brave/extension/icons/linis-purple128.png" alt="Linis icon" width="64" height="64">

Linis 1.0.0 is a Manifest V3 Chromium extension that collects loaded page evidence, asks Jev which blocks are useful, and lets you review and export the original evidence. It uses your own TypeSafe or OpenRouter key and API credits. No local server, runtime installation, or build is needed.

## Test it locally

1. Open brave://extensions or chrome://extensions and enable Developer mode.
2. Choose **Load unpacked** and select this repository's **browsers/brave/extension** folder (the folder containing manifest.json).
3. Pin **Linis**, open an ordinary HTTP/HTTPS page, and click its toolbar button.
4. In Settings, select a provider and enter your own API key. Start a snapshot or scroll capture, review the results, and save Markdown, text, or full JSON.

Automatic saving is on by default. Captured page text, URLs, links, and your goal are sent to the selected provider. Read [PRIVACY.md](PRIVACY.md) before using sensitive pages.

## Build an unpacked release ZIP

The extension can be loaded directly from source. To make a local ZIP with Node.js and no npm installation:

```sh
cd browsers/brave
node scripts/package.mjs
```

This creates dist/linis-1.0.0.zip and its .sha256 checksum. Extract the ZIP to a permanent folder and load its inner linis folder containing manifest.json. Installation instructions, the final test checklist and both licence texts are included. Generated dist files are excluded from source control; attach the ZIP and checksum to a GitHub release separately if distributing them. This is not a signed store release.

## Switching from an older unpacked installation

Load Linis as a separate installation for this test. Do not replace or remove the original source folder. Do not assume keys, preferences, extension identity, or results transfer to the new folder. Enter your key again, save any wanted old results, and disable the old extension to avoid confusing the two. Keep the old installation separate; do not copy its Git history into a new public repository.

Linis starts its own version series at 1.0.0. New JSON exports use **linis/1**, replacing the former **jevtention/1** format marker; the evidence structure is retained, but external consumers that check the marker need updating. No JSON importer or automatic conversion is provided. Download filenames begin with linis-.

## Limits and verification

- Captures loaded DOM content, including below the fold; it never scrolls, expands controls, crawls, or transcribes media automatically.
- Site grouping and author attribution use structural heuristics. Collapsed, unloaded, inaccessible, or rapidly changing content can be missed. Review coverage notes and full JSON when completeness matters.
- Scroll capture normally closes after two minutes; queued evidence can continue evaluating until the four-minute job deadline. User finish, automatic closure, cancellation, and deadline expiry are reported distinctly.
- Batches use an 18,000-character serialized-evidence heuristic and up to 16 blocks. Every complete serialized request is also checked against a **65,536-byte UTF-8 client limit** before sending; this is not a promise about provider limits. An oversized request stops with an explicit error.
- Only the latest result is retained in session storage. Keys and preferences remain in local extension storage. Downloaded files remain on disk.

The offline suite passes **66 tests**. This Linis copy has not been certified with a fresh real-browser extension or live-provider run. Your local testing is the next step. See the [usage guide](browsers/brave/README.md) and [verification guide](browsers/brave/TESTING.md).

## Development

From the repository root, with Node.js 22.18 or later:

```sh
node --test browsers/brave/tests/*.test.mjs
```

Run `node scripts/check-source.mjs` to check source links, licence-scope hashes, runtime assets and sensitive-content patterns. The GitHub workflow runs these checks and the offline suite on Windows and Linux without installing project dependencies.

These offline tests need no npm installation. Optional browser tests use development dependencies; instructions and side effects are documented in the verification guide. Runtime extension code has no npm dependencies.

## Licence and contributions

The project defaults to **Apache License 2.0**; see [LICENSE](LICENSE). Contributors keep ownership of their work and license incoming contributions under Apache-2.0 unless they explicitly agree otherwise.

The project owner's copyright interests in the current code snapshots identified in [OWNERSHIP.md](OWNERSHIP.md) and [licensing/owner-code.json](licensing/owner-code.json) are additionally available under 0BSD: **Apache-2.0 OR 0BSD**, at the recipient's choice. This permission covers only rights the owner actually holds. It does not relicense dependencies, other contributors' code, artwork, or trademarks. A mixed-ownership file is not automatically dual-licensed as a whole.

See [LICENSING.md](LICENSING.md) for scope and mixed-file rules, [LICENSES/0BSD.txt](LICENSES/0BSD.txt) for the full 0BSD text, [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for preserved third-party terms, and [CONTRIBUTING.md](CONTRIBUTING.md) for incoming contributions. AI-output copyrightability and any undisclosed third-party provenance remain flagged for review.
