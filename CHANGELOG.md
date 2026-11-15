# Changelog

## 1.0.0 — 2026-11-15

Initial Linis test copy, based on the prior extension's working-tree source. No Git history or remote has been created.

- Rename the extension, internal DOM markers, downloads, packaging paths, and JSON format marker to Linis; use version 1.0.0 consistently.
- Observe relevant attribute-only changes during capture and highlight validation, including ancestor and open-shadow contexts. Ignore Linis's own temporary marks.
- Check the entire serialized request against a 65,536-byte UTF-8 client limit before network transmission; distinguish it from the evidence batching heuristic.
- Report requested finish, automatic capture closure, user cancellation, and the overall extraction deadline distinctly in the UI and exports.
- Retain the current feed/body/quote attribution fixes and feed regression fixture.
- Add GitHub source checks and a pinned, read-only Windows/Linux CI workflow. Preserve licence-scope bytes across Git checkouts and make documentation links work in both source and runtime ZIPs.
- Add focused regressions; 66 offline tests pass. Fresh browser and live-provider certification remains outstanding.

Apache-2.0 is the project and contribution default. The owner’s identified code portions additionally offer Apache-2.0 OR 0BSD; third-party rights and contributor ownership are preserved. This is not a store release or a claim of complete capture on arbitrary sites.
