// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.buildlogic

import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.CacheableTask
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction

/**
 * zwallet has no network access, enforced by the OS: the merged manifest (app + every library)
 * must not request any of these (ADR 0012, ARCHITECTURE §8.1, AC-11.9).
 */
val FORBIDDEN_PERMISSIONS =
    listOf(
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.ACCESS_WIFI_STATE",
        "android.permission.CHANGE_NETWORK_STATE",
        "android.permission.CHANGE_WIFI_STATE",
    )

@CacheableTask
abstract class NoNetworkPermissionTask : DefaultTask() {
    @get:InputFile
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val mergedManifest: RegularFileProperty

    @get:OutputFile
    abstract val report: RegularFileProperty

    @TaskAction
    fun check() {
        val xml = mergedManifest.get().asFile.readText()
        val requested =
            Regex("""<uses-permission(?:-sdk-23)?\b[^>]*android:name\s*=\s*"([^"]+)"""")
                .findAll(xml)
                .map { it.groupValues[1] }
                .toSortedSet()
        val bad = requested.filter { it in FORBIDDEN_PERMISSIONS }
        report.get().asFile.writeText(
            "manifest: ${mergedManifest.get().asFile}\nrequested: ${requested.joinToString()}\nforbidden: ${bad.joinToString()}\n",
        )
        if (bad.isNotEmpty()) {
            throw GradleException(
                "Merged manifest requests network permissions: ${bad.joinToString()}. zwallet must have no network " +
                    "access (ADR 0012). Remove the dependency that adds it, or add tools:node=\"remove\".",
            )
        }
        logger.lifecycle(
            "No network permissions in ${mergedManifest.get().asFile.name} (${requested.size} permissions checked).",
        )
    }
}

@CacheableTask
abstract class ApkSizeTask : DefaultTask() {
    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.NAME_ONLY)
    abstract val apkDirectory: DirectoryProperty

    @get:Input
    abstract val maxBytes: Property<Long>

    @get:OutputFile
    abstract val report: RegularFileProperty

    @TaskAction
    fun check() {
        val apks =
            apkDirectory
                .get()
                .asFile
                .walk()
                .filter { it.isFile && it.extension == "apk" }
                .toList()
        if (apks.isEmpty()) throw GradleException("No APK found in ${apkDirectory.get().asFile}")
        val lines = apks.map { "${it.name}: ${it.length()} bytes" }
        report.get().asFile.writeText(lines.joinToString("\n", postfix = "\n"))
        val tooBig = apks.filter { it.length() > maxBytes.get() }
        if (tooBig.isNotEmpty()) {
            throw GradleException(
                "APK over budget (${maxBytes.get()} bytes): ${tooBig.joinToString { "${it.name}=${it.length()}" }}",
            )
        }
        lines.forEach { logger.lifecycle("APK size OK — $it (budget ${maxBytes.get()} bytes)") }
    }
}
