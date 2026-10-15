// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.feature.people

import dev.zwallet.core.testing.ZwScreenshotTest
import dev.zwallet.core.testing.captureScreenMatrix
import org.junit.Test

class PeopleScreenshotTest : ZwScreenshotTest() {
    @Test
    fun empty() = captureScreenMatrix("people_empty") { PeopleScreen() }
}
