// SPDX-License-Identifier: GPL-3.0-only
plugins {
    `kotlin-dsl`
}

group = "dev.zwallet.buildlogic"

kotlin {
    jvmToolchain(21)
}

dependencies {
    // Every plugin the conventions apply by id, on one classpath.
    implementation(libs.android.gradle.plugin)
    implementation(libs.kotlin.gradle.plugin)
    implementation(libs.compose.compiler.gradle.plugin)
    implementation(libs.kotlin.serialization.gradle.plugin)
    implementation(libs.ksp.gradle.plugin)
    implementation(libs.hilt.gradle.plugin)
    implementation(libs.roborazzi.gradle.plugin)
    implementation(libs.ktlint.gradle.plugin)
}

gradlePlugin {
    plugins {
        register("androidApplication") {
            id = "zw.android.application"
            implementationClass = "AndroidApplicationConventionPlugin"
        }
        register("androidBenchmark") {
            id = "zw.android.benchmark"
            implementationClass = "AndroidBenchmarkConventionPlugin"
        }
        register("androidLibrary") {
            id = "zw.android.library"
            implementationClass = "AndroidLibraryConventionPlugin"
        }
        register("compose") {
            id = "zw.compose"
            implementationClass = "ComposeConventionPlugin"
        }
        register("jvmLibrary") {
            id = "zw.jvm.library"
            implementationClass = "JvmLibraryConventionPlugin"
        }
        register("hilt") {
            id = "zw.hilt"
            implementationClass = "HiltConventionPlugin"
        }
        register("feature") {
            id = "zw.feature"
            implementationClass = "FeatureConventionPlugin"
        }
        register("screenshots") {
            id = "zw.screenshots"
            implementationClass = "ScreenshotConventionPlugin"
        }
    }
}
