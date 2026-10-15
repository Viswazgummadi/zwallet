// SPDX-License-Identifier: GPL-3.0-only
plugins {
    id("zw.android.library")
    id("zw.compose")
    id("zw.screenshots")
}

android {
    namespace = "dev.zwallet.core.designsystem"
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    api(libs.androidx.compose.material3)
    api(libs.androidx.compose.ui.text)
    implementation(libs.androidx.compose.animation.core)
}
