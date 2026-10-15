// SPDX-License-Identifier: GPL-3.0-only
// Shared test helpers (Roborazzi screenshot matrix). Only ever a testImplementation dependency.
plugins {
    id("zw.android.library")
    id("zw.compose")
}

android {
    namespace = "dev.zwallet.core.testing"
}

dependencies {
    api(project(":core:designsystem"))
    api(platform(libs.androidx.compose.bom))
    api(libs.junit4)
    api(libs.robolectric)
    api(libs.roborazzi)
    api(libs.roborazzi.compose)
    api(libs.roborazzi.junit.rule)
    api(libs.androidx.compose.ui.test.junit4)
}
