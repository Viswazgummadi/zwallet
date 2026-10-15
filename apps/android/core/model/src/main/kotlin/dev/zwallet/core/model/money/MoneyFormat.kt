// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.model.money

import java.math.BigInteger

/** U+2212 MINUS SIGN, used for negative amounts (not the ASCII hyphen). */
val MINUS_SIGN: String = String(Character.toChars(0x2212))

/** How [MoneyFormat.format] prints the fraction. */
enum class MoneyStyle {
    /** Always every minor digit: ₹1,23,456.00. */
    FULL,

    /** Drops an all-zero fraction (lists, SPEC §4.1): ₹1,23,456. */
    LIST,
}

/** Display formatting (fixtures/money.json "format" and "compact"). Formatting is the only place money becomes text. */
object MoneyFormat {
    fun format(
        minor: Long,
        currency: Currency,
        style: MoneyStyle = MoneyStyle.FULL,
    ): String {
        val digits =
            minor
                .toBig()
                .abs()
                .toString()
                .padStart(currency.exponent + 1, '0')
        val intPart = digits.substring(0, digits.length - currency.exponent)
        val frac = digits.substring(digits.length - currency.exponent)
        val showFrac = currency.exponent > 0 && !(style == MoneyStyle.LIST && frac.all { it == '0' })
        val number = group(intPart, currency.grouping) + if (showFrac) ".$frac" else ""
        val prefix = currency.symbol ?: "${currency.code} "
        return (if (minor < 0) MINUS_SIGN else "") + prefix + number
    }

    fun format(
        money: Money,
        style: MoneyStyle = MoneyStyle.FULL,
    ): String = format(money.minor, money.currency, style)

    /**
     * Chart/axis label without a symbol: 950 · 9.5K · 1.2L · 3.4Cr (INR) or K/M/B elsewhere.
     * Rounds half-up; a value that rounds up into the next unit moves to that unit (₹99,999 → 1L).
     */
    fun compact(
        minor: Long,
        currency: Currency,
    ): String {
        val abs = minor.toBig().abs()
        val scale = pow10(currency.exponent)
        val units = if (currency.grouping == Grouping.INDIAN) INDIAN_UNITS else WESTERN_UNITS
        val sign = if (minor < 0) MINUS_SIGN else ""

        var idx = units.indexOfLast { abs >= it.first.multiply(scale) }
        if (idx < 0) {
            val whole = divHalfUp(abs, scale)
            if (whole < units[0].first) return sign + group(whole.toString(), currency.grouping)
            idx = 0
        }
        var tenths = tenthsOf(abs, units[idx].first, scale)
        while (idx < units.lastIndex) {
            val next = units[idx + 1].first
            if (tenths < BigInteger.TEN.multiply(next).divide(units[idx].first)) break
            idx++
            tenths = tenthsOf(abs, units[idx].first, scale)
        }
        val (whole, dec) = tenths.divideAndRemainder(BigInteger.TEN)
        val number = group(whole.toString(), currency.grouping) + if (dec.signum() != 0) ".$dec" else ""
        return sign + number + units[idx].second
    }

    private fun tenthsOf(
        abs: BigInteger,
        unit: BigInteger,
        scale: BigInteger,
    ): BigInteger = divHalfUp(abs.multiply(BigInteger.TEN), unit.multiply(scale))

    private val INDIAN_UNITS = listOf(big(1_000) to "K", big(100_000) to "L", big(10_000_000) to "Cr")
    private val WESTERN_UNITS = listOf(big(1_000) to "K", big(1_000_000) to "M", big(1_000_000_000) to "B")

    private fun big(n: Long) = BigInteger.valueOf(n)

    /** Groups a run of ASCII digits: Indian = last three then pairs; Western = thousands. */
    internal fun group(
        digits: String,
        grouping: Grouping,
    ): String {
        if (digits.length <= 3) return digits
        val head = digits.substring(0, digits.length - 3)
        val tail = digits.substring(digits.length - 3)
        val size = if (grouping == Grouping.INDIAN) 2 else 3
        val parts = ArrayList<String>()
        var end = head.length
        while (end > 0) {
            parts.add(0, head.substring(maxOf(0, end - size), end))
            end -= size
        }
        return parts.joinToString(",") + "," + tail
    }
}
