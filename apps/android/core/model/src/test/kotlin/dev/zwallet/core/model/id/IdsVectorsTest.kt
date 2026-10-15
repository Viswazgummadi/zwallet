// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.model.id

import dev.zwallet.core.model.Fixtures
import dev.zwallet.core.model.long
import dev.zwallet.core.model.obj
import dev.zwallet.core.model.str
import kotlinx.serialization.json.jsonArray
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** packages/contracts/fixtures/uuid.json (ADR 0010). */
class IdsVectorsTest {
    private val uuid = Fixtures.load("uuid.json")

    private fun section(name: String) = uuid.getValue(name).jsonArray.map { it.obj() }

    @TestFactory
    fun v8() =
        section("v8").map { c ->
            DynamicTest.dynamicTest("v8 '${c.str("name")}'") { assertEquals(c.str("uuid"), Ids.v8(c.str("name"))) }
        }

    @TestFactory
    fun v7() =
        section("v7").map { c ->
            DynamicTest.dynamicTest("v7 ${c.long("unix_ms")}") {
                val rand =
                    c
                        .str("rand_hex")
                        .chunked(2)
                        .map { it.toInt(16).toByte() }
                        .toByteArray()
                assertEquals(c.str("uuid"), Ids.v7(c.long("unix_ms"), rand))
            }
        }

    @TestFactory
    fun sms() =
        section("sms").map { c ->
            DynamicTest.dynamicTest("sms ${c.str("sender")} @${c.long("date_sent_s")}") {
                assertEquals(c.str("normalized_sender"), Ids.normalizeSender(c.str("sender")))
                assertEquals(c.str("normalized_body"), Ids.normalizeBody(c.str("body")))
                assertEquals(c.str("uuid"), Ids.smsId(c.str("sender"), c.str("body"), c.long("date_sent_s")))
            }
        }

    @TestFactory
    fun seeds() =
        section("seed").map { c ->
            DynamicTest.dynamicTest(
                "seed ${c.str("system_key")}",
            ) { assertEquals(c.str("uuid"), Ids.seedId(c.str("system_key"))) }
        }

    @Test
    fun `transaction tag and insight dismissal ids`() {
        section("transaction_tag").forEach {
            assertEquals(it.str("uuid"), Ids.transactionTagId(it.str("transaction_id"), it.str("tag_id")))
        }
        section("insight_dismissal").forEach {
            assertEquals(it.str("uuid"), Ids.insightDismissalId(it.str("rule_id"), it.str("subject_key")))
        }
    }

    @Test
    fun `newV7 is a version-7 RFC 9562 uuid and sorts by time`() {
        val a = Ids.newV7(1_760_000_000_000)
        val b = Ids.newV7(1_760_000_000_001)
        assertTrue(Regex("^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$").matches(a))
        assertTrue(a < b)
    }
}
