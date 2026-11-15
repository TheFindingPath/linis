# Ownership and additional-permission register

## Current code baseline

On 15 November 2026, the project owner stated that, to their knowledge, nobody else had contributed code and development had used ChatGPT and Opus outputs from their accounts. The owner instructed that their own code be available under Apache-2.0 OR 0BSD. This register records that declaration; it does not assert that account use proves exclusive copyright ownership or copyrightability.

The exact current code snapshots are enumerated by path and SHA-256 in [licensing/owner-code.json](licensing/owner-code.json) (21 files). The scope comprises the listed extension JavaScript, CSS and HTML, test scripts and synthetic HTML fixture, and development/packaging scripts, including the original source-audit script. For the owner's copyright interests in those snapshots, recipients may choose **Apache-2.0 OR 0BSD**. Do not read the inventory as a blanket 0BSD grant over someone else's rights.

The hashes identify the code as it existed when this grant was recorded. They do not automatically cover later edits at the same paths. Subsequent contributions retain their authors' ownership and default to Apache-2.0; record explicit additional permission separately. For a mixed file, keep the baseline owner's rights distinguishable from each new contributor's work rather than changing a whole-file licence label.

The packaging script was subsequently revised for this local release at the owner’s request in the same AI-assisted session. Its inventory entry records the updated snapshot and preserves its prior hash; no new third-party code or other human contribution was introduced. This scoped update does not change incoming contribution terms.

## Inspection and exclusions

- The initial Linis copy was prepared without Git history. The earlier source repository was inspected read-only for authorship clues and licence records. It records more than one author identity, which does not establish multiple copyright owners and does not override the owner's declaration. No personal history values were copied here.
- No existing project LICENSE/NOTICE grant or third-party copyright/SPDX source headers were found in the inspected extension, tests or scripts; the only root licence file was a placeholder. Absence of a notice is not proof of ownership.
- The development lockfile retains third-party Apache-2.0, MIT, ISC and BSD-3-Clause licence metadata. Dependencies are excluded from the owner grant. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Documentation, configuration/metadata files, lockfiles and all images (including the generated purple logo and earlier icons) are outside the additional 0BSD code inventory. Original project material defaults to Apache-2.0 only to the extent the relevant rights holder has authorized it; third-party terms remain unchanged.

## Ownership questions flagged for review

1. **AI-output rights:** provider output assignments operate only within their terms and to the extent rights exist. Copyrightability, any applicable employer/account arrangements, and any rights belonging to others are not independently determined by this register. Do not treat the providers or model names as human coauthors merely because tools generated code.
2. **Possible third-party material:** no external code was identified by existing notices in the project source, but that is not a similarity audit. If a copied or adapted portion is discovered, retain its original terms, identify it precisely, and correct the scope record; the owner's 0BSD grant never covers rights belonging to that third party.
3. **Future mixed ownership:** preserve who contributed which code, applicable terms and explicit consent before expanding any dual-licensed scope. Until resolved, do not claim uncertain portions are available under 0BSD. This policy cannot retroactively license material that a third party has not authorized for distribution.
4. **Artwork:** the purple logo is recorded as AI-generated. Its copyrightability/provenance is not certified and no additional 0BSD claim is made for it or any other image.

This register is a provenance and permission record, not a warranty of title. See [LICENSING.md](LICENSING.md) for the actual scope rules.
