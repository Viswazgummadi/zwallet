// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.model.hlc

/**
 * Hybrid logical clock timestamp (ARCHITECTURE §5.1, ADR 0009). Text form
 * `{wall ms:13 digits}-{counter:4 hex}-{node:8 hex}`; text order equals clock order, so stored
 * HLCs compare as plain strings on both platforms.
 */
data class Hlc(
    val wall: Long,
    val counter: Int,
    val node: String,
) : Comparable<Hlc> {
    init {
        require(wall in 0..MAX_WALL) { "wall out of range" }
        require(counter in 0..MAX_COUNTER) { "counter out of range" }
        require(NODE.matches(node)) { "node must be 8 lowercase hex digits" }
    }

    override fun toString(): String =
        "${wall.toString().padStart(13, '0')}-${counter.toString(16).padStart(4, '0')}-$node"

    override fun compareTo(other: Hlc): Int = compareValuesBy(this, other, { it.wall }, { it.counter }, { it.node })

    companion object {
        const val MAX_WALL: Long = 9_999_999_999_999L
        const val MAX_COUNTER: Int = 0xffff
        private val NODE = Regex("^[0-9a-f]{8}$")
        private val TEXT = Regex("^(\\d{13})-([0-9a-f]{4})-([0-9a-f]{8})$")

        /** The smallest HLC; seeded rows carry it so any user edit wins a merge. */
        val ZERO = Hlc(0, 0, "00000000")

        /** Parses the text form, or null if it is not exactly `13 digits - 4 hex - 8 hex`. */
        fun parse(text: String): Hlc? {
            val m = TEXT.matchEntire(text) ?: return null
            return Hlc(m.groupValues[1].toLong(), m.groupValues[2].toInt(16), m.groupValues[3])
        }
    }
}

/**
 * The per-install clock. [now] stamps local writes; [receive] is called after an import with the
 * file's `max_hlc` so later local edits sort after everything imported (ARCHITECTURE §5.1).
 * Not thread-safe by itself: the repository serializes writes.
 */
class HlcClock(
    val node: String,
    last: Hlc?,
    private val physicalMs: () -> Long = System::currentTimeMillis,
) {
    var last: Hlc? = last
        private set

    fun now(): Hlc {
        val prev = last
        val phys = physicalMs()
        var wall = maxOf(phys, prev?.wall ?: Long.MIN_VALUE)
        var counter = if (prev != null && wall == prev.wall) prev.counter + 1 else 0
        if (counter > Hlc.MAX_COUNTER) {
            wall += 1
            counter = 0
        }
        return Hlc(wall, counter, node).also { last = it }
    }

    fun receive(remote: Hlc) {
        val prev = last
        if (prev == null || remote > prev) last = remote
    }
}
