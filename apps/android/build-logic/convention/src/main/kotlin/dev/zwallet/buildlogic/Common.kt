// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.buildlogic

import org.gradle.api.JavaVersion
import org.gradle.api.Project
import org.gradle.api.artifacts.VersionCatalog
import org.gradle.api.artifacts.VersionCatalogsExtension
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.withType
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.tasks.KotlinCompilationTask
import org.jlleitschuh.gradle.ktlint.KtlintExtension
import java.io.File

val Project.libs: VersionCatalog
    get() = extensions.getByType<VersionCatalogsExtension>().named("libs")

fun VersionCatalog.version(alias: String): String = findVersion(alias).get().requiredVersion

fun VersionCatalog.lib(alias: String): Any = findLibrary(alias).get().get()

val JAVA_VERSION: JavaVersion = JavaVersion.VERSION_17
val JVM_TARGET: JvmTarget = JvmTarget.JVM_17

/** Repo root (apps/android/../..). Tests read packages/contracts fixtures from here. */
val Project.repoRoot: File
    get() = rootProject.rootDir.resolve("../..").canonicalFile

internal fun Project.configureKotlin() {
    tasks.withType<KotlinCompilationTask<*>>().configureEach {
        compilerOptions {
            if (this is org.jetbrains.kotlin.gradle.dsl.KotlinJvmCompilerOptions) jvmTarget.set(JVM_TARGET)
            allWarningsAsErrors.set(true)
            freeCompilerArgs.add("-Xjsr305=strict")
        }
    }
}

internal fun Project.configureKtlint() {
    pluginManager.apply("org.jlleitschuh.gradle.ktlint")
    extensions.configure<KtlintExtension> {
        version.set(libs.version("ktlint"))
        android.set(true)
        filter {
            // Generated from packages/contracts and packages/design-tokens; checked by their own --check gates.
            exclude {
                it.file.path
                    .replace('\\', '/')
                    .contains("/generated/")
            }
            exclude {
                it.file.path
                    .replace('\\', '/')
                    .contains("/build/")
            }
        }
    }
}

/** Shared fixtures (packages/contracts) are visible to every JVM/Robolectric test. */
internal fun Project.configureTests() {
    tasks.withType<Test>().configureEach {
        systemProperty("zwallet.repoRoot", repoRoot.path)
        inputs.dir(repoRoot.resolve("packages/contracts/fixtures")).withPropertyName("contractFixtures").optional()
    }
}
