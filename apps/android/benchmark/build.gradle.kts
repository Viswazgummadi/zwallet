// SPDX-License-Identifier: GPL-3.0-only
// Macrobenchmarks (androidx.benchmark, Apache-2.0). Test-only: never shipped, never on :app's classpath.
// Baseline Profile generation is deliberately out of scope until M6.
plugins {
    id("zw.android.benchmark")
}

android {
    namespace = "dev.zwallet.benchmark"
}

dependencies {
    implementation(libs.androidx.benchmark.macro.junit4)
    implementation(libs.androidx.test.ext.junit)
    implementation(libs.androidx.test.uiautomator)
}
