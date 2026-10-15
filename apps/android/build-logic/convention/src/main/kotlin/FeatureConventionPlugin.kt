// SPDX-License-Identifier: GPL-3.0-only
import dev.zwallet.buildlogic.lib
import dev.zwallet.buildlogic.libs
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.dependencies
import org.gradle.kotlin.dsl.project

/** A feature module: Compose UI on core:designsystem. Features never depend on each other. */
class FeatureConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) =
        with(target) {
            pluginManager.apply("zw.android.library")
            pluginManager.apply("zw.compose")
            pluginManager.apply("zw.screenshots")
            dependencies {
                add("implementation", project(":core:designsystem"))
                add("implementation", project(":core:model"))
                add("implementation", libs.lib("androidx-lifecycle-runtime-compose"))
                add("implementation", libs.lib("androidx-lifecycle-viewmodel-compose"))
            }
        }
}
