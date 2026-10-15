// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.model.hlc

import dev.zwallet.core.model.Fixtures
import dev.zwallet.core.model.long
import dev.zwallet.core.model.obj
import dev.zwallet.core.model.str
import io.kotest.property.Arb
import io.kotest.property.arbitrary.list
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** packages/contracts/fixtures/hlc.json */
class HlcVectorsTest {
    private val hlc = Fixtures.load("hlc.json")

    @TestFactory
    fun parse() =
        hlc.getValue("parse").jsonArray.map { it.obj() }.map { c ->
            DynamicTest.dynamicTest("parse '${c.str("text")}'") {
                val parsed = Hlc.parse(c.str("text"))
                if ("error" in c) {
                    assertNull(parsed)
                } else {
                    assertEquals(Hlc(c.long("wall"), c.long("counter").toInt(), c.str("node")), parsed)
                    assertEquals(c.str("text"), parsed.toString())
                }
            }
        }

    @Test
    fun `object order equals text order`() {
        val texts = hlc.getValue("order").jsonArray.map { it.jsonPrimitive.content }
        assertEquals(texts, texts.map { Hlc.parse(it)!! }.sorted().map { it.toString() })
        assertEquals(texts, texts.sorted())
    }

    @TestFactory
    fun clock() =
        hlc.getValue("clock").jsonArray.map { it.obj() }.map { c ->
            DynamicTest.dynamicTest(c.str("name")) {
                var phys = 0L
                val last = c.str("last").takeIf { it.isNotEmpty() }?.let { Hlc.parse(it)!! }
                val clock = HlcClock(c.str("node"), last) { phys }
                for (step in c.getValue("steps").jsonArray.map { it.obj() }) {
                    when (step.str("op")) {
                        "now" -> {
                            phys = step.long("phys")
                            assertEquals(step.str("expect"), clock.now().toString())
                        }

                        "receive" -> {
                            clock.receive(Hlc.parse(step.str("hlc"))!!)
                            assertEquals(step.str("expect_last"), clock.last.toString())
                        }

                        else -> {
                            error("unknown op")
                        }
                    }
                }
            }
        }

    @Test
    fun `now() is strictly monotonic whatever the wall clock does (property)`(): Unit =
        runBlocking {
            checkAll(500, Arb.list(Arb.long(0L..5_000L), 1..200)) { walls ->
                var i = 0
                val clock = HlcClock("0a1b2c3d", null) { walls[i] }
                var prev: Hlc? = null
                for (k in walls.indices) {
                    i = k
                    val next = clock.now()
                    prev?.let { assertTrue(next > it && next.toString() > it.toString()) }
                    prev = next
                }
            }
        }
}
