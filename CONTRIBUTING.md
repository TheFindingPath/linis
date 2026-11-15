# Contributing to Linis

The default contribution licence is Apache License 2.0. Read the ownership and incoming terms below before submitting changes.

Keep changes focused and include meaningful regressions for capture privacy, source attribution, request boundaries, and lifecycle behavior. Run from the root:

```sh
node --test browsers/brave/tests/*.test.mjs
node scripts/check-source.mjs
```

Use synthetic fixtures. Never commit provider keys, browser profiles, captures, screenshots of personal pages, downloads, local settings, generated releases, or internal development records. The runtime extension should remain loadable directly without a build or local service.

For optional browser tests and their artifact output, see [TESTING.md](browsers/brave/TESTING.md). Do not describe mocked transport checks as live-provider verification.

## Ownership and incoming terms

You retain copyright ownership of your work. By intentionally submitting a contribution for inclusion, you license it under Apache License 2.0 unless you explicitly state otherwise and different terms are explicitly agreed for that identified contribution. You do not assign copyright to the maintainer, and you do not grant 0BSD permission merely by contributing. See [LICENSE](LICENSE) for the full Apache terms, including section 5.

The project owner's additional 0BSD grant covers only their own copyright interests in the code snapshots identified by [OWNERSHIP.md](OWNERSHIP.md) and [licensing/owner-code.json](licensing/owner-code.json). It does not extend to your work. You may separately opt in to Apache-2.0 OR 0BSD for a specifically identified contribution, but only through an explicit recorded agreement from the rights holder; it is never assumed.

When editing a file with owner-baseline code, preserve the existing portions' terms and identify the new contribution's terms. Do not apply a whole-file 0BSD or Apache-2.0 OR 0BSD label if it would cover someone else's Apache-only code. Keep provenance by identifiable hunks, regions, or separately named files, plus a contribution record. Do not refresh an owner-baseline hash to include other people's changes. If ownership is uncertain, flag the affected portion for review rather than expanding the grant.

Disclose copied or adapted third-party code, its source, and its licence. Preserve required copyright, licence, modification and NOTICE statements. Do not present generated output as proof of exclusive ownership: use AI tools only where you have the rights needed to contribute, check applicable account/provider terms, and disclose known third-party material. No contributor has to transfer ownership or accept the owner's optional 0BSD arrangement.

Read [LICENSING.md](LICENSING.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) before adding external material.
