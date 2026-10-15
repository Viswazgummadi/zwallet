// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.model.money

/** How the integer part of an amount is grouped. */
enum class Grouping {
    /** 1,23,45,678 — last three digits, then pairs (INR). */
    INDIAN,

    /** 12,345,678 — thousands. */
    WESTERN,
}

/**
 * An ISO-4217 currency with its minor-unit exponent (ADR 0003). The table is shared with the web
 * app through packages/contracts/fixtures/money.json.
 */
class Currency private constructor(
    val code: String,
    /** Minor digits: 2 for INR (paise), 0 for JPY, 3 for KWD. */
    val exponent: Int,
    /** Prefix symbol, or null to print the code followed by a space. */
    val symbol: String?,
    val grouping: Grouping,
) {
    override fun toString(): String = code

    companion object {
        val INR = Currency("INR", 2, "₹", Grouping.INDIAN)
        val USD = Currency("USD", 2, "$", Grouping.WESTERN)
        val EUR = Currency("EUR", 2, "€", Grouping.WESTERN)
        val GBP = Currency("GBP", 2, "£", Grouping.WESTERN)
        val AED = Currency("AED", 2, null, Grouping.WESTERN)
        val JPY = Currency("JPY", 0, "¥", Grouping.WESTERN)
        val KWD = Currency("KWD", 3, null, Grouping.WESTERN)

        /** Every supported currency; must equal fixtures/money.json "currencies" (tested). */
        val ALL: List<Currency> = listOf(INR, USD, EUR, GBP, AED, JPY, KWD)

        private val byCode = ALL.associateBy { it.code }

        /** The supported currency for an ISO code, or null. */
        fun of(code: String): Currency? = byCode[code]
    }
}
