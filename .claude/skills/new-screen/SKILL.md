---
name: new-screen
description: Build a new zwallet screen (Android and/or web) exactly per DESIGN.md with all states and screenshot tests.
argument-hint: "<screen name> [android|web|both]"
---

Build the screen: $ARGUMENTS

1. Find its spec in `docs/DESIGN.md` (§5 Android / §6 web) and the related ACs in `docs/SPEC.md`.
   Quote the layout order and components you will use. If the spec is missing or ambiguous,
   stop and ask.
2. Define `UiState` (Android) / view-model hook (web) covering: loading, empty, error, offline,
   populated, and edge content (very long names, huge amounts ₹12,34,56,789.00, 0 items, 10k items).
3. Build from existing design-system components first; add new components to the design system
   (not inline) with their own previews/stories.
4. Wire navigation, back behavior, deep links, and (web) keyboard shortcuts.
5. Tests: screenshot tests for every state × light/dark × font 1.0/2.0 (Android) or light/dark ×
   1440/390 widths (web); interaction tests for primary actions.
6. Verify on device/browser with a real screenshot and compare to the spec; fix deviations.
7. Run the design QA checklist (`docs/DESIGN.md §9`) and report it ticked with evidence.
