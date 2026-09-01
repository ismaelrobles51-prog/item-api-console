# Imported HTML references (offline-only)

These three user-supplied HTML snapshots are retained as **static source references** only. They are not bundled or executed by FR8 Dispatch. All `<script>` blocks, external resource links, and remote endpoint attributes were removed during import, so the references cannot make API/network calls.

| Source | Offline copy | Script blocks removed | External links removed | Source fingerprint |
|---|---|---:|---:|---|
| `tms-agent.html` | `tms-agent.static.html` | 4 | 1 | `302b234c9d2f` |
| `tms-agent-backup.html` | `tms-agent-backup.static.html` | 3 | 1 | `9d727662a139` |
| `tms-agent.before-adv-carrier-cost.html` | `tms-agent.before-adv-carrier-cost.static.html` | 3 | 1 | `80233243442a` |

The snapshots are intentionally versioned separately: no files are imported into `src/`, avoiding duplicate application views/components. The dashboard uses only its existing local sample-data module.
