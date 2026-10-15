// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.model

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import java.io.File

/** Shared cross-platform vectors in packages/contracts/fixtures (path injected by build-logic). */
object Fixtures {
    private val root = File(requireNotNull(System.getProperty("zwallet.repoRoot")) { "zwallet.repoRoot not set" })

    fun load(name: String): JsonObject =
        Json.parseToJsonElement(root.resolve("packages/contracts/fixtures/$name").readText()).let {
            it as JsonObject
        }
}

fun JsonObject.str(key: String): String = getValue(key).jsonPrimitive.content

fun JsonObject.strOrNull(key: String): String? = (get(key) as? JsonPrimitive)?.takeIf { it.isString }?.content

fun JsonObject.long(key: String): Long = getValue(key).jsonPrimitive.long

fun JsonElement.obj(): JsonObject = this as JsonObject
