# Security Policy

## Supported versions

Only the latest version on `main` (and the live app) receives security fixes.

## Report a vulnerability

Please do **not** open a public issue for security problems.

Use GitHub's private reporting instead: go to the [Security tab](https://github.com/ErwannRobin/bg-eraser/security/advisories/new) of this repository and click "Report a vulnerability".

Please include:

- a description of the problem and its impact,
- steps to reproduce,
- your browser and OS, if relevant.

This is a small project maintained in spare time. We will try to reply within a few days, but we cannot promise a fixed response time.

## Scope

BG Eraser runs fully in the browser and has no backend. Relevant issues include, for example, a way for images to leave the user's device, cross-site scripting, or a vulnerable dependency that is actually exploitable in the app.

Vulnerabilities in third-party services or models (for example Hugging Face or the BRIA RMBG-1.4 model) should be reported to their owners.
