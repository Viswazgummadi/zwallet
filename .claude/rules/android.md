---
paths:
  - "apps/android/**"
---

# Android rules

- Architecture: Compose screen ← `UiState` (immutable, `@Immutable`) via `StateFlow` ← ViewModel ←
  use cases ← repositories ← Room. No business logic in composables.
- Modules per `docs/ARCHITECTURE.md §3`. `core:model` and `core:smsparser` are pure Kotlin
  (no `android.*` imports). Features depend on core, never on each other.
- Room: every query that feeds UI returns `Flow`; writes in `withTransaction`; never on main.
  Schema export on; every version bump ships a `Migration` + `MigrationTestHelper` test.
- Every user-data write stamps a fresh HLC on each merge group it touches (`field_hlc`) and sets
  `hlc` to their max, in the same transaction (ADR 0009).
- **No network:** never add `INTERNET`/`ACCESS_NETWORK_STATE`, HTTP clients, or libraries that
  pull them in; `:app:checkNoNetworkPermission` must pass. Files go through SAF pickers only.
- Background: WorkManager only (reminders, user-started SMS import). No periodic jobs, no
  `AlarmManager.setExact`, no wakelocks, no foreground services except the SMS import worker.
- Compose perf: stable keys + `contentType` in lazy lists, `remember`/`derivedStateOf` for
  derived values, no allocations in draw lambdas, use `Modifier.drawWithCache` for charts.
- Theme only through `ZwTheme` tokens (generated). Strings in `strings.xml` (plurals for counts).
- Logging via `ZwLog` which redacts; never log amounts, VPAs, names, or SMS text.
- Tests: JUnit5 + Turbine + Truth for VMs/repos; Roborazzi screenshot per screen state;
  instrumented tests only when Robolectric can't cover it.
- After UI changes: build, install, `adb exec-out screencap -p`, Read the image, compare with
  `docs/DESIGN.md` §5 for that screen.
