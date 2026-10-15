// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.transfer

import dev.zwallet.core.model.contracts.Contracts
import io.kotest.property.Arb
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import java.io.File
import kotlin.random.Random

/** packages/contracts/fixtures/merge.json + the ARCHITECTURE §5.6 invariants as properties. */
class RowMergeTest {
    private val root = File(System.getProperty("zwallet.repoRoot"))
    private val vectors =
        Json
            .parseToJsonElement(
                root.resolve("packages/contracts/fixtures/merge.json").readText(),
            ).jsonObject

    private fun value(e: JsonElement): Value =
        when {
            e is JsonNull -> Value.Null
            e is JsonPrimitive && e.isString -> Value.Text(e.content)
            else -> Value.Int(e.jsonPrimitive.long)
        }

    private fun row(e: JsonElement): Row? = (e as? JsonObject)?.mapValues { value(it.value) }

    private fun frontier(e: JsonElement?): Map<String, String>? =
        (e as? JsonObject)?.mapValues {
            it.value.jsonPrimitive.content
        }

    @TestFactory
    fun vectors() =
        vectors.getValue("cases").jsonArray.map { it.jsonObject }.map { c ->
            DynamicTest.dynamicTest(c.getValue("name").jsonPrimitive.content) {
                val spec = Contracts.table(c.getValue("table").jsonPrimitive.content)
                val result =
                    RowMerge.merge(
                        spec,
                        row(c.getValue("local")),
                        row(c.getValue("incoming"))!!,
                        frontier(c["local_frontier"]),
                        frontier(c["incoming_frontier"]),
                    )
                val expected = c.getValue("expected").jsonObject
                assertEquals(row(expected.getValue("row")), result.row, "row")
                assertEquals(
                    expected.getValue("outcome").jsonPrimitive.content,
                    result.outcome.name.lowercase(),
                    "outcome",
                )
                val conflicts =
                    expected.getValue("conflicts").jsonArray.map { it.jsonObject }.map {
                        Conflict(
                            group = it.getValue("group").jsonPrimitive.content,
                            losingSide =
                                Side.valueOf(
                                    it
                                        .getValue("losing_side")
                                        .jsonPrimitive.content
                                        .uppercase(),
                                ),
                            losingValues =
                                it.getValue("losing_values").jsonObject.mapValues { v ->
                                    value(v.value)
                                },
                            losingHlc = it.getValue("losing_hlc").jsonPrimitive.content,
                            winningHlc = it.getValue("winning_hlc").jsonPrimitive.content,
                        )
                    }
                assertEquals(conflicts, result.conflicts, "conflicts")
            }
        }

    // ── properties (mirrors packages/contracts/test/vectors.test.mjs) ──────────────────────────
    private val spec = Contracts.transactions
    private val choices: Map<String, List<Value>> =
        mapOf(
            "note" to listOf(Value.Null, Value.Text("a"), Value.Text("b"), Value.Text("lunch")),
            "category_id" to listOf(Value.Text("c1"), Value.Text("c2"), Value.Null),
            "amount_minor" to listOf(Value.Int(100), Value.Int(4200), Value.Int(99)),
            "currency" to listOf(Value.Text("INR"), Value.Text("USD")),
            "deleted_at" to listOf(Value.Null, Value.Int(5), Value.Int(9)),
            "review_state" to listOf(Value.Text("confirmed"), Value.Text("needs_review")),
        )

    private fun baseRow(): Row {
        val r = spec.columns.associateWith<String, Value> { Value.Null }.toMutableMap()
        r["id"] = Value.Text("x")
        r["type"] = Value.Text("expense")
        r["amount_minor"] = Value.Int(100)
        r["currency"] = Value.Text("INR")
        r["occurred_at"] = Value.Int(1)
        r["occurred_tz"] = Value.Text("Asia/Kolkata")
        r["payment_method"] = Value.Text("other")
        r["source"] = Value.Text("manual")
        r["review_state"] = Value.Text("confirmed")
        r["created_at"] = Value.Int(1)
        r["updated_at"] = Value.Int(1)
        val h = "0000000000001-0000-00000000"
        r["field_hlc"] = Value.Text(FieldHlc.stringify(spec.groups.keys.associateWith { h }))
        r["hlc"] = Value.Text(h)
        return r
    }

