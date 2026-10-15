// SPDX-License-Identifier: GPL-3.0-only
import com.android.build.api.dsl.LibraryExtension
import dev.zwallet.buildlogic.JAVA_VERSION
import dev.zwallet.buildlogic.configureKotlin
import dev.zwallet.buildlogic.configureKtlint
import dev.zwallet.buildlogic.configureTests
import dev.zwallet.buildlogic.libs
import dev.zwallet.buildlogic.version
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure

class AndroidLibraryConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) =
        with(target) {
            pluginManager.apply("com.android.library")
            extensions.configure<LibraryExtension> {
                compileSdk = libs.version("compileSdk").toInt()
                defaultConfig {
                    minSdk = libs.version("minSdk").toInt()
                    consumerProguardFiles("consumer-rules.pro")
                }
                compileOptions {
                    sourceCompatibility = JAVA_VERSION
                    targetCompatibility = JAVA_VERSION
                }
                testOptions {
                    unitTests.isIncludeAndroidResources = true
                }
                lint {
                    warningsAsErrors = false
                    abortOnError = true
                }
            }
            configureKotlin()
            configureKtlint()
            configureTests()
        }
}
