// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.model.money

import java.math.BigInteger

/**
 * Quick-add expressions (SPEC AC-4.2.4, fixtures/money.json "expression"), evaluated exactly:
 * `120+45`, `0.1+0.2` (→ 30 minor units), `2.5×40`, `10+2×3`. Each product is rounded once,
 * half-up. A single trailing operator is ignored so the preview works while typing.
 */
object MoneyExpression {
    private val MINUS = Character.toChars(0x2212)[0]
    private val TIMES = Character.toChars(0x00D7)[0]

    private sealed interface Token {
        data class Num(
            val text: String,
        ) : Token

        data class Op(
            val kind: Char,
        ) : Token // '+', '-', '*'
    }

    fun evaluate(
        input: String,
        currency: Currency,
    ): MoneyResult<Long> {
        val s = input.filter { it != ' ' }
        if (s.isEmpty()) return MoneyResult.Err(MoneyError.EMPTY)
        val tokens = tokenize(s) ?: return MoneyResult.Err(MoneyError.SYNTAX)
        val body = if (tokens.last() is Token.Op) tokens.dropLast(1) else tokens
        if (body.isEmpty() || !isAlternating(body)) return MoneyResult.Err(MoneyError.SYNTAX)

        val scale = pow10(currency.exponent)
        var sum = BigInteger.ZERO
        var sign = 1
        var term = mutableListOf<BigInteger>()

        fun flush(): MoneyError? {
            // product of k factors, each scaled by 10^e → divide by 10^(e·(k−1)), rounding half-up
            val product = term.fold(BigInteger.ONE) { acc, f -> acc.multiply(f) }
            val divisor = scale.pow(term.size - 1)
            val value = divHalfUp(product, divisor)
            if (value > BIG_MAX) return MoneyError.OVERFLOW
            sum = if (sign > 0) sum + value else sum - value
            if (sum.abs() > BIG_MAX) return MoneyError.OVERFLOW
            term = mutableListOf()
            return null
        }
        for (t in body) {
            when (t) {
                is Token.Num -> {
                    val parsed = MoneyParser.parseScaled(t.text.replace(",", ""), currency.exponent)
                    when (parsed) {
                        is MoneyResult.Ok -> {
                            term.add(parsed.value)
                        }

                        is MoneyResult.Err -> {
                            return MoneyResult.Err(
                                if (parsed.error ==
                                    MoneyError.INVALID
                                ) {
                                    MoneyError.SYNTAX
                                } else {
                                    parsed.error
                                },
                            )
                        }
                    }
                }

                is Token.Op -> {
                    if (t.kind != '*') {
                        flush()?.let { return MoneyResult.Err(it) }
                        sign = if (t.kind == '+') 1 else -1
                    }
                }
            }
        }
        flush()?.let { return MoneyResult.Err(it) }
        return MoneyResult.Ok(sum.toLong())
    }

    private fun tokenize(s: String): List<Token>? {
        val out = ArrayList<Token>()
        var i = 0
        while (i < s.length) {
            val c = s[i]
            when {
                c in '0'..'9' || c == '.' || c == ',' -> {
                    val start = i
                    while (i < s.length && (s[i] in '0'..'9' || s[i] == '.' || s[i] == ',')) i++
                    out.add(Token.Num(s.substring(start, i)))
                    continue
                }

                c == '+' -> {
                    out.add(Token.Op('+'))
                }

                c == '-' || c == MINUS -> {
                    out.add(Token.Op('-'))
                }

                c == '*' || c == TIMES -> {
                    out.add(Token.Op('*'))
                }

                else -> {
                    return null
                }
            }
            i++
        }
        return out
    }

    /** num (op num)* */
    private fun isAlternating(tokens: List<Token>): Boolean =
        tokens.withIndex().all { (i, t) ->
            (i % 2 == 0) ==
                (t is Token.Num)
        }
}
