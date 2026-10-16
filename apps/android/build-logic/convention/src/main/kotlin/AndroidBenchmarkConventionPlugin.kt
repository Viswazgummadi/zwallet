// SPDX-License-Identifier: GPL-3.0-only
import com.android.build.api.dsl.TestExtension
import com.android.build.api.variant.TestAndroidComponentsExtension
import dev.zwallet.buildlogic.JAVA_VERSION
import dev.zwallet.buildlogic.configureKotlin
import dev.zwallet.buildlogic.configureKtlint
import dev.zwallet.buildlogic.libs
import dev.zwallet.buildlogic.version
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import java.util.Properties

/**
 * Macrobenchmark module (`com.android.test`) that measures the `benchmark` build type of :app
 * (release-like, debug-signed, not debuggable). Test-only: it is never part of a shipped APK.
 * Running it needs a device: `./gradlew :benchmark:connectedBenchmarkAndroidTest`.
 */
class AndroidBenchmarkConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) =
        with(target) {
            pluginManager.apply("com.android.test")

            val targetPackage =
                Properties()
                    .apply {
                        val text =
                            providers
                                .fileContents(rootProject.layout.projectDirectory.file("branding.properties"))
                                .asText
                        load(text.get().reader())
                    }.getProperty("applicationId")

            extensions.configure<TestExtension> {
                compileSdk = libs.version("compileSdk").toInt()
                defaultConfig {
                    minSdk = libs.version("minSdk").toInt()
                    targetSdk = libs.version("targetSdk").toInt()
                    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
                }
                compileOptions {
                    sourceCompatibility = JAVA_VERSION
                    targetCompatibility = JAVA_VERSION
                }
                buildFeatures {
                    buildConfig = true
                }
                buildTypes {
                    create("benchmark") {
                        isDebuggable = true
                        signingConfig = signingConfigs.getByName("debug")
                        matchingFallbacks += "release"
                        buildConfigField("String", "TARGET_PACKAGE", "\"$targetPackage\"")
                    }
                }
                targetProjectPath = ":app"
                experimentalProperties["android.experimental.self-instrumenting"] = true
            }
            // Only the benchmark variant is meaningful (it targets :app's benchmark build type).
            extensions.configure<TestAndroidComponentsExtension> {
                beforeVariants(selector().all()) { it.enable = it.buildType == "benchmark" }
            }
            configureKotlin()
            configureKtlint()
        }
}
