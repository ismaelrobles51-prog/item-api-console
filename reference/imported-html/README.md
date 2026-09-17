# Imported HTML references (offline-only)

These user-supplied HTML snapshots are retained as offline-safe source references. All `<script>` blocks, external resource links, and remote endpoint attributes were removed during import, so the references cannot make API/network calls.

The repository root `index.html` is generated from `tms-agent.static.html` and is the served, endpoint-free TMS Agent layout. The original `tms-agent.html` is retained only as the supplied source file and is not loaded by the application.

| Source | Offline copy | Script blocks removed | External links removed | Source fingerprint |
|---|---|---:|---:|---|
| `tms-agent.html` | `tms-agent.static.html` | 4 | 1 | `302b234c9d2f` |
| `tms-agent-backup.html` | `tms-agent-backup.static.html` | 3 | 1 | `9d727662a139` |
| `tms-agent.before-adv-carrier-cost.html` | `tms-agent.before-adv-carrier-cost.static.html` | 3 | 1 | `80233243442a` |

| `tms-agent.before-auth-empty-detection-20260603-151250.html` | `tms-agent.before-auth-empty-detection-20260603-151250.static.html` | 3 | 1 | `1044d06167ec` |

The legacy React prototype remains in `src/` for reference, but it is not loaded by the endpoint-free static entry page.
