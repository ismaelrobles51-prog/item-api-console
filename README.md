# FR8 Dispatch layout library

Static, endpoint-free presentation layouts transferred from the local TMS Proxy workspace.

## Published pages

- Main TMS Agent layout: `index.html`
- Layout browser: `layouts/index.html`
- TMS Agent copy: `layouts/tms-agent/index.html`
- YTD Analytics: `layouts/analytics-ytd/index.html`
- Dispatch and Local P&D: `layouts/dispatch/index.html`
- Module breakdown: `layouts/module-breakdown/index.html`

## Safety boundary

The published layouts contain only a small local navigation/theme script. They contain no API clients, proxy connections, authentication logic, actual credentials, external scripts, or live operational data. Historical backups, server files, environment files, logs, dependencies, and connected configuration were intentionally excluded.

The original React prototype remains under `src/` as an unserved development reference.
