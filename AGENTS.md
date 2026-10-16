# Architecture rules
- Keep Search Console ownership verification in the static root HTML and its sitemap in public assets so Google can read both without client-side execution.
- Search Console integration is managed through the workspace connector; keep image processing entirely local and do not add runtime Google calls or a backend for site verification.