    /** One copy of the row plus a clock; edits stamp the touched group, as the repository will. */
    private inner class Device(
        val node: String,
    ) {
        var row: Row = baseRow()
        private var wall = 1L
        private var counter = 0

        fun edit(rnd: Random) {
            val col = choices.keys.toList()[rnd.nextInt(choices.size)]
            val group = spec.groupOf.getValue(col)
            val now = wall + rnd.nextInt(3)
            counter = if (now == wall) counter + 1 else 0
            wall = now
            val h = "${wall.toString().padStart(13, '0')}-${counter.toString(16).padStart(4, '0')}-$node"
            val stamps = FieldHlc.parse((row.getValue("field_hlc") as Value.Text).v).toMutableMap()
            stamps[group] = h
            row =
                row +
                mapOf(
                    col to choices.getValue(col)[rnd.nextInt(choices.getValue(col).size)],
                    "field_hlc" to Value.Text(FieldHlc.stringify(stamps)),
                    "hlc" to Value.Text(h),
                    "updated_at" to Value.Int(wall),
                )
        }

        fun receive(file: Row) {
            row = RowMerge.merge(spec, row, file).row
            val seen = (row.getValue("hlc") as Value.Text).v
            val w = seen.take(13).toLong()
            val c = seen.substring(14, 18).toInt(16)
            if (w > wall || (w == wall && c >= counter)) {
                wall = w
                counter = c + 1
            }
        }
    }

    @Test
    fun `convergence and idempotence over random edit-exchange histories`(): Unit =
        runBlocking {
            checkAll(1_000, Arb.long()) { seed ->
                val rnd = Random(seed)
                val devices = listOf(Device("aaaaaaaa"), Device("bbbbbbbb"), Device("cccccccc"))
                repeat(12) {
                    val d = devices[rnd.nextInt(3)]
                    if (rnd.nextDouble() < 0.6) {
                        d.edit(rnd)
                    } else {
                        val other = devices[rnd.nextInt(3)]
                        if (other !== d) d.receive(other.row)
                    }
                }
                repeat(2) { for (a in devices) for (b in devices) if (a !== b) a.receive(b.row) }
                devices.drop(1).forEach { assertEquals(devices[0].row, it.row, "seed $seed diverged") }
                assertEquals(Outcome.UNCHANGED, RowMerge.merge(spec, devices[0].row, devices[1].row).outcome)
            }
        }

    @Test
    fun `merge is commutative even with HLC ties from a cloned install`(): Unit =
        runBlocking {
            checkAll(1_000, Arb.long()) { seed ->
                val rnd = Random(seed)
                val a = Device("aaaaaaaa")
                val b = Device(if (rnd.nextInt(3) == 0) "aaaaaaaa" else "bbbbbbbb")
                repeat(6) { (if (rnd.nextBoolean()) a else b).edit(rnd) }
                assertEquals(RowMerge.merge(spec, a.row, b.row).row, RowMerge.merge(spec, b.row, a.row).row)
            }
        }

    @Test
    fun `a newer deletion is never undone by edits to other groups`() {
        val a = Device("aaaaaaaa")
        val b = Device("bbbbbbbb")
        b.receive(a.row)
        val stamps = FieldHlc.parse((a.row.getValue("field_hlc") as Value.Text).v).toMutableMap()
        stamps["deleted"] = "0000000000500-0000-aaaaaaaa"
        a.row = a.row + mapOf("deleted_at" to Value.Int(500), "field_hlc" to Value.Text(FieldHlc.stringify(stamps)))
        repeat(50) { i ->
            val s = FieldHlc.parse((b.row.getValue("field_hlc") as Value.Text).v).toMutableMap()
            s["note"] = "0000000000${600 + i}-0000-bbbbbbbb"
            b.row = b.row + mapOf("note" to Value.Text("n$i"), "field_hlc" to Value.Text(FieldHlc.stringify(s)))
            a.receive(b.row)
            assertEquals(Value.Int(500), a.row.getValue("deleted_at"))
            assertEquals(Value.Text("n$i"), a.row.getValue("note"))
        }
    }

    @Test
    fun `field_hlc codec writes sorted keys exactly like JSON_stringify`() {
        assertEquals("""{"a":"1","b":"2"}""", FieldHlc.stringify(mapOf("b" to "2", "a" to "1")))
        assertEquals(
            mapOf("note" to "0000000000001-0000-00000000"),
            FieldHlc.parse("""{"note":"0000000000001-0000-00000000"}"""),
        )
        assertEquals(emptyMap<String, String>(), FieldHlc.parse("{}"))
    }
}
