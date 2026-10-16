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

/**
 * User-facing bucket for one row, from merge-group VALUES only (never created_at, updated_at,
 * hlc or field_hlc). [INSERTED_DELETED] is a tombstone for a row we never had: not "new" in the
 * import preview.
 */
enum class Outcome { INSERTED, INSERTED_DELETED, UPDATED, DELETED, RESTORED, UNCHANGED }

/**
 * @property write the merged row differs from local in any column (stamps, hlc, created_at ...):
 *   the importer persists it even when [outcome] is [Outcome.UNCHANGED].
 */
data class MergeResult(
    val row: Row,
    val conflicts: List<Conflict>,
    val outcome: Outcome,
    val write: Boolean,
)

enum class MergeErrorCode(
    val code: String,
) {
    MALFORMED_FIELD_HLC("malformed_field_hlc"),
    MISSING_COLUMN("missing_column"),
}

/** An input the merge refuses: the importer rejects the whole file before touching the DB. */
class MergeException(
    val errorCode: MergeErrorCode,
    detail: String,
) : IllegalArgumentException("${errorCode.code}: $detail")

/**
 * Per-merge-group last-writer-wins (ADR 0009) with conflict detection by per-node frontiers
 * (ADR 0017). Pure and deterministic; identical to packages/contracts/lib/merge-reference.mjs (which
 * documents the rules: strict inputs, immutable reconciliation, outcomes, `write`) and tested
 * against packages/contracts/fixtures/merge.json.
 */
object RowMerge {
    fun merge(
        spec: TableSpec,
        local: Row?,
        incoming: Row,
        localFrontier: Map<String, String>? = null,
        incomingFrontier: Map<String, String>? = null,
    ): MergeResult {
        checkColumns(spec, incoming)
        if (local != null) checkColumns(spec, local)
        val inf = FieldHlc.parse(incoming.getValue("field_hlc"))
        if (local == null) {
            val outcome =
                if (incoming.getValue("deleted_at") ==
                    Value.Null
                ) {
                    Outcome.INSERTED
                } else {
                    Outcome.INSERTED_DELETED
                }
            return MergeResult(incoming, emptyList(), outcome, write = true)
        }
        val lf = FieldHlc.parse(local.getValue("field_hlc"))
        val lFront = localFrontier ?: frontier(sequenceOf(local))
        val iFront = incomingFrontier ?: frontier(sequenceOf(incoming))

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
        // Immutable columns should be equal on every copy; if they are not, the larger value wins,
        // so the merge still converges. Not a conflict: there is nothing for the user to choose.
        for (c in spec.immutable) {
            if (incoming.getValue(c) > local.getValue(c)) out[c] = incoming.getValue(c)
        }
        // Stamps for groups this schema doesn't know are kept as max, whatever their name.
        for ((g, h) in lf.entries + inf.entries) {
            if (!spec.groups.containsKey(g)) merged[g] = maxOf(merged[g] ?: "", h)
        }

        out["field_hlc"] = Value.Text(FieldHlc.stringify(merged))
        out["hlc"] = Value.Text(merged.values.maxOrNull() ?: maxOf(local.text("hlc"), incoming.text("hlc")))
        out["created_at"] = Value.Int(minOf(local.long("created_at"), incoming.long("created_at")))
        out["updated_at"] = Value.Int(maxOf(local.long("updated_at"), incoming.long("updated_at")))

        fun differs(c: String) = out.getValue(c).compareTo(local.getValue(c)) != 0
        val userColumns =
            spec.immutable +
                spec.groups
                    .filterKeys { it != "deleted" }
                    .values
                    .flatten()
        val wasDeleted = local.getValue("deleted_at") != Value.Null
        val isDeleted = out.getValue("deleted_at") != Value.Null
        val outcome =
            when {
                !wasDeleted && isDeleted -> Outcome.DELETED
                wasDeleted && !isDeleted -> Outcome.RESTORED
                userColumns.any(::differs) -> Outcome.UPDATED
                else -> Outcome.UNCHANGED
            }
        return MergeResult(out, conflicts, outcome, write = spec.columns.any(::differs))
    }

    /** node id → highest HLC from that node in any group stamp of [rows] (ADR 0017). */
    fun frontier(rows: Sequence<Row>): Map<String, String> {
        val f = HashMap<String, String>()
        for (row in rows) {
            if ("field_hlc" !in row) throw MergeException(MergeErrorCode.MISSING_COLUMN, "field_hlc")
            for (h in FieldHlc.parse(row.getValue("field_hlc")).values) {
                val node = h.substringAfterLast('-')
                if (h > (f[node] ?: "")) f[node] = h
            }
        }
        return f
    }

    private fun checkColumns(
        spec: TableSpec,
        row: Row,
    ) {
        for (c in spec.columns) if (c !in row) throw MergeException(MergeErrorCode.MISSING_COLUMN, c)
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
 * byte-identical text. Group names are `[a-z][a-z0-9_]*`; stamps are well-formed HLCs
 * (`wall(13 digits)-counter(4 hex)-node(8 hex)`, lowercase). `{}` is the empty map; `""` is malformed.
 */
object FieldHlc {
    private const val STAMP = "[0-9]{13}-[0-9a-f]{4}-[0-9a-f]{8}"
    private val ENTRY = Regex("\"([a-z][a-z0-9_]*)\":\"($STAMP)\"")
    private val WHOLE = Regex("^\\{(?:${ENTRY.pattern}(?:,${ENTRY.pattern})*)?\\}$")

    /** Strict: a TEXT value of canonical JSON whose stamps are all well-formed. */
    fun parse(value: Value): Map<String, String> {
        val text =
            (value as? Value.Text)?.v ?: throw MergeException(MergeErrorCode.MALFORMED_FIELD_HLC, value.toString())
        return parse(text)
    }

    fun parse(text: String): Map<String, String> {
        if (!WHOLE.matches(text)) throw MergeException(MergeErrorCode.MALFORMED_FIELD_HLC, text)
        return ENTRY.findAll(text).associate { it.groupValues[1] to it.groupValues[2] }
    }

    fun stringify(map: Map<String, String>): String =
        map.toSortedMap().entries.joinToString(",", "{", "}") { (k, v) -> "\"$k\":\"$v\"" }
}
