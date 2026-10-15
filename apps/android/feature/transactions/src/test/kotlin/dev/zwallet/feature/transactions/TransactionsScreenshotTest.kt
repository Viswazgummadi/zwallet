// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.feature.transactions

import dev.zwallet.core.testing.ZwScreenshotTest
import dev.zwallet.core.testing.captureScreenMatrix
import org.junit.Test

class TransactionsScreenshotTest : ZwScreenshotTest() {
    @Test
    fun empty() = captureScreenMatrix("transactions_empty") { TransactionsScreen() }
}
