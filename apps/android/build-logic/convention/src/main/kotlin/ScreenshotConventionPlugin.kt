// SPDX-License-Identifier: GPL-3.0-only
import dev.zwallet.buildlogic.lib
import dev.zwallet.buildlogic.libs
import io.github.takahirom.roborazzi.RoborazziExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.project

/**
 * Roborazzi screenshot tests on Robolectric (DESIGN §9: every state × light/dark × font 1.0/2.0).
 * Golden images are committed under src/test/screenshots; `verifyRoborazziDebug` diffs them,
 * `recordRoborazziDebug` updates them.
 */
class ScreenshotConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) =
        with(target) {
            pluginManager.apply("io.github.takahirom.roborazzi")
            extensions.configure<RoborazziExtension> {
                outputDir.set(layout.projectDirectory.dir("src/test/screenshots"))
            }
            dependencies {
                add("testImplementation", project(":core:testing"))
                add("testImplementation", libs.lib("junit4"))
                add("testImplementation", libs.lib("robolectric"))
                add("testImplementation", libs.lib("roborazzi"))
                add("testImplementation", libs.lib("roborazzi-compose"))
                add("testImplementation", libs.lib("roborazzi-junit-rule"))
                add("testImplementation", libs.lib("androidx-compose-ui-test-junit4"))
                add("debugImplementation", libs.lib("androidx-compose-ui-test-manifest"))
            }
        }
}
