# Linis verification

Version: 1.0.0. Last updated: 15 Nov 2026.

## Fresh offline verification

From the repository root:

```sh
node --test browsers/brave/tests/*.test.mjs
```

Result: **66 passed, 0 failed, 0 skipped**. No npm install is required. These tests model the DOM and extension APIs, and mock provider transport. They do not certify browser layout, activeTab integration, actual downloads, or live provider compatibility.

Coverage includes source ownership/privacy races, capture work budgets, feed and quote attribution, attribute-only link/label/reveal changes, shadow-host eligibility, ancestor highlight invalidation, ignored own-mark changes, full-request Unicode byte limits and exact boundaries, and distinct requested finish/automatic closure/deadline/cancellation paths. Export regressions check the linis/1 schema marker and finish notices.

## Optional browser checks

From browsers/brave, development dependencies can be installed deliberately with npm ci. This step is unnecessary to load the extension and was not run for this copy. With an installed supported browser and dependencies:

```sh
node tests/browser.mjs
node tests/browser.mjs --chrome
node tests/capture-browser.mjs
node tests/scroll-performance.mjs --verify
```

These runners launch disposable browser sessions and write artifacts under browsers/brave/artifacts. The extension runner serves a synthetic loopback fixture. Do not commit artifacts or use a personal browser profile. BRAVE_PATH can select an installed executable.

The capture runner imports tests/feed-fixture.mjs; keep that fixture in source snapshots. All bundled fixtures use synthetic examples.

## Live provider checks

node tests/browser.mjs --live requires an explicitly supplied TYPESAFE_API_KEY and makes billable real provider calls. Never save the key in source or reports. The live runner covers TypeSafe; mocked OpenRouter routing checks do not establish live OpenRouter inference.

No fresh real-browser extension or live-provider runs have been performed for this Linis copy. Previous product verification is not certification of this renamed and modified candidate. Before a release, test each provider you intend to advertise and inspect actual extension permissions, capture, exports, cancellation, and downloads.

## Manual checks before release

Load the extension folder in Developer mode. Confirm Linis 1.0.0 appears, set up your own provider key, and test a snapshot and a scroll session. Check changed links/labels and newly revealed content, requested Finish & save, automatic capture closure, Cancel, and partial exports. Save wanted old results before changing installations; keys and settings are not promised to migrate between unpacked identities.

Grouping remains heuristic. Collapsed, unloaded, inaccessible or rapidly recycled content can be missed; inspect coverage notes and full JSON. This is an unpacked test candidate, not a store release. Apache-2.0 is the project default; see the root LICENSING.md for the owner’s scoped additional 0BSD permission.
