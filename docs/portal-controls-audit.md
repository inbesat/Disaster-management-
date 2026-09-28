# SafeSphere portal controls audit — 28 September 2026

This pass covers inventory charts and controls, active navigation links, profile and AI preferences, the older advisor route, voice/text input controls, and printable SOS history. It does not certify that every feature in the application is free of defects.

## Changes

- Restored the inventory composition donut and availability bar chart. Charts share the filtered table data and refresh after changes instead of making a separate request that silently fails.
- Added a session-scoped, device-local inventory for demo sessions. Sample records initialize once; additions, changes, removals and movement logs survive page refreshes. Non-demo database errors remain visible.
- Fixed vehicle validation, optional-field clearing, movement coordinates at zero, invalid quantities, failed-save feedback and import refreshes. CSV import preserves status, units and depots, rejects invalid rows, and adds new records. Export downloads the filtered inventory with CSV formula escaping.
- Routed the older government resource screen to the shared inventory. Routed the older advisor screen to the working AI planner, replacing a reachable sample plan that claimed execution after a timer.
- Connected AI provider, detail and tone preferences to new requests. Only non-secret preferences leave browser storage. Added text attachments and speech input to the planner; unsupported speech input reports its limitation rather than inserting a canned emergency message.
- Fixed map expansion, notification navigation, context shortcuts, the landing Help link and language dropdown interaction. Static navigation checking found no missing destination pages; SOS navigation entries intentionally open a modal.
- Replaced profile save-only notifications with device-local save/discard, family contact controls and GPS updates. Fixed mobile settings layout. Organization planning preferences now persist; the low-stock threshold highlights inventory rows. Planning references do not grant access or trigger automatic dispatch.
- Replaced the SOS PDF placeholder with a printable report. Existing sample incidents are explicitly identified and are not represented as verified claim documentation.
- Made the development overlay opt-in so it cannot cover normal modal buttons. Updated the visible sidebar brand to SafeSphere.
- Fixed header overflow at smaller desktop widths, the government dashboard clock's server/browser mismatch, and SOS date formatting across locales. Restored saved planner history after mounting to avoid the same startup mismatch.

## Verification

- Unit suite: **171 files, 1,342 tests passed**. Demo guard fixtures were updated to create the same demo-session cookies as the existing login flow; no login implementation was changed.
- Local browser checks passed for inventory chart rendering, adding/editing/deleting stock, reload persistence, CSV validation/import/export, movement recording, zero coordinates, and mobile modal controls. Inventory fit a 390-pixel viewport without document-level horizontal overflow.
- Repeatable desktop/mobile checks: **8 passed**, covering four workflows on desktop Chromium and Pixel 5 emulation (`tests/portal-controls.spec.ts`). Inventory, profile/contacts/GPS/planning preferences, AI preferences/attachments/history, and printable SOS reports passed. The dashboard also opened with zero browser errors after the clock fix.
- Focused regression rerun after final edits: **3 files, 14 tests passed**.
- Production build: **passed** (`next build`, exit 0), including type validation and generation of 156 pages. Non-blocking warnings remain for Sentry's dynamic import, a 6.03 MB chunk excluded from offline precaching, unused symbols, image optimization, and a movement-panel effect dependency.

## Operational limits

- The configured database is unreachable. Cross-device inventory, persisted operational records, responder workflows dependent on that database, and real dispatch/delivery cannot be certified by this run. Demo inventory is stored on the current device for the current session; it is not shared with other users.
- Profile and planning preferences are also device-local. Shelter/escalation planning values and the responsibility worksheet do not automate alerts or change authentication.
- The browser AI checks use an intercepted response to verify controls and request payloads. They do not prove live provider availability, microphone hardware, or delivery to external recipients.
- Unused older mock UI components remain in source; the replaced resource and advisor routes no longer render them.
- Demo authentication is retained. Notion was left alone. No deployment or changes to the live Netlify site were performed.
