// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.model.id

import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Row ids (ADR 0010, ADR 0013, RFC 9562). Manual rows get UUIDv7; rows that must merge across
 * copies get a deterministic UUIDv8 of a namespaced name. Shared vectors:
 * packages/contracts/fixtures/uuid.json.
 */
object Ids {
    private val random = SecureRandom()

    /** UUIDv7 for a new manually created row. */
    fun newV7(nowMs: Long = System.currentTimeMillis()): String = v7(nowMs, ByteArray(10).also { random.nextBytes(it) })

    /** UUIDv7 from unix ms and 10 random bytes (rand_a = 12 bits, rand_b = 62 bits). */
    fun v7(
        unixMs: Long,
        rand10: ByteArray,
    ): String {
        require(rand10.size == 10)
        val b = ByteArray(16)
        for (i in 0 until 6) b[i] = (unixMs ushr (8 * (5 - i))).toByte()
        b[6] = (0x70 or (rand10[0].toInt() and 0x0f)).toByte()
        b[7] = rand10[1]
        b[8] = (0x80 or (rand10[2].toInt() and 0x3f)).toByte()
        for (i in 3 until 10) b[i + 6] = rand10[i]
        return format(b)
    }

    /** UUIDv8 from the first 128 bits of SHA-256(UTF-8 name). */
    fun v8(name: String): String {
        val h = sha256(name.toByteArray(Charsets.UTF_8)).copyOf(16)
        h[6] = (0x80 or (h[6].toInt() and 0x0f)).toByte()
        h[8] = (0x80 or (h[8].toInt() and 0x3f)).toByte()
        return format(h)
    }

    /** Id of an SMS-sourced transaction: the same SMS on any device or install → the same row. */
    fun smsId(
        sender: String,
        body: String,
        dateSentSeconds: Long,
    ): String {
        val bodyHash = hex(sha256(normalizeBody(body).toByteArray(Charsets.UTF_8)))
        return v8("sms:v1|${normalizeSender(sender)}|$bodyHash|$dateSentSeconds")
    }

    fun seedId(systemKey: String): String = v8("seed:v1|$systemKey")

    fun transactionTagId(
        transactionId: String,
        tagId: String,
    ): String = v8("tt:v1|$transactionId|$tagId")

    fun insightDismissalId(
        ruleId: String,
        subjectKey: String,
    ): String = v8("insight:v1|$ruleId|$subjectKey")

    private val DLT_PREFIX = Regex("^[A-Za-z]{2}-")
    private val DLT_SUFFIX = Regex("-[STPstp]$")

    /**
     * Trims Unicode White_Space (not Kotlin's trim(), which also strips U+001C–U+001F; see uuid.json),
     * strips the DLT operator prefix ("VM-") and the -S/-T/-P suffix, then upper-cases.
     */
    fun normalizeSender(sender: String): String =
        sender
            .trim { isWhiteSpace(it.code) }
            .replace(DLT_PREFIX, "")
            .replace(DLT_SUFFIX, "")
            .uppercase(java.util.Locale.ROOT)

    /** Collapses every run of Unicode White_Space to one U+0020 and trims (not Java's \s). */
    fun normalizeBody(body: String): String {
        val sb = StringBuilder(body.length)
        var pendingSpace = false
        for (ch in body) {
            if (isWhiteSpace(ch.code)) {
                pendingSpace = sb.isNotEmpty()
            } else {
                if (pendingSpace) sb.append(' ')
                pendingSpace = false
                sb.append(ch)
            }
        }
        return sb.toString()
    }

    /** Unicode White_Space: U+0009–000D, 0020, 0085, 00A0, 1680, 2000–200A, 2028, 2029, 202F, 205F, 3000. */
    internal fun isWhiteSpace(c: Int): Boolean =
        c in 0x09..0x0d ||
            c == 0x20 ||
            c == 0x85 ||
            c == 0xa0 ||
            c == 0x1680 ||
            c in 0x2000..0x200a ||
            c == 0x2028 ||
            c == 0x2029 ||
            c == 0x202f ||
            c == 0x205f ||
            c == 0x3000

    private fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)

    private fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }

    private fun format(b: ByteArray): String {
        val h = hex(b)
        return "${h.substring(
            0,
            8,
        )}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}"
    }
}
