// SPDX-License-Identifier: GPL-3.0-only
plugins {
    id("zw.android.application")
    id("zw.compose")
    id("zw.hilt")
    id("zw.screenshots")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "dev.zwallet.app"
}

dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:model"))
    implementation(project(":feature:home"))
    implementation(project(":feature:transactions"))
    implementation(project(":feature:insights"))
    implementation(project(":feature:people"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.compose.material3.adaptive.navigation.suite)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.kotlinx.serialization.json)
}
