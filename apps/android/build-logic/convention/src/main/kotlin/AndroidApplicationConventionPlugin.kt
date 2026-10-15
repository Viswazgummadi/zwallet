// SPDX-License-Identifier: GPL-3.0-only
import com.android.build.api.artifact.SingleArtifact
import com.android.build.api.dsl.ApplicationExtension
import com.android.build.api.variant.ApplicationAndroidComponentsExtension
import dev.zwallet.buildlogic.ApkSizeTask
import dev.zwallet.buildlogic.JAVA_VERSION
import dev.zwallet.buildlogic.NoNetworkPermissionTask
import dev.zwallet.buildlogic.configureKotlin
import dev.zwallet.buildlogic.configureKtlint
import dev.zwallet.buildlogic.configureTests
import dev.zwallet.buildlogic.libs
import dev.zwallet.buildlogic.version
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.register
import java.util.Properties

/** APK budget per ABI (ARCHITECTURE §9). */
private const val MAX_APK_BYTES = 12L * 1024 * 1024

class AndroidApplicationConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) =
        with(target) {
            pluginManager.apply("com.android.application")

            // branding.properties: the one file a fork edits (ADR 0014).
            val branding =
                Properties().apply {
                    val text =
                        providers
                            .fileContents(
                                rootProject.layout.projectDirectory.file("branding.properties"),
                            ).asText
                    load(text.get().reader())
                }

            extensions.configure<ApplicationExtension> {
                compileSdk = libs.version("compileSdk").toInt()
                defaultConfig {
                    applicationId = branding.getProperty("applicationId")
                    minSdk = libs.version("minSdk").toInt()
                    targetSdk = libs.version("targetSdk").toInt()
                    versionCode = 1
                    versionName = "0.1.0"
                    resValue("string", "app_name", branding.getProperty("appName"))
                }
                buildFeatures {
                    resValues = true
                    buildConfig = true
                }
                compileOptions {
                    sourceCompatibility = JAVA_VERSION
                    targetCompatibility = JAVA_VERSION
                }
                buildTypes {
                    getByName("release") {
                        isMinifyEnabled = true
                        isShrinkResources = true
                        proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
                    }
                }
                packaging {
                    resources.excludes += setOf("/META-INF/{AL2.0,LGPL2.1}", "/META-INF/LICENSE*", "DebugProbesKt.bin")
                }
                testOptions {
                    unitTests.isIncludeAndroidResources = true
                }
                lint {
                    abortOnError = true
                }
            }
            configureKotlin()
            configureKtlint()
            configureTests()

            val checkNetwork =
                tasks.register("checkNoNetworkPermission") {
                    group = "verification"
                    description = "Fails if any merged manifest requests a network permission (ADR 0012, AC-11.9)."
                }
            val checkSize =
                tasks.register("checkApkSize") {
                    group = "verification"
                    description = "Fails if a release APK exceeds the ARCHITECTURE §9 budget."
                }
            extensions.configure<ApplicationAndroidComponentsExtension> {
                onVariants { variant ->
                    val name = variant.name.replaceFirstChar { it.uppercase() }
                    val perVariant =
                        tasks.register<NoNetworkPermissionTask>("check${name}NoNetworkPermission") {
                            mergedManifest.set(variant.artifacts.get(SingleArtifact.MERGED_MANIFEST))
                            report.set(layout.buildDirectory.file("reports/no-network/${variant.name}.txt"))
                        }
                    checkNetwork.configure { dependsOn(perVariant) }
                    if (variant.buildType == "release") {
                        val size =
                            tasks.register<ApkSizeTask>("check${name}ApkSize") {
                                apkDirectory.set(variant.artifacts.get(SingleArtifact.APK))
                                maxBytes.set(MAX_APK_BYTES)
                                report.set(layout.buildDirectory.file("reports/apk-size/${variant.name}.txt"))
                            }
                        checkSize.configure { dependsOn(size) }
                    }
                }
            }
        }
}
