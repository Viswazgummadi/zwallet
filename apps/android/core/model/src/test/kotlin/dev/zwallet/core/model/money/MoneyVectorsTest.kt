// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.model.money

import dev.zwallet.core.model.Fixtures
import dev.zwallet.core.model.long
import dev.zwallet.core.model.obj
import dev.zwallet.core.model.str
import io.kotest.property.Arb
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** packages/contracts/fixtures/money.json — the web app runs the same vectors. */
class MoneyVectorsTest {
    private val money = Fixtures.load("money.json")

    private fun cases(section: String) =
        money
            .getValue(section)
            .obj()
            .getValue("cases")
            .jsonArray
            .map { it.obj() }

    private fun expected(c: JsonObject): MoneyResult<Long> =
        if ("error" in
            c
        ) {
            MoneyResult.Err(MoneyError.entries.single { it.code == c.str("error") })
        } else {
            MoneyResult.Ok(c.long("minor"))
        }

    private fun currency(c: JsonObject) = Currency.of(c.str("currency"))

    @Test
    fun `MAX_MINOR matches the shared limit`() {
        assertEquals(money.long("max_minor"), Money.MAX_MINOR)
    }

    @Test
    fun `currency table equals the shared table exactly`() {
        val shared =
            money
                .getValue("currencies")
                .obj()
                .filterKeys { it != "description" }
                .mapValues { (_, v) ->
                    val c = v.obj()
                    Triple(
                        c.getValue("exponent").jsonPrimitive.int,
                        c
                            .getValue("symbol")
                            .takeUnless { it is JsonNull }
                            ?.jsonPrimitive
                            ?.content,
                        c.str("grouping").uppercase(),
                    )
                }
        val mine = Currency.ALL.associate { it.code to Triple(it.exponent, it.symbol, it.grouping.name) }
        assertEquals(shared, mine)
        for (code in shared.keys) assertEquals(code, Currency.of(code)?.code)
    }

    @TestFactory
    fun parse() =
        cases("parse").map { c ->
            DynamicTest.dynamicTest("parse '${c.str("input")}' ${c.str("currency")}") {
                assertEquals(expected(c), MoneyParser.parse(c.str("input"), c.str("currency")))
            }
        }

    @TestFactory
    fun format() =
        cases("format").map { c ->
            DynamicTest.dynamicTest("format ${c.long("minor")} ${c.str("currency")} ${c.str("style")}") {
                val style = MoneyStyle.valueOf(c.str("style").uppercase())
                assertEquals(c.str("text"), MoneyFormat.format(c.long("minor"), currency(c)!!, style))
            }
        }

    @TestFactory
    fun compact() =
        cases("compact").map { c ->
            DynamicTest.dynamicTest("compact ${c.long("minor")} ${c.str("currency")}") {
                assertEquals(c.str("text"), MoneyFormat.compact(c.long("minor"), currency(c)!!))
            }
        }

    @TestFactory
    fun expression() =
        cases("expression").map { c ->
            DynamicTest.dynamicTest("expression '${c.str("input")}' ${c.str("currency")}") {
                assertEquals(expected(c), MoneyExpression.evaluate(c.str("input"), currency(c)!!))
            }
        }

    @Test
    fun `format then parse round-trips every amount (property)`(): Unit =
        runBlocking {
            checkAll(2_000, Arb.long(0L..Money.MAX_MINOR)) { minor ->
                for (cur in listOf(Currency.INR, Currency.USD, Currency.JPY, Currency.KWD)) {
                    val text = MoneyFormat.format(minor, cur).removePrefix(cur.symbol ?: "${cur.code} ")
                    assertEquals(MoneyResult.Ok(minor), MoneyParser.parse(text, cur))
                }
            }
        }

    @Test
    fun `addition of parsed amounts equals the parsed sum expression (property)`(): Unit =
        runBlocking {
            checkAll(2_000, Arb.long(0L..1_000_000_000L), Arb.long(0L..1_000_000_000L)) { a, b ->
                val expr = "${MoneyFormat.format(
                    a,
                    Currency.INR,
                ).drop(1)}+${MoneyFormat.format(b, Currency.INR).drop(1)}"
                assertEquals(MoneyResult.Ok(a + b), MoneyExpression.evaluate(expr, Currency.INR))
            }
        }
}
