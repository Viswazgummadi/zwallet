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
    val shortHome = windowsShortHome()
    // Robolectric test JVMs in different modules race on ~/.robolectric-download-lock (fails on
    // Windows); one Robolectric test task at a time across the build. Pure JVM tests stay parallel.
    val robolectric =
        gradle.sharedServices.registerIfAbsent("robolectricSerial", RobolectricSerialService::class.java) {
            maxParallelUsages.set(1)
        }
    tasks.withType<Test>().configureEach {
        if (name.endsWith("UnitTest")) usesService(robolectric)
        systemProperty("zwallet.repoRoot", repoRoot.path)
        inputs.dir(repoRoot.resolve("packages/contracts/fixtures")).withPropertyName("contractFixtures").optional()
        // Robolectric URL-encodes a space in user.home ("G%20Viswaz") and then can't open its own
        // android-all jar from ~/.m2. Give test JVMs the 8.3 short form of the same directory.
        if (shortHome != null) systemProperty("user.home", shortHome)
        // Robolectric 4.17 reaches into FileDescriptor internals (JDK 21+ hides them by default).
        jvmArgs("--add-exports=java.base/jdk.internal.access=ALL-UNNAMED", "--add-opens=java.base/java.io=ALL-UNNAMED")
    }
}

/**
 * On Windows with a space in the home path, the same directory's 8.3 short name (taken from
 * %TEMP%, which Windows keeps in short form, and verified to be the same directory). Null
 * elsewhere, so Linux CI is unaffected.
 */
private fun Project.windowsShortHome(): String? {
    val home = System.getProperty("user.home") ?: return null
    if (!System.getProperty("os.name").orEmpty().startsWith("Windows") || ' ' !in home) return null
    val temp = providers.environmentVariable("TEMP").orNull ?: return null
    val candidate = File(temp).parentFile?.parentFile?.parentFile ?: return null // ...\AppData\Local\Temp
    if (' ' in candidate.path || candidate.canonicalPath != File(home).canonicalPath) return null
    return candidate.path
}

/** Marker build service used only to limit concurrency (see configureTests). */
abstract class RobolectricSerialService :
    org.gradle.api.services.BuildService<org.gradle.api.services.BuildServiceParameters.None>
