// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.model.money

import java.math.BigInteger

/**
 * User-typed amount → minor units, exactly (fixtures/money.json "parse"). Commas are ignored, at
 * most one '.', at most `exponent` fraction digits. No signs or symbols.
 */
object MoneyParser {
    fun parse(
        input: String,
        currencyCode: String,
    ): MoneyResult<Long> {
        val currency = Currency.of(currencyCode) ?: return MoneyResult.Err(MoneyError.UNKNOWN_CURRENCY)
        return parse(input, currency)
    }

    fun parse(
        input: String,
        currency: Currency,
    ): MoneyResult<Long> {
        val s = input.trim { it == ' ' }
        if (s.isEmpty()) return MoneyResult.Err(MoneyError.EMPTY)
        return when (val r = parseScaled(s.replace(",", ""), currency.exponent)) {
            is MoneyResult.Ok -> MoneyResult.Ok(r.value.toLong())
            is MoneyResult.Err -> r
        }
    }

    /** Digits with an optional single '.', scaled by 10^exponent. Commas must already be removed. */
    internal fun parseScaled(
        s: String,
        exponent: Int,
    ): MoneyResult<BigInteger> {
        if (s.any { it != '.' && it !in '0'..'9' } || s.count { it == '.' } > 1 || s.none { it in '0'..'9' }) {
            return MoneyResult.Err(MoneyError.INVALID)
        }
        val dot = s.indexOf('.')
        val intPart = if (dot < 0) s else s.substring(0, dot)
        val fracPart = if (dot < 0) "" else s.substring(dot + 1)
        if (fracPart.length > exponent) return MoneyResult.Err(MoneyError.TOO_MANY_DECIMALS)
        val digits = (intPart.ifEmpty { "0" }) + fracPart.padEnd(exponent, '0')
        val value = BigInteger(digits)
        if (value > BIG_MAX) return MoneyResult.Err(MoneyError.OVERFLOW)
        return MoneyResult.Ok(value)
    }
}
