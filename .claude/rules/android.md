---
paths:
  - "apps/android/**"
---

# Android rules

- Architecture: Compose screen ← `UiState` (immutable, `@Immutable`) via `StateFlow` ← ViewModel ←
  use cases ← repositories ← Room / SyncEngine. No business logic in composables.
- Modules per `docs/ARCHITECTURE.md §3`. `core:model` and `core:smsparser` are pure Kotlin
  (no `android.*` imports). Features depend on core, never on each other.
- Room: every query that feeds UI returns `Flow`; writes in `withTransaction`; never on main.
  Schema export on; every version bump ships a `Migration` + `MigrationTestHelper` test.
- Every write that syncs sets `hlc = Hlc.now()` and `dirty = 1` in the same transaction.
- Background: WorkManager only (constraints per ARCH §5.3). No `AlarmManager.setExact`, no
  wakelocks, no foreground services except the user-initiated SMS import worker.
- Compose perf: stable keys + `contentType` in lazy lists, `remember`/`derivedStateOf` for
  derived values, no allocations in draw lambdas, use `Modifier.drawWithCache` for charts.
- Theme only through `ZwTheme` tokens (generated). Strings in `strings.xml` (plurals for counts).
- Logging via `ZwLog` which redacts; never log amounts, VPAs, names, or SMS text.
- Tests: JUnit5 + Turbine + Truth for VMs/repos; Roborazzi screenshot per screen state;
  instrumented tests only when Robolectric can't cover it.
- After UI changes: build, install, `adb exec-out screencap -p`, Read the image, compare with
  `docs/DESIGN.md` §5 for that screen.
