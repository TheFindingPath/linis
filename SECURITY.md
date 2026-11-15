# Security

Linis 1.0.0 is a test candidate. For a GitHub-hosted copy, use the repository’s Security → Advisories → Report a vulnerability option when private vulnerability reporting is enabled. This folder has not been connected to a repository, so that channel is not configured yet. The maintainer should enable it on the public repository before announcing a supported public release. No response-time or ongoing security-support commitment is promised. Do not put API keys, private page text, browsing captures, or account information in a public issue.

If you suspect a leak, stop using the affected capture, revoke any exposed provider credential with that provider, and preserve a minimal synthetic reproduction. Share sensitive details only through a maintainer-confirmed private route once available.

The extension uses user-activated page access and fixed provider HTTPS endpoints. It rejects redirects, validates typed model decisions, stores keys only in trusted local extension storage, and renders page evidence as text. Those controls do not make arbitrary page content safe to disclose to an external provider. See [PRIVACY.md](PRIVACY.md).

Fresh real-browser and live-provider verification of this Linis candidate remains outstanding.
