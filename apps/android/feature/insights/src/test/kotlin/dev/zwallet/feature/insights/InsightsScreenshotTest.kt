// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.feature.insights

import dev.zwallet.core.testing.ZwScreenshotTest
import dev.zwallet.core.testing.captureScreenMatrix
import org.junit.Test

class InsightsScreenshotTest : ZwScreenshotTest() {
    @Test
    fun empty() = captureScreenMatrix("insights_empty") { InsightsScreen() }
}
