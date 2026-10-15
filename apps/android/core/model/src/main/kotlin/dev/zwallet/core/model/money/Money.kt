// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.model.money

import java.math.BigInteger

/**
 * An amount in integer minor units (paise for INR) plus its currency (ADR 0003). Never Double or
 * Float. Amounts are limited to ±[MAX_MINOR] so the web app (safe-integer numbers) agrees.
 */
data class Money(
    val minor: Long,
    val currency: Currency,
) {
    init {
        require(minor in -MAX_MINOR..MAX_MINOR) { "amount out of range" }
    }

    operator fun plus(other: Money): Money =
        Money(checked(minor.toBig() + other.sameCurrency().minor.toBig()), currency)

    operator fun minus(other: Money): Money =
        Money(checked(minor.toBig() - other.sameCurrency().minor.toBig()), currency)

    operator fun unaryMinus(): Money = Money(-minor, currency)

    private fun Money.sameCurrency(): Money {
        require(
            this.currency == this@Money.currency,
        ) { "currency mismatch: ${this.currency} vs ${this@Money.currency}" }
        return this
    }

    companion object {
        /** 2^53 − 1: the largest integer both Kotlin and JavaScript represent exactly. */
        const val MAX_MINOR: Long = 9_007_199_254_740_991L

        fun zero(currency: Currency): Money = Money(0, currency)
    }
}

/** Why a money input was rejected. [code] matches packages/contracts/fixtures/money.json. */
enum class MoneyError(
    val code: String,
) {
    EMPTY("empty"),
    INVALID("invalid"),
    SYNTAX("syntax"),
    TOO_MANY_DECIMALS("too_many_decimals"),
    OVERFLOW("overflow"),
    UNKNOWN_CURRENCY("unknown_currency"),
}

/** Either a value or a [MoneyError]. */
sealed interface MoneyResult<out T> {
    data class Ok<T>(
        val value: T,
    ) : MoneyResult<T>

    data class Err(
        val error: MoneyError,
    ) : MoneyResult<Nothing>
}

internal val BIG_MAX: BigInteger = BigInteger.valueOf(Money.MAX_MINOR)

internal fun Long.toBig(): BigInteger = BigInteger.valueOf(this)

internal fun checked(v: BigInteger): Long {
    require(v.abs() <= BIG_MAX) { "amount out of range" }
    return v.toLong()
}

internal fun pow10(n: Int): BigInteger = BigInteger.TEN.pow(n)

/** round-half-up(n / d) for n ≥ 0, d > 0. */
internal fun divHalfUp(
    n: BigInteger,
    d: BigInteger,
): BigInteger = (n.shiftLeft(1) + d).divide(d.shiftLeft(1))
