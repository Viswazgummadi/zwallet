// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.transfer

import dev.zwallet.core.model.contracts.TableSpec

/** A column value as stored in SQLite and in a .zwallet row: NULL, INTEGER or TEXT. */
sealed interface Value : Comparable<Value> {
    data object Null : Value

    data class Int(
        val v: Long,
    ) : Value

    data class Text(
        val v: String,
    ) : Value

    /** Total order used to break HLC ties: null < integer < string; strings by UTF-16 code unit. */
    override fun compareTo(other: Value): kotlin.Int {
        val rank = { x: Value ->
            when (x) {
                Null -> 0
                is Int -> 1
                is Text -> 2
            }
        }
        if (rank(this) != rank(other)) return rank(this) - rank(other)
        return when (this) {
            Null -> 0
            is Int -> v.compareTo((other as Int).v)
            is Text -> v.compareTo((other as Text).v)
        }
    }
}

typealias Row = Map<String, Value>

enum class Side { LOCAL, INCOMING }

/** A merge group whose values lost to a concurrent edit (ADR 0017); goes to `conflict_log`. */
data class Conflict(
    val group: String,
    val losingSide: Side,
    val losingValues: Map<String, Value>,
    val losingHlc: String,
    val winningHlc: String,
)

/** Import preview bucket for one row (SPEC §11: new · updated · deleted · unchanged). */
enum class Outcome { INSERTED, UNCHANGED, UPDATED, DELETED }

data class MergeResult(
    val row: Row,
    val conflicts: List<Conflict>,
    val outcome: Outcome,
)

/**
 * Per-merge-group last-writer-wins (ADR 0009) with conflict detection by per-node frontiers
 * (ADR 0017). Pure and deterministic; identical to packages/contracts/lib/merge-reference.mjs and
 * tested against packages/contracts/fixtures/merge.json.
 */
object RowMerge {
    fun merge(
        spec: TableSpec,
        local: Row?,
        incoming: Row,
        localFrontier: Map<String, String>? = null,
        incomingFrontier: Map<String, String>? = null,
    ): MergeResult {
        if (local == null) return MergeResult(incoming, emptyList(), Outcome.INSERTED)
        val lFront = localFrontier ?: frontier(sequenceOf(local))
        val iFront = incomingFrontier ?: frontier(sequenceOf(incoming))
        val lf = FieldHlc.parse(local.text("field_hlc"))
        val inf = FieldHlc.parse(incoming.text("field_hlc"))

        val out = local.toMutableMap()
        val merged = sortedMapOf<String, String>()
        val conflicts = ArrayList<Conflict>()
        for ((group, cols) in spec.groups) {
            val lh = lf[group] ?: ""
            val ih = inf[group] ?: ""
            val cmp = compareCols(incoming, local, cols)
            val incomingWins = ih > lh || (ih == lh && cmp > 0)
            if (incomingWins) for (c in cols) out[c] = incoming.getValue(c)
            val h = maxOf(lh, ih)
            if (h.isNotEmpty()) merged[group] = h
            if (cmp != 0) {
                val loser = if (incomingWins) local else incoming
                val loserH = if (incomingWins) lh else ih
                val winnerH = if (incomingWins) ih else lh
                val winnerFrontier = if (incomingWins) iFront else lFront
                if (!seen(loserH, winnerFrontier)) {
                    conflicts +=
                        Conflict(
                            group = group,
                            losingSide = if (incomingWins) Side.LOCAL else Side.INCOMING,
                            losingValues = cols.associateWith { loser.getValue(it) },
                            losingHlc = loserH,
                            winningHlc = winnerH,
                        )
                }
            }
        }
        // Stamps for groups this schema doesn't know are kept as max (forward compatibility).
        for ((g, h) in lf.entries + inf.entries) {
            if (g !in spec.groups) merged[g] = maxOf(merged[g] ?: "", h)
        }

        out["field_hlc"] = Value.Text(FieldHlc.stringify(merged))
        out["hlc"] = Value.Text(merged.values.maxOrNull() ?: maxOf(local.text("hlc"), incoming.text("hlc")))
        out["created_at"] = Value.Int(minOf(local.long("created_at"), incoming.long("created_at")))
        out["updated_at"] = Value.Int(maxOf(local.long("updated_at"), incoming.long("updated_at")))

        val unchanged = spec.columns.all { out.getValue(it).compareTo(local.getValue(it)) == 0 }
        val outcome =
            when {
                unchanged -> Outcome.UNCHANGED

                local.getValue(
                    "deleted_at",
                ) == Value.Null && out.getValue("deleted_at") != Value.Null -> Outcome.DELETED

                else -> Outcome.UPDATED
            }
        return MergeResult(out, conflicts, outcome)
    }

    /** node id → highest HLC from that node in any group stamp of [rows] (ADR 0017). */
    fun frontier(rows: Sequence<Row>): Map<String, String> {
        val f = HashMap<String, String>()
        for (row in rows) {
            for (h in FieldHlc.parse(row.text("field_hlc")).values) {
                val node = h.substringAfterLast('-')
                if (h > (f[node] ?: "")) f[node] = h
            }
        }
        return f
    }

    private fun seen(
        hlc: String,
        frontier: Map<String, String>,
    ): Boolean = hlc.isEmpty() || hlc <= (frontier[hlc.substringAfterLast('-')] ?: "")

    private fun compareCols(
        x: Row,
        y: Row,
        cols: List<String>,
    ): Int {
        for (c in cols) {
            val d = x.getValue(c).compareTo(y.getValue(c))
            if (d != 0) return d
        }
        return 0
    }

    private fun Row.text(col: String): String = (getValue(col) as Value.Text).v

    private fun Row.long(col: String): Long = (getValue(col) as Value.Int).v
}

/**
 * `field_hlc` codec. Stored as JSON with keys sorted and no whitespace, so both platforms write
 * byte-identical text. Group names are `[a-z][a-z0-9_]*`; HLCs are `[0-9a-f-]`.
 */
object FieldHlc {
    private val ENTRY = Regex("\"([a-z][a-z0-9_]*)\":\"([0-9a-f-]*)\"")
    private val WHOLE = Regex("^\\{(?:${ENTRY.pattern}(?:,${ENTRY.pattern})*)?\\}$")

    fun parse(text: String): Map<String, String> {
        require(WHOLE.matches(text)) { "malformed field_hlc" }
        return ENTRY.findAll(text).associate { it.groupValues[1] to it.groupValues[2] }
    }

    fun stringify(map: Map<String, String>): String =
        map.toSortedMap().entries.joinToString(",", "{", "}") { (k, v) -> "\"$k\":\"$v\"" }
}
