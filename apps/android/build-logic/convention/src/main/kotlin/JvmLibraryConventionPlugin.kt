// SPDX-License-Identifier: GPL-3.0-only
import dev.zwallet.buildlogic.JAVA_VERSION
import dev.zwallet.buildlogic.configureKotlin
import dev.zwallet.buildlogic.configureKtlint
import dev.zwallet.buildlogic.configureTests
import dev.zwallet.buildlogic.lib
import dev.zwallet.buildlogic.libs
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.JavaPluginExtension
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.withType

/** Pure Kotlin/JVM module (no android.*): core:model, core:transfer, later core:smsparser. */
class JvmLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) =
        with(target) {
            pluginManager.apply("org.jetbrains.kotlin.jvm")
            pluginManager.apply("java-library")
            extensions.configure<JavaPluginExtension> {
                sourceCompatibility = JAVA_VERSION
                targetCompatibility = JAVA_VERSION
            }
            configureKotlin()
            configureKtlint()
            configureTests()
            tasks.withType<Test>().configureEach { useJUnitPlatform() }
            dependencies {
                add("testImplementation", platform(libs.lib("junit-bom")))
                add("testImplementation", libs.lib("junit-jupiter"))
                add("testImplementation", libs.lib("kotest-property"))
                add("testImplementation", libs.lib("kotlinx-serialization-json"))
                add("testRuntimeOnly", libs.lib("junit-platform-launcher"))
            }
        }
}